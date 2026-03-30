import { calculateItemsInView } from "@/core/calculateItemsInView";
import {
    getDebugDeferredInteractionBurst,
    logDebugDeferredInteraction,
    recordDebugDeferredInteractionBurstDecision,
    startDebugDeferredInteraction,
    startOrContinueDebugDeferredInteractionBurst,
    updateDebugDeferredInteraction,
    updateDebugDeferredInteractionBurstSnapshot,
} from "@/core/debugDeferredInteraction";
import {
    applyDeferredResizeDelta,
    beginDeferredPositions,
    flushDeferredPositionsWithCompensation,
    getDeferredAnchorIndex,
    getDeferredRenderPosition,
    isDeferredPositionsActive,
} from "@/core/deferredPositions";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { setSize } from "@/core/setSize";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { roundSize } from "@/utils/helpers";
import { requestAdjust } from "@/utils/requestAdjust";

function runOrScheduleMVCPRecalculate(ctx: StateContext) {
    // Runs the MVCP recalculation pass after item-size changes.
    // On web, an active anchor lock coalesces recalculations to one RAF to reduce oscillating adjustments.
    const state = ctx.state;
    if (Platform.OS === "web") {
        if (!state.mvcpAnchorLock) {
            if (state.queuedMVCPRecalculate !== undefined) {
                cancelAnimationFrame(state.queuedMVCPRecalculate);
                state.queuedMVCPRecalculate = undefined;
            }
            calculateItemsInView(ctx, { doMVCP: true });
            return;
        }

        if (state.queuedMVCPRecalculate !== undefined) {
            return;
        }

        state.queuedMVCPRecalculate = requestAnimationFrame(() => {
            state.queuedMVCPRecalculate = undefined;
            calculateItemsInView(ctx, { doMVCP: true });
        });
    } else {
        calculateItemsInView(ctx, { doMVCP: true });
    }
}

type DeferredResizeResult = {
    didApplyDeferredResizeDelta: boolean;
    didFlushVisibleInteraction: boolean;
    visibleInteractionAnchorIndex?: number;
    visibleInteractionPreFlushPosition?: number;
};

function getVisibleInteractionSnapshot(ctx: StateContext, index: number, itemKey: string) {
    const state = ctx.state;
    const firstOnScreenIndex = state.startNoBuffer;
    const firstFullyOnScreenIndex = state.firstFullyOnScreenIndex;

    const getSnapshotForIndex = (targetIndex: number | undefined | null) => {
        if (targetIndex === undefined || targetIndex === null) {
            return undefined;
        }
        const targetKey = state.idCache[targetIndex] ?? getId(state, targetIndex);
        return {
            basePosition: state.positions[targetIndex],
            deferredPosition: getDeferredRenderPosition(ctx, targetIndex),
            index: targetIndex,
            key: targetKey,
        };
    };

    return {
        deferredAnchorIndex: getDeferredAnchorIndex(ctx),
        deferredAnchorKey: state.deferredPositions?.anchorKey,
        deferredDrift: state.deferredPositions?.drift,
        firstFullyOnScreen: getSnapshotForIndex(firstFullyOnScreenIndex),
        firstOnScreen: getSnapshotForIndex(firstOnScreenIndex),
        item: {
            basePosition: state.positions[index],
            deferredPosition: getDeferredRenderPosition(ctx, index),
            index,
            key: itemKey,
        },
        scroll: state.scroll,
    };
}

function getVisibleInteractionAnchor(ctx: StateContext, index: number) {
    const state = ctx.state;
    const candidateIndices = [state.startNoBuffer, index, state.firstFullyOnScreenIndex];

    for (const candidateIndex of candidateIndices) {
        if (candidateIndex === undefined || candidateIndex === null) {
            continue;
        }

        const deferredPosition = getDeferredRenderPosition(ctx, candidateIndex);
        if (deferredPosition === undefined) {
            continue;
        }

        return {
            anchorIndex: candidateIndex,
            preFlushRenderedPosition: deferredPosition,
        };
    }

    return {
        anchorIndex: undefined,
        preFlushRenderedPosition: undefined,
    };
}

