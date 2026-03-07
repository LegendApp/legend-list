import { IsNewArchitecture } from "@/constants-platform";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { requestAdjust } from "@/utils/requestAdjust";

// Web MVCP can keep a short-lived anchor lock while layout settles across consecutive frames.
const MVCP_POSITION_EPSILON = 0.1;
const MVCP_ANCHOR_LOCK_TTL_MS = 300;
const MVCP_ANCHOR_LOCK_QUIET_PASSES_TO_RELEASE = 2;

function logNativeMVCP(event: string, details: Record<string, unknown>) {
    console.info(`[legend-list][mvcp] ${event}`, details);
}

function resolveAnchorLock(
    state: StateContext["state"],
    enableMVCPAnchorLock: boolean,
    mvcpData: boolean,
    now: number,
) {
    // Reads the web MVCP anchor lock for this pass.
    // The lock bridges data changes and delayed layout updates so we keep the same anchor item,
    // but it must be cleared immediately if MVCP(data) is off, expired, or the anchor disappeared.
    if (!enableMVCPAnchorLock) {
        state.mvcpAnchorLock = undefined;
        return undefined;
    }

    const lock = state.mvcpAnchorLock;
    if (!lock) {
        return undefined;
    }

    const isExpired = now > lock.expiresAt;
    const isMissing = state.indexByKey.get(lock.id) === undefined;
    // Drop stale locks as soon as the anchor disappears, expires, or MVCP(data) is disabled.
    if (isExpired || isMissing || !mvcpData) {
        state.mvcpAnchorLock = undefined;
        return undefined;
    }
    return lock;
}

function updateAnchorLock(
    state: StateContext["state"],
    params: {
        anchorId: string | undefined;
        anchorPosition: number | undefined;
        dataChanged: boolean | undefined;
        now: number;
        positionDiff: number;
    },
) {
    // Updates the web MVCP anchor lock after computing the latest anchor position delta.
    // This keeps consecutive passes pinned to the same anchor while measurements settle,
    // then releases the lock after stable frames to return to normal behavior.
    if (Platform.OS === "web") {
        const { anchorId, anchorPosition, dataChanged, now, positionDiff } = params;
        const enableMVCPAnchorLock = !!dataChanged || !!state.mvcpAnchorLock;
        const mvcpData = state.props.maintainVisibleContentPosition.data;
        if (!enableMVCPAnchorLock || !mvcpData || state.scrollingTo || !anchorId || anchorPosition === undefined) {
            return;
        }

        const existingLock = state.mvcpAnchorLock;
        // Release the lock after a couple of stable passes once data updates have settled.
        const quietPasses =
            !dataChanged && Math.abs(positionDiff) <= MVCP_POSITION_EPSILON && existingLock?.id === anchorId
                ? existingLock.quietPasses + 1
                : 0;

        if (!dataChanged && quietPasses >= MVCP_ANCHOR_LOCK_QUIET_PASSES_TO_RELEASE) {
            state.mvcpAnchorLock = undefined;
            return;
        }

        state.mvcpAnchorLock = {
            expiresAt: now + MVCP_ANCHOR_LOCK_TTL_MS,
            id: anchorId,
            position: anchorPosition,
            quietPasses,
        };
    }
}

function shouldQueueNativeMVCPAdjust(
    dataChanged: boolean | undefined,
    state: StateContext["state"],
    positionDiff: number,
    prevTotalSize: number,
    prevScroll: number,
    scrollTarget: number | undefined,
    shouldRestorePosition: StateContext["state"]["props"]["maintainVisibleContentPosition"]["shouldRestorePosition"],
) {
    if (
        !dataChanged ||
        Platform.OS === "web" ||
        !state.props.maintainVisibleContentPosition.data ||
        shouldRestorePosition !== undefined ||
        scrollTarget !== undefined ||
        positionDiff >= -MVCP_POSITION_EPSILON
    ) {
        return false;
    }

    const distanceFromEnd = prevTotalSize - prevScroll - state.scrollLength;
    return distanceFromEnd < Math.abs(positionDiff) - MVCP_POSITION_EPSILON;
}

function getPredictedNativeClamp(state: StateContext["state"], unresolvedAmount: number, totalSize: number) {
    if (Math.abs(unresolvedAmount) <= MVCP_POSITION_EPSILON) {
        return 0;
    }

    const maxScroll = Math.max(0, totalSize - state.scrollLength);
    const clampDelta = maxScroll - state.scroll;

    if (unresolvedAmount < 0) {
        return Math.max(unresolvedAmount, Math.min(0, clampDelta));
    }
    if (unresolvedAmount > 0) {
        return Math.min(unresolvedAmount, Math.max(0, clampDelta));
    }

    return 0;
}

