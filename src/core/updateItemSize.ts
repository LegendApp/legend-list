import { POSITION_OUT_OF_VIEW } from "@/constants";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { canUseDeferredGeometry } from "@/core/canUseDeferredGeometry";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { setSize } from "@/core/setSize";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { roundSize } from "@/utils/helpers";
import { performInitialScroll } from "@/utils/performInitialScroll";
import { shouldUseWebInitialScrollReplay } from "@/utils/shouldUseWebInitialScrollReplay";

function maybeReplayInitialScrollAfterRecalculate(ctx: StateContext) {
    const state = ctx.state;
    if (Platform.OS !== "web" || !state.didFinishInitialScroll || state.scrollingTo) {
        return;
    }

    const now = Date.now();
    if (state.initialScrollRetryWindowUntil <= 0 || now > state.initialScrollRetryWindowUntil) {
        return;
    }

    if (state.initialScrollLastTargetUsesOffset) {
        return;
    }

    const target = state.initialScrollLastTarget;
    if (!target || target.index === undefined) {
        return;
    }

    let baseOffset: number | undefined;
    const targetId = getId(state, target.index);
    const targetContainerId = state.containerItemKeys.get(targetId);
    if (targetContainerId !== undefined) {
        const actualContainerPosition = peek$(ctx, `containerPosition${targetContainerId}`);
        if (
            actualContainerPosition !== undefined &&
            Number.isFinite(actualContainerPosition) &&
            actualContainerPosition > POSITION_OUT_OF_VIEW
        ) {
            baseOffset = actualContainerPosition;
        }
    }

    if (baseOffset === undefined) {
        if (!shouldUseWebInitialScrollReplay()) {
            return;
        }
        baseOffset = calculateOffsetForIndex(ctx, target.index);
    }

    const resolvedOffset = clampScrollOffset(ctx, calculateOffsetWithOffsetPosition(ctx, baseOffset, target), target);
    const userTakeoverDistance = Math.max(250, state.scrollLength * 0.25);
    const didUserMoveAwayFromResolvedTarget =
        state.scrollHistory.length > 0 && Math.abs(state.scroll - resolvedOffset) > userTakeoverDistance;
    if (target.contentOffset !== undefined && didUserMoveAwayFromResolvedTarget) {
        state.initialScrollRetryWindowUntil = 0;
        return;
    }

    if (Math.abs(resolvedOffset - state.scroll) <= 1) {
        return;
    }

    performInitialScroll(ctx, {
        forceScroll: true,
        initialScrollUsesOffset: false,
        resolvedOffset,
        target,
    });
}

function runOrScheduleMVCPRecalculate(ctx: StateContext) {
    // Runs the MVCP recalculation pass after item-size changes.
    // On web, an active anchor lock coalesces recalculations to one RAF to reduce oscillating adjustments.
    const state = ctx.state;
    if (Platform.OS === "web") {
        const shouldUseInitialScrollReplay = shouldUseWebInitialScrollReplay();
        const isWithinInitialScrollRetryWindow =
            state.initialScrollRetryWindowUntil > 0 && Date.now() <= state.initialScrollRetryWindowUntil;
        const shouldCoalesceWebRecalculate = !!state.mvcpAnchorLock || !!state.scrollingTo || !!state.initialScroll; // ||
        const shouldSkipMVCPForInitialScrollSettling =
            (shouldUseInitialScrollReplay && isWithinInitialScrollRetryWindow) ||
            (shouldUseInitialScrollReplay && (!!state.initialScroll || !!state.scrollingTo?.isInitialScroll));

        if (!shouldCoalesceWebRecalculate) {
            if (state.queuedMVCPRecalculate !== undefined) {
                cancelAnimationFrame(state.queuedMVCPRecalculate);
                state.queuedMVCPRecalculate = undefined;
            }
            const doMVCP = !shouldSkipMVCPForInitialScrollSettling;
            calculateItemsInView(ctx, { doMVCP });
            maybeReplayInitialScrollAfterRecalculate(ctx);
            return;
        }

        if (state.queuedMVCPRecalculate !== undefined) {
            return;
        }

        state.queuedMVCPRecalculate = requestAnimationFrame(() => {
            state.queuedMVCPRecalculate = undefined;
            const doMVCP = !(
                (shouldUseInitialScrollReplay &&
                    state.initialScrollRetryWindowUntil > 0 &&
                    Date.now() <= state.initialScrollRetryWindowUntil) ||
                (shouldUseInitialScrollReplay && (state.initialScroll || state.scrollingTo?.isInitialScroll))
            );
            calculateItemsInView(ctx, {
                doMVCP,
            });
            maybeReplayInitialScrollAfterRecalculate(ctx);
        });
    } else {
        calculateItemsInView(ctx, { doMVCP: true });
    }
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
    const supportsDeferredGeometry = canUseDeferredGeometry(state, peek$(ctx, "numColumns") ?? 1);

    const prevSizeKnown = state.sizesKnown.get(itemKey);

    const diff = updateOneItemSize(ctx, itemKey, sizeObj);
    const size = roundSize(horizontal ? sizeObj.width : sizeObj.height);

    if (diff !== 0) {
        minIndexSizeChanged = minIndexSizeChanged !== undefined ? Math.min(minIndexSizeChanged, index) : index;
        if (supportsDeferredGeometry && state.startNoBuffer >= 0 && index < state.startNoBuffer) {
            state.pendingDeferredSizeShift += diff;
            state.pendingDeferredSizeShiftMinIndex = Math.min(state.pendingDeferredSizeShiftMinIndex, index);
        }

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
            runOrScheduleMVCPRecalculate(ctx);
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