function maybeApplyDeferredResizeDelta(ctx: StateContext, itemKey: string, index: number, diff: number) {
    const state = ctx.state;
    const hasDeferredInitialScroll = state.deferredPositions?.desiredScrollOffset !== undefined;
    const prependMeasurementWindow = state.prependMeasurementWindow;
    const prependAnchorIndex =
        prependMeasurementWindow && state.indexByKey.get(prependMeasurementWindow.anchorKey) !== undefined
            ? state.indexByKey.get(prependMeasurementWindow.anchorKey)!
            : undefined;
    if (
        prependMeasurementWindow &&
        (prependAnchorIndex === undefined || prependMeasurementWindow.pendingKeys.size === 0 || prependAnchorIndex <= 0)
    ) {
        state.prependMeasurementWindow = undefined;
    } else if (prependMeasurementWindow && prependAnchorIndex !== undefined) {
        prependMeasurementWindow.anchorIndex = prependAnchorIndex;
    }
    const activePrependMeasurementWindow = state.prependMeasurementWindow;
    const isTrackedPrependMeasurement =
        !!activePrependMeasurementWindow &&
        activePrependMeasurementWindow.pendingKeys.has(itemKey) &&
        index < activePrependMeasurementWindow.anchorIndex;
    const deferredPositionsActive = hasDeferredInitialScroll || isDeferredPositionsActive(state);
    const firstOnScreenIndex = state.startNoBuffer;
    const debugResizeInteraction = state.didContainersLayout && diff !== 0;
    if (isTrackedPrependMeasurement) {
        let didFlushVisibleInteraction = false;
        let didApplyDeferredResizeDelta = false;
        if (!state.deferredPositions) {
            beginDeferredPositions(ctx, {
                anchorKey: activePrependMeasurementWindow.anchorKey,
                anchorRenderPosition: activePrependMeasurementWindow.anchorRenderPosition,
                drift: 0,
                minInvalidatedIndex: activePrependMeasurementWindow.minInvalidatedIndex,
            });
        }
        if (diff !== 0) {
            didApplyDeferredResizeDelta = applyDeferredResizeDelta(ctx, itemKey, diff);
        }
        activePrependMeasurementWindow.pendingKeys.delete(itemKey);
        if (activePrependMeasurementWindow.pendingKeys.size === 0) {
            state.prependMeasurementWindow = undefined;
            if (state.deferredPositions && !hasDeferredInitialScroll) {
                flushDeferredPositionsWithCompensation(ctx, "prependSettled");
                didFlushVisibleInteraction = true;
            }
        }
        return {
            didApplyDeferredResizeDelta,
            didFlushVisibleInteraction,
            visibleInteractionAnchorIndex: undefined,
            visibleInteractionPreFlushPosition: undefined,
        } satisfies DeferredResizeResult;
    }
    if (
        diff === 0 ||
        !deferredPositionsActive ||
        (peek$(ctx, "numColumns") ?? 1) !== 1
    ) {
        if (debugResizeInteraction) {
            console.log(`${Date.now()} [debug deferred-anchor] maybeApplyDeferredResizeDelta:skip-preconditions`, {
                deferredPositionsActive,
                deferredAnchorKey: state.deferredPositions?.anchorKey,
                deferredDesiredScrollOffset: state.deferredPositions?.desiredScrollOffset,
                diff,
                firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
                firstOnScreenIndex,
                hasDeferredInitialScroll,
                index,
                itemKey,
                numColumns: peek$(ctx, "numColumns") ?? 1,
                scrollingTo: state.scrollingTo,
                userScrollActive: state.userScrollActive,
            });
        }
        return {
            didApplyDeferredResizeDelta: false,
            didFlushVisibleInteraction: false,
        } satisfies DeferredResizeResult;
    }

    if (firstOnScreenIndex === null || firstOnScreenIndex === undefined || index >= firstOnScreenIndex) {
        let didFlushVisibleInteraction = false;
        let visibleInteractionAnchorIndex: number | undefined;
        let visibleInteractionPreFlushPosition: number | undefined;
        if (state.deferredPositions && !hasDeferredInitialScroll) {
            const visibleInteractionAnchor = getVisibleInteractionAnchor(ctx, index);
            updateDebugDeferredInteraction(state, { phase: "maybeApplyDeferredResizeDelta:flush-visible-interaction" });
            logDebugDeferredInteraction(state, "maybeApplyDeferredResizeDelta:before-visible-flush", {
                compensationAnchorIndex: visibleInteractionAnchor?.anchorIndex,
                preFlushRenderedPosition: visibleInteractionAnchor?.preFlushRenderedPosition,
                snapshot: getVisibleInteractionSnapshot(ctx, index, itemKey),
            });
            if (debugResizeInteraction) {
                const beforeFlushSnapshot = getVisibleInteractionSnapshot(ctx, index, itemKey);
                console.log(`${Date.now()} [debug deferred-anchor] maybeApplyDeferredResizeDelta:flush-visible-interaction`, {
                    beforeFlushSnapshot,
                    compensationAnchorIndex: visibleInteractionAnchor?.anchorIndex,
                    preFlushRenderedPosition: visibleInteractionAnchor?.preFlushRenderedPosition,
                    deferredAnchorKey: state.deferredPositions.anchorKey,
                    deferredDrift: state.deferredPositions.drift,
                    diff,
                    firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
                    firstOnScreenIndex,
                    index,
                    itemKey,
                });
            }
            flushDeferredPositionsWithCompensation(ctx, "visibleInteraction");
            logDebugDeferredInteraction(state, "maybeApplyDeferredResizeDelta:after-visible-flush", {
                compensationAnchorIndex: visibleInteractionAnchor?.anchorIndex,
                preFlushRenderedPosition: visibleInteractionAnchor?.preFlushRenderedPosition,
                snapshot: getVisibleInteractionSnapshot(ctx, index, itemKey),
            });
            if (debugResizeInteraction) {
                console.log(`${Date.now()} [debug deferred-anchor] maybeApplyDeferredResizeDelta:flush-visible-interaction:after`, {
                    afterFlushSnapshot: getVisibleInteractionSnapshot(ctx, index, itemKey),
                    compensationAnchorIndex: visibleInteractionAnchor?.anchorIndex,
                    preFlushRenderedPosition: visibleInteractionAnchor?.preFlushRenderedPosition,
                    diff,
                    itemKey,
                });
            }
            didFlushVisibleInteraction = true;
            visibleInteractionAnchorIndex = visibleInteractionAnchor?.anchorIndex;
            visibleInteractionPreFlushPosition = visibleInteractionAnchor?.preFlushRenderedPosition;
        }
        if (debugResizeInteraction) {
            console.log(`${Date.now()} [debug deferred-anchor] maybeApplyDeferredResizeDelta:skip-visibility`, {
                deferredAnchorKey: state.deferredPositions?.anchorKey,
                diff,
                firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
                firstOnScreenIndex,
                index,
                itemKey,
            });
        }
        return {
            didApplyDeferredResizeDelta: false,
            didFlushVisibleInteraction,
            visibleInteractionAnchorIndex,
            visibleInteractionPreFlushPosition,
        } satisfies DeferredResizeResult;
    }

    let anchorIndex = getDeferredAnchorIndex(ctx);
    if (anchorIndex === undefined) {
        anchorIndex = state.firstFullyOnScreenIndex;
        if (anchorIndex === undefined) {
            if (debugResizeInteraction) {
                console.log(`${Date.now()} [debug deferred-anchor] maybeApplyDeferredResizeDelta:skip-anchor`, {
                    anchorIndex,
                    deferredAnchorKey: state.deferredPositions?.anchorKey,
                    diff,
                    firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
                    firstOnScreenIndex,
                    index,
                    itemKey,
                });
            }
            return {
                didApplyDeferredResizeDelta: false,
                didFlushVisibleInteraction: false,
            } satisfies DeferredResizeResult;
        }

        const anchorKey = state.idCache[anchorIndex] ?? getId(state, anchorIndex);
        const anchorRenderPosition = state.positions[anchorIndex];
        if (!anchorKey || anchorRenderPosition === undefined) {
            if (debugResizeInteraction) {
                console.log(`${Date.now()} [debug deferred-anchor] maybeApplyDeferredResizeDelta:skip-missing-anchor`, {
                    anchorIndex,
                    anchorKey,
                    anchorRenderPosition,
                    diff,
                    index,
                    itemKey,
                });
            }
            return {
                didApplyDeferredResizeDelta: false,
                didFlushVisibleInteraction: false,
            } satisfies DeferredResizeResult;
        }

        beginDeferredPositions(ctx, {
            anchorKey,
            anchorRenderPosition,
            drift: 0,
            minInvalidatedIndex: index + 1,
        });
    }

    const didApply = applyDeferredResizeDelta(ctx, itemKey, diff);
    if (debugResizeInteraction) {
        console.log(`${Date.now()} [debug deferred-anchor] maybeApplyDeferredResizeDelta:result`, {
            anchorIndex,
            deferredAnchorKey: state.deferredPositions?.anchorKey,
            deferredDrift: state.deferredPositions?.drift,
            didApply,
            diff,
            firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
            firstOnScreenIndex,
            index,
            itemKey,
        });
    }
    return {
        didApplyDeferredResizeDelta: didApply,
        didFlushVisibleInteraction: false,
        visibleInteractionAnchorIndex: undefined,
        visibleInteractionPreFlushPosition: undefined,
    } satisfies DeferredResizeResult;
}