function maybeApplyPredictedNativeMVCPAdjust(ctx: StateContext) {
    const state = ctx.state;
    const pending = state.pendingNativeMVCPAdjust;
    if (!pending || Math.abs(pending.manualApplied) > MVCP_POSITION_EPSILON) {
        return;
    }

    const predictedNativeClamp = getPredictedNativeClamp(state, pending.amount, getContentSize(ctx));
    if (Math.abs(predictedNativeClamp) <= MVCP_POSITION_EPSILON) {
        return;
    }

    const manualDesired = pending.amount - predictedNativeClamp;
    if (Math.abs(manualDesired) <= MVCP_POSITION_EPSILON) {
        return;
    }

    pending.manualApplied = manualDesired;
    logNativeMVCP("apply predicted native mvcp adjust", {
        predictedImmediateAdjust: manualDesired,
        predictedNativeClamp,
        queuedAmount: pending.amount,
        scroll: state.scroll,
        startScroll: pending.startScroll,
        totalSize: getContentSize(ctx),
    });
    requestAdjust(ctx, manualDesired, true);
}

export function resolvePendingNativeMVCPAdjust(ctx: StateContext, newScroll: number) {
    const state = ctx.state;
    const pending = state.pendingNativeMVCPAdjust;
    if (!pending) {
        return;
    }

    const remainingAfterManual = pending.amount - pending.manualApplied;
    const nativeDelta = newScroll - (pending.startScroll + pending.manualApplied);
    const isWrongDirection =
        (remainingAfterManual < 0 && nativeDelta >= -MVCP_POSITION_EPSILON) ||
        (remainingAfterManual > 0 && nativeDelta <= MVCP_POSITION_EPSILON);

    if (Math.abs(remainingAfterManual) <= MVCP_POSITION_EPSILON) {
        state.pendingNativeMVCPAdjust = undefined;
        return;
    }

    if (isWrongDirection) {
        logNativeMVCP("waiting for native consumption", {
            manualApplied: pending.manualApplied,
            nativeDelta,
            newScroll,
            queuedAmount: pending.amount,
            remainingAfterManual,
            startScroll: pending.startScroll,
        });
        return;
    }

    state.pendingNativeMVCPAdjust = undefined;

    const remaining = remainingAfterManual - nativeDelta;

    if (Math.abs(remaining) > MVCP_POSITION_EPSILON) {
        logNativeMVCP("apply native remainder", {
            manualApplied: pending.manualApplied,
            nativeDelta,
            newScroll,
            queuedAmount: pending.amount,
            remaining,
            remainingAfterManual,
            startScroll: pending.startScroll,
        });
        requestAdjust(ctx, remaining, true);
    } else {
        logNativeMVCP("native consumed full mvcp", {
            manualApplied: pending.manualApplied,
            nativeDelta,
            newScroll,
            queuedAmount: pending.amount,
            remaining,
            remainingAfterManual,
            startScroll: pending.startScroll,
        });
    }
}

