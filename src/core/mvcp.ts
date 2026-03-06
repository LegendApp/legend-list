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

function clearPendingNativeMVCPAdjust(state: StateContext["state"]) {
    const pending = state.pendingNativeMVCPAdjust;
    if (pending?.timeout) {
        clearTimeout(pending.timeout);
    }
    state.pendingNativeMVCPAdjust = undefined;
}

function queueNativeMVCPAdjust(ctx: StateContext, amount: number, startScroll: number) {
    const state = ctx.state;
    clearPendingNativeMVCPAdjust(state);

    state.pendingNativeMVCPAdjust = {
        amount,
        dataChangeEpoch: state.dataChangeEpoch,
        startScroll,
        timeout: undefined,
    };
}

function shouldQueueNativeMVCPAdjust(
    state: StateContext["state"],
    positionDiff: number,
    prevTotalSize: number,
    prevScroll: number,
    scrollTarget: number | undefined,
    shouldRestorePosition: StateContext["state"]["props"]["maintainVisibleContentPosition"]["shouldRestorePosition"],
) {
    if (
        Platform.OS === "web" ||
        !state.dataChangeNeedsScrollUpdate ||
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

export function resolvePendingNativeMVCPAdjust(ctx: StateContext, newScroll: number) {
    const state = ctx.state;
    const pending = state.pendingNativeMVCPAdjust;
    if (!pending) {
        return;
    }

    if (pending.dataChangeEpoch !== state.dataChangeEpoch) {
        clearPendingNativeMVCPAdjust(state);
        return;
    }

    const nativeDelta = newScroll - pending.startScroll;
    const movedInPendingDirection =
        pending.amount < 0
            ? nativeDelta < -MVCP_POSITION_EPSILON
            : pending.amount > 0
              ? nativeDelta > MVCP_POSITION_EPSILON
              : false;
    if (!movedInPendingDirection) {
        return;
    }

    clearPendingNativeMVCPAdjust(state);

    const consumed =
        pending.amount < 0
            ? Math.max(pending.amount, Math.min(0, nativeDelta))
            : Math.min(pending.amount, Math.max(0, nativeDelta));
    const remaining = pending.amount - consumed;

    if (Math.abs(remaining) > MVCP_POSITION_EPSILON) {
        requestAdjust(ctx, remaining, true);
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
    let targetId: string | undefined;
    const idsInViewWithPositions: { id: string; position: number }[] = [];
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
        const pendingNativeMVCPAdjust = state.pendingNativeMVCPAdjust;
        if (
            pendingNativeMVCPAdjust &&
            pendingNativeMVCPAdjust.dataChangeEpoch === state.dataChangeEpoch &&
            !isWeb &&
            shouldRestorePosition === undefined &&
            scrollTarget === undefined
        ) {
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
                        idsInViewWithPositions.push({ id, position });
                    }
                }
            }
        }

        if (targetId !== undefined && prevPosition === undefined) {
            const targetIndex = indexByKey.get(targetId);
            if (targetIndex !== undefined) {
                prevPosition = positions[targetIndex];
            }
        }

        // Return a function to do MVCP based on the prepared values
        return () => {
            let positionDiff = 0;
            let anchorIdForLock = anchorLock?.id;
            let anchorPositionForLock: number | undefined;
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
                    const { id, position } = idsInViewWithPositions[i];
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

            if (
                shouldQueueNativeMVCPAdjust(
                    state,
                    positionDiff,
                    prevTotalSize,
                    prevScroll,
                    scrollTarget,
                    shouldRestorePosition,
                )
            ) {
                queueNativeMVCPAdjust(ctx, positionDiff, prevScroll);
                return;
            }

            if (Math.abs(positionDiff) > MVCP_POSITION_EPSILON) {
                requestAdjust(ctx, positionDiff, dataChanged && mvcpData);
            }
        };
    }
}