export function updateItemSize(ctx: StateContext, itemKey: string, sizeObj: { width: number; height: number }) {
    const state = ctx.state;
    const {
        didContainersLayout,
        sizesKnown,
        props: {
            getFixedItemSize,
            getItemType,
            horizontal,
            suggestEstimatedItemSize,
            onItemSizeChanged,
            data,
            maintainScrollAtEnd,
        },
    } = state;
    if (!data) return;

    const index = state.indexByKey.get(itemKey)!;

    if (getFixedItemSize) {
        if (index === undefined) {
            return;
        }
        const itemData = state.props.data[index];
        if (itemData === undefined) {
            return;
        }
        const type = getItemType ? (getItemType(itemData, index) ?? "") : "";
        const size = getFixedItemSize(itemData, index, type);
        if (size !== undefined && size === sizesKnown.get(itemKey)) {
            return;
        }
    }

    // Need to calculate if haven't all laid out yet
    let needsRecalculate = !didContainersLayout;
    let shouldMaintainScrollAtEnd = false;
    let minIndexSizeChanged: number | undefined;
    let maxOtherAxisSize = peek$(ctx, "otherAxisSize") || 0;

    const prevSizeKnown = state.sizesKnown.get(itemKey);
    const preResizeSnapshot = didContainersLayout ? getVisibleInteractionSnapshot(ctx, index, itemKey) : undefined;

    const diff = updateOneItemSize(ctx, itemKey, sizeObj);
    const size = roundSize(horizontal ? sizeObj.width : sizeObj.height);
    if (didContainersLayout && diff !== 0) {
        const startedAt = Date.now();
        const burst = startOrContinueDebugDeferredInteractionBurst(state, {
            diff,
            index,
            itemKey,
            nextSize: size,
            prevSize: prevSizeKnown,
            snapshot: preResizeSnapshot,
            startedAt,
        });
        startDebugDeferredInteraction(state, {
            diff,
            index,
            itemKey,
            nextSize: size,
            phase: "updateItemSize:start",
            prevSize: prevSizeKnown,
            startedAt,
        });
        recordDebugDeferredInteractionBurstDecision(state, {
            didFirstMeasurement: prevSizeKnown === undefined,
        });
        logDebugDeferredInteraction(state, "updateItemSize:entry", {
            activeBurstId: burst.burstId,
            isBurstOriginUpdate: burst.originIndex === index && burst.originItemKey === itemKey,
            isFirstMeasurement: prevSizeKnown === undefined,
            prevSizeKnown,
            preResizeSnapshot,
        });
        logDebugDeferredInteraction(state, "updateItemSize:burst-call", {
            activeBurstId: burst.burstId,
            isBurstOriginUpdate: burst.originIndex === index && burst.originItemKey === itemKey,
            isFirstMeasurement: prevSizeKnown === undefined,
            nextSize: size,
            prevSizeKnown,
            preResizeSnapshot,
        });
        logDebugDeferredInteraction(state, "updateItemSize:before-size-write", {
            isFirstMeasurement: prevSizeKnown === undefined,
            prevSizeKnown,
            preResizeSnapshot,
            requestedSize: horizontal ? sizeObj.width : sizeObj.height,
        });
        logDebugDeferredInteraction(state, "updateItemSize:after-size-write", {
            isFirstMeasurement: prevSizeKnown === undefined,
            postSizeWriteSnapshot: getVisibleInteractionSnapshot(ctx, index, itemKey),
        });
    }
    const {
        didApplyDeferredResizeDelta,
        didFlushVisibleInteraction,
        visibleInteractionAnchorIndex,
        visibleInteractionPreFlushPosition,
    } = maybeApplyDeferredResizeDelta(
        ctx,
        itemKey,
        index,
        diff,
    );

    if (didContainersLayout && diff !== 0) {
        const activeBurst = getDebugDeferredInteractionBurst(state);
        recordDebugDeferredInteractionBurstDecision(state, {
            didApplyDeferredResizeDelta,
            didFlushVisibleInteraction,
        });
        logDebugDeferredInteraction(state, "updateItemSize:burst-decision", {
            activeBurstId: activeBurst?.burstId,
            didApplyDeferredResizeDelta,
            didFlushVisibleInteraction,
            isFirstMeasurement: prevSizeKnown === undefined,
        });
        logDebugDeferredInteraction(state, "updateItemSize:after-deferred-step", {
            didApplyDeferredResizeDelta,
            didFlushVisibleInteraction,
            isFirstMeasurement: prevSizeKnown === undefined,
            postDeferredSnapshot: getVisibleInteractionSnapshot(ctx, index, itemKey),
        });
        console.log(`${Date.now()} [debug deferred-anchor] updateItemSize:resize`, {
            deferredAnchorIndex: getDeferredAnchorIndex(ctx),
            deferredAnchorKey: state.deferredPositions?.anchorKey,
            deferredDesiredScrollOffset: state.deferredPositions?.desiredScrollOffset,
            deferredDrift: state.deferredPositions?.drift,
            didApplyDeferredResizeDelta,
            diff,
            firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
            firstOnScreenIndex: state.startNoBuffer,
            index,
            isFirstMeasurement: prevSizeKnown === undefined,
            itemKey,
            previousSize: prevSizeKnown,
            size,
        });
    }

    if (diff !== 0) {
        minIndexSizeChanged = minIndexSizeChanged !== undefined ? Math.min(minIndexSizeChanged, index) : index;

        // Check if item is in view
        const { startBuffered, endBuffered } = state;
        needsRecalculate ||= index >= startBuffered && index <= endBuffered;
        if (!needsRecalculate && state.containerItemKeys.has(itemKey)) {
            needsRecalculate = true;
        }

        // Handle other axis size
        if (state.needsOtherAxisSize) {
            const otherAxisSize = horizontal ? sizeObj.height : sizeObj.width;
            maxOtherAxisSize = Math.max(maxOtherAxisSize, otherAxisSize);
        }

        // Check if we should maintain scroll at end
        if (prevSizeKnown !== undefined && Math.abs(prevSizeKnown - size) > 5) {
            shouldMaintainScrollAtEnd = true;
        }

        // Call onItemSizeChanged callback
        onItemSizeChanged?.({
            index,
            itemData: state.props.data[index],
            itemKey,
            previous: size - diff,
            size,
        });
    }

    // Update state with minimum changed index
    if (minIndexSizeChanged !== undefined) {
        state.minIndexSizeChanged =
            state.minIndexSizeChanged !== undefined
                ? Math.min(state.minIndexSizeChanged, minIndexSizeChanged)
                : minIndexSizeChanged;
    }

    // Handle dev warning about estimated size
    if (IS_DEV && suggestEstimatedItemSize && minIndexSizeChanged !== undefined) {
        if (state.timeoutSizeMessage) clearTimeout(state.timeoutSizeMessage);
        state.timeoutSizeMessage = setTimeout(() => {
            state.timeoutSizeMessage = undefined;
            const num = state.sizesKnown.size;
            const avg = state.averageSizes[""]?.avg;
            console.warn(
                `[legend-list] Based on the ${num} items rendered so far, the optimal estimated size is ${avg}.`,
            );
        }, 1000);
    }

    const cur = peek$(ctx, "otherAxisSize");
    if (!cur || maxOtherAxisSize > cur) {
        set$(ctx, "otherAxisSize", maxOtherAxisSize);
    }

    if (didContainersLayout || checkAllSizesKnown(state)) {
        if (needsRecalculate) {
            state.scrollForNextCalculateItemsInView = undefined;
            if (didApplyDeferredResizeDelta) {
                updateDebugDeferredInteraction(state, { phase: "updateItemSize:calculate-after-deferred" });
                logDebugDeferredInteraction(state, "updateItemSize:before-calculateItemsInView", {
                    branch: "deferredResizeDelta",
                    snapshot: getVisibleInteractionSnapshot(ctx, index, itemKey),
                });
                calculateItemsInView(ctx);
                logDebugDeferredInteraction(state, "updateItemSize:after-calculateItemsInView", {
                    branch: "deferredResizeDelta",
                    snapshot: getVisibleInteractionSnapshot(ctx, index, itemKey),
                });
                updateDebugDeferredInteractionBurstSnapshot(
                    state,
                    getVisibleInteractionSnapshot(ctx, index, itemKey),
                );
            } else if (didFlushVisibleInteraction) {
                updateDebugDeferredInteraction(state, { phase: "updateItemSize:after-visible-flush-handoff" });
                logDebugDeferredInteraction(state, "updateItemSize:after-visible-flush-handoff", {
                    visibleInteractionAnchorIndex,
                    visibleInteractionPreFlushPosition,
                    snapshot: getVisibleInteractionSnapshot(ctx, index, itemKey),
                });
                updateDebugDeferredInteractionBurstSnapshot(
                    state,
                    getVisibleInteractionSnapshot(ctx, index, itemKey),
                );
            } else {
                recordDebugDeferredInteractionBurstDecision(state, {
                    didRequestMvcpRecalculate: true,
                });
                updateDebugDeferredInteraction(state, { phase: "updateItemSize:queued-mvcp" });
                logDebugDeferredInteraction(state, "updateItemSize:queue-mvcp-recalculate", {
                    activeBurstId: getDebugDeferredInteractionBurst(state)?.burstId,
                    isFirstMeasurement: prevSizeKnown === undefined,
                    mvcpQueuedInsideActiveBurst: !!getDebugDeferredInteractionBurst(state),
                    snapshot: getVisibleInteractionSnapshot(ctx, index, itemKey),
                });
                runOrScheduleMVCPRecalculate(ctx);
            }
        }
        if (shouldMaintainScrollAtEnd) {
            if (maintainScrollAtEnd?.onItemLayout) {
                doMaintainScrollAtEnd(ctx);
            }
        }
    }
}