export function prepareMVCP(ctx: StateContext, dataChanged?: boolean): (() => void) | undefined {
    const state = ctx.state;
    const { idsInView, positions, props } = state;
    const {
        maintainVisibleContentPosition: { data: mvcpData, size: mvcpScroll, shouldRestorePosition },
    } = props;
    const isWeb = Platform.OS === "web";

    const now = Date.now();
    const enableMVCPAnchorLock = isWeb && (!!dataChanged || !!state.mvcpAnchorLock);
    const scrollingTo = state.scrollingTo;
    const anchorLock = isWeb ? resolveAnchorLock(state, enableMVCPAnchorLock, mvcpData, now) : undefined;

    let prevPosition: number | undefined;
    let preparedTargetIndex: number | undefined;
    let targetId: string | undefined;
    const idsInViewWithPositions: {
        containerColumn: number | undefined;
        containerIndex: number | undefined;
        containerPosition: number | undefined;
        containerSpan: number | undefined;
        id: string;
        index: number;
        position: number;
    }[] = [];
    const scrollTarget = scrollingTo?.index;
    const scrollingToViewPosition = scrollingTo?.viewPosition;
    const isEndAnchoredScrollTarget =
        scrollTarget !== undefined &&
        state.props.data.length > 0 &&
        scrollTarget >= state.props.data.length - 1 &&
        (scrollingToViewPosition ?? 0) > 0;

    const shouldMVCP = dataChanged ? mvcpData : mvcpScroll;
    const indexByKey = state.indexByKey;
    const prevScroll = state.scroll;
    const prevTotalSize = getContentSize(ctx);
    if (shouldMVCP) {
        if (
            !isWeb &&
            state.pendingNativeMVCPAdjust &&
            shouldRestorePosition === undefined &&
            scrollTarget === undefined
        ) {
            maybeApplyPredictedNativeMVCPAdjust(ctx);
            logNativeMVCP("skip follow-up native mvcp pass", {
                dataChanged,
                manualApplied: state.pendingNativeMVCPAdjust.manualApplied,
                queuedAmount: state.pendingNativeMVCPAdjust.amount,
                startScroll: state.pendingNativeMVCPAdjust.startScroll,
            });
            return undefined;
        }

        if (anchorLock && scrollTarget === undefined) {
            targetId = anchorLock.id;
            prevPosition = anchorLock.position;
        } else if (scrollTarget !== undefined) {
            if (!IsNewArchitecture && scrollingTo?.isInitialScroll) {
                // In old architecture, we don't want to do MVCP for the initial scroll
                // because it can cause inaccuracy
                return undefined;
            }
            // If we're currently scrolling to a target index, do MVCP for its position
            targetId = getId(state, scrollTarget);
        } else if (idsInView.length > 0 && state.didContainersLayout && !dataChanged) {
            // Do MVCP for the first item fully in view
            targetId = idsInView.find((id) => indexByKey.get(id) !== undefined);
        }

        if (dataChanged && idsInView.length > 0 && state.didContainersLayout) {
            // Capture visible anchors for fallback in case the primary anchor disappears after data updates.
            for (let i = 0; i < idsInView.length; i++) {
                const id = idsInView[i];
                const index = indexByKey.get(id);
                if (index !== undefined) {
                    const position = positions[index];
                    if (position !== undefined) {
                        const containerIndex = state.containerItemKeys.get(id);
                        idsInViewWithPositions.push({
                            containerColumn:
                                containerIndex !== undefined
                                    ? ctx.values.get(`containerColumn${containerIndex}`)
                                    : undefined,
                            containerIndex,
                            containerPosition:
                                containerIndex !== undefined
                                    ? ctx.values.get(`containerPosition${containerIndex}`)
                                    : undefined,
                            containerSpan:
                                containerIndex !== undefined
                                    ? ctx.values.get(`containerSpan${containerIndex}`)
                                    : undefined,
                            id,
                            index,
                            position,
                        });
                    }
                }
            }
        }

        if (targetId !== undefined && prevPosition === undefined) {
            const targetIndex = indexByKey.get(targetId);
            if (targetIndex !== undefined) {
                preparedTargetIndex = targetIndex;
                prevPosition = positions[targetIndex];
            }
        }

        // Return a function to do MVCP based on the prepared values
        return () => {
            let positionDiff = 0;
            let anchorIdForLock = anchorLock?.id;
            let anchorPositionForLock: number | undefined;
            let selectedAnchorId: string | undefined;
            let selectedAnchorNewContainerColumn: number | undefined;
            let selectedAnchorNewContainerIndex: number | undefined;
            let selectedAnchorNewContainerPosition: number | undefined;
            let selectedAnchorNewContainerSpan: number | undefined;
            let selectedAnchorNewIndex: number | undefined;
            let selectedAnchorPrevContainerColumn: number | undefined;
            let selectedAnchorPrevContainerIndex: number | undefined;
            let selectedAnchorPrevContainerPosition: number | undefined;
            let selectedAnchorPrevContainerSpan: number | undefined;
            let selectedAnchorPrevIndex: number | undefined;
            let selectedAnchorNewPosition: number | undefined;
            let selectedAnchorPrevPosition: number | undefined;
            let selectedAnchorSource: "fallback" | "target" | "none" = "none";
            let skipTargetAnchor = false;
            const data = state.props.data;

            // Respect shouldRestorePosition for locked anchors when data changes invalidate the old target.
            const shouldValidateLockedAnchor =
                isWeb &&
                dataChanged &&
                mvcpData &&
                scrollTarget === undefined &&
                targetId !== undefined &&
                anchorLock?.id === targetId &&
                shouldRestorePosition !== undefined;
            if (shouldValidateLockedAnchor && targetId !== undefined) {
                const index = indexByKey.get(targetId);
                if (index !== undefined) {
                    const item = data[index];
                    skipTargetAnchor = item === undefined || !shouldRestorePosition(item, index, data);
                    if (skipTargetAnchor && anchorLock?.id === targetId) {
                        state.mvcpAnchorLock = undefined;
                    }
                }
            }

            // If data changed then we need to find the first item fully in view
            // which was exists in the new data
            const shouldUseFallbackVisibleAnchor =
                dataChanged &&
                mvcpData &&
                scrollTarget === undefined &&
                (() => {
                    if (targetId === undefined || skipTargetAnchor) {
                        return true;
                    }
                    const targetIndex = indexByKey.get(targetId);
                    return targetIndex === undefined || positions[targetIndex] === undefined;
                })();
            if (shouldUseFallbackVisibleAnchor) {
                for (let i = 0; i < idsInViewWithPositions.length; i++) {
                    const {
                        containerColumn,
                        containerIndex,
                        containerPosition,
                        containerSpan,
                        id,
                        index: prevIndex,
                        position,
                    } = idsInViewWithPositions[i];
                    const index = indexByKey.get(id);
                    if (index !== undefined && shouldRestorePosition) {
                        const item = data[index];
                        if (item === undefined || !shouldRestorePosition(item, index, data)) {
                            continue;
                        }
                    }
                    const newPosition = index !== undefined ? positions[index] : undefined;
                    if (newPosition !== undefined) {
                        positionDiff = newPosition - position;
                        anchorIdForLock = id;
                        anchorPositionForLock = newPosition;
                        selectedAnchorId = id;
                        selectedAnchorNewContainerColumn =
                            containerIndex !== undefined
                                ? ctx.values.get(`containerColumn${containerIndex}`)
                                : undefined;
                        selectedAnchorNewContainerIndex = containerIndex;
                        selectedAnchorNewContainerPosition =
                            containerIndex !== undefined
                                ? ctx.values.get(`containerPosition${containerIndex}`)
                                : undefined;
                        selectedAnchorNewContainerSpan =
                            containerIndex !== undefined ? ctx.values.get(`containerSpan${containerIndex}`) : undefined;
                        selectedAnchorNewIndex = index;
                        selectedAnchorNewPosition = newPosition;
                        selectedAnchorPrevContainerColumn = containerColumn;
                        selectedAnchorPrevContainerIndex = containerIndex;
                        selectedAnchorPrevContainerPosition = containerPosition;
                        selectedAnchorPrevContainerSpan = containerSpan;
                        selectedAnchorPrevIndex = prevIndex;
                        selectedAnchorPrevPosition = position;
                        selectedAnchorSource = "fallback";
                        break;
                    }
                }
            }

            // If we have a targetId, then we can use the previous position of that item
            if (!skipTargetAnchor && targetId !== undefined && prevPosition !== undefined) {
                const targetIndex = indexByKey.get(targetId);
                const newPosition = targetIndex !== undefined ? positions[targetIndex] : undefined;

                if (newPosition !== undefined) {
                    const totalSize = getContentSize(ctx);
                    let diff = newPosition - prevPosition;

                    if (diff !== 0 && isEndAnchoredScrollTarget && state.scroll + state.scrollLength > totalSize) {
                        // If we're scrolling to the end of the list, then there's two potential issues we workaround:
                        // 1. List items above the scroll target may be in view so we don't want to take too much adjusting
                        // 2. Adjusting too much could cause the list to scroll back up
                        if (diff > 0) {
                            diff = Math.max(0, totalSize - state.scroll - state.scrollLength);
                        } else {
                            diff = 0;
                        }
                    }

                    positionDiff = diff;
                    anchorIdForLock = targetId;
                    anchorPositionForLock = newPosition;
                    const selectedContainerIndex = state.containerItemKeys.get(targetId);
                    selectedAnchorId = targetId;
                    selectedAnchorNewContainerColumn =
                        selectedContainerIndex !== undefined
                            ? ctx.values.get(`containerColumn${selectedContainerIndex}`)
                            : undefined;
                    selectedAnchorNewContainerIndex = selectedContainerIndex;
                    selectedAnchorNewContainerPosition =
                        selectedContainerIndex !== undefined
                            ? ctx.values.get(`containerPosition${selectedContainerIndex}`)
                            : undefined;
                    selectedAnchorNewContainerSpan =
                        selectedContainerIndex !== undefined
                            ? ctx.values.get(`containerSpan${selectedContainerIndex}`)
                            : undefined;
                    selectedAnchorNewIndex = targetIndex;
                    selectedAnchorNewPosition = newPosition;
                    selectedAnchorPrevIndex = preparedTargetIndex;
                    selectedAnchorPrevPosition = prevPosition;
                    selectedAnchorSource = "target";
                }
            }

            if (scrollingToViewPosition && scrollingToViewPosition > 0) {
                const newSize = getItemSize(ctx, targetId!, scrollTarget!, state.props.data[scrollTarget!]);
                const prevSize = scrollingTo?.itemSize;
                if (newSize !== undefined && prevSize !== undefined && newSize !== prevSize) {
                    const diff = newSize - prevSize;
                    if (diff !== 0) {
                        positionDiff += diff * scrollingToViewPosition!;
                        scrollingTo.itemSize = newSize;
                    }
                }
            }

            updateAnchorLock(state, {
                anchorId: anchorIdForLock,
                anchorPosition: anchorPositionForLock,
                dataChanged,
                now,
                positionDiff,
            });

            const nextTotalSize = getContentSize(ctx);
            const prevMaxScroll = Math.max(0, prevTotalSize - state.scrollLength);
            const nextMaxScroll = Math.max(0, nextTotalSize - state.scrollLength);
            const predictedNativeClamp = Math.min(0, nextMaxScroll - Math.min(prevScroll, prevMaxScroll));
            const predictedImmediateAdjust = positionDiff - Math.max(positionDiff, predictedNativeClamp);
            if (!isWeb && dataChanged && mvcpData) {
                logNativeMVCP("native anchor selection", {
                    fallbackAnchors: idsInViewWithPositions.slice(0, 5),
                    idsInView: idsInView.slice(0, 5),
                    nextMaxScroll,
                    nextTotalSize,
                    positionDiff,
                    predictedImmediateAdjust,
                    predictedNativeClamp,
                    preparedTargetIndex,
                    prevMaxScroll,
                    prevPosition,
                    prevScroll,
                    prevTotalSize,
                    scrollLength: state.scrollLength,
                    selectedAnchorId,
                    selectedAnchorNewContainerColumn,
                    selectedAnchorNewContainerIndex,
                    selectedAnchorNewContainerPosition,
                    selectedAnchorNewContainerSpan,
                    selectedAnchorNewIndex,
                    selectedAnchorNewPosition,
                    selectedAnchorPrevContainerColumn,
                    selectedAnchorPrevContainerIndex,
                    selectedAnchorPrevContainerPosition,
                    selectedAnchorPrevContainerSpan,
                    selectedAnchorPrevIndex,
                    selectedAnchorPrevPosition,
                    selectedAnchorSource,
                    shouldUseFallbackVisibleAnchor,
                    skipTargetAnchor,
                    targetId,
                });
            }

            if (
                shouldQueueNativeMVCPAdjust(
                    dataChanged,
                    state,
                    positionDiff,
                    prevTotalSize,
                    prevScroll,
                    scrollTarget,
                    shouldRestorePosition,
                )
            ) {
                state.pendingNativeMVCPAdjust = {
                    amount: positionDiff,
                    manualApplied: 0,
                    startScroll: prevScroll,
                };
                maybeApplyPredictedNativeMVCPAdjust(ctx);
                logNativeMVCP("queue native remainder", {
                    distanceFromEnd: prevTotalSize - prevScroll - state.scrollLength,
                    manualApplied: state.pendingNativeMVCPAdjust.manualApplied,
                    nextMaxScroll,
                    nextTotalSize,
                    positionDiff,
                    predictedImmediateAdjust,
                    predictedNativeClamp,
                    prevMaxScroll,
                    prevScroll,
                    prevTotalSize,
                    queuedAmount: positionDiff,
                    scrollLength: state.scrollLength,
                    startScroll: prevScroll,
                });
                return;
            }

            if (Math.abs(positionDiff) > MVCP_POSITION_EPSILON) {
                if (!isWeb && dataChanged && mvcpData) {
                    logNativeMVCP("request immediate mvcp adjust", {
                        positionDiff,
                        prevScroll,
                        selectedAnchorId,
                        selectedAnchorNewIndex,
                        selectedAnchorNewPosition,
                        selectedAnchorPrevIndex,
                        selectedAnchorPrevPosition,
                        selectedAnchorSource,
                        targetId,
                    });
                }
                requestAdjust(ctx, positionDiff, dataChanged && mvcpData);
            }
        };
    }
}