export function updateOneItemSize(ctx: StateContext, itemKey: string, sizeObj: { width: number; height: number }) {
    const state = ctx.state;
    const {
        indexByKey,
        sizesKnown,
        averageSizes,
        props: { data, horizontal, getEstimatedItemSize, getItemType, getFixedItemSize },
    } = state;
    if (!data) return 0;

    const index = indexByKey.get(itemKey)!;

    const prevSize = getItemSize(ctx, itemKey, index, data[index]);
    const rawSize = horizontal ? sizeObj.width : sizeObj.height;
    // On web, prefer whole-pixel sizes to avoid cumulative subpixel gaps/overlaps with transforms
    const size = Platform.OS === "web" ? Math.round(rawSize) : roundSize(rawSize);
    const prevSizeKnown = sizesKnown.get(itemKey);
    sizesKnown.set(itemKey, size);

    // Update averages per item type
    // If user has provided getEstimatedItemSize that has precedence over averages
    // Don't update averages if size is 0, because it likely is rendering conditionally
    // and that shouldn't affect averages.
    if (!getEstimatedItemSize && !getFixedItemSize && size > 0) {
        const itemType = getItemType ? (getItemType(data[index], index) ?? "") : "";
        let averages = averageSizes[itemType];
        if (!averages) {
            averages = averageSizes[itemType] = { avg: 0, num: 0 };
        }

        // If averages were just reset then the number might be 0
        if (averages.num === 0) {
            averages.avg = size;
            averages.num++;
        }
        // TODO: It's possible there might be an issue with items toggling to/from 0 as it might skip
        // this first block if previous size was 0. But I think it's won't cause any real problems so it's fine.
        else if (prevSizeKnown !== undefined && prevSizeKnown > 0) {
            // Add the diff / num
            averages.avg += (size - prevSizeKnown) / averages.num;
        } else {
            // Add size to total and divide by new num
            averages.avg = (averages.avg * averages.num + size) / (averages.num + 1);
            averages.num++;
        }
    }

    // Update saved size if it changed
    if (!prevSize || Math.abs(prevSize - size) > 0.1) {
        setSize(ctx, itemKey, size);
        return size - prevSize;
    }
    return 0;
}
