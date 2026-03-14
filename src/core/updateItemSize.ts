import { POSITION_OUT_OF_VIEW } from "@/constants";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { canUseDeferredGeometry } from "@/core/canUseDeferredGeometry";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { isInitialScrollMVCPAnchorActive } from "@/core/initialScrollMVCPAnchor";
import { retryInitialScroll } from "@/core/retryInitialScroll";
import { setSize } from "@/core/setSize";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { roundSize } from "@/utils/helpers";
import { shouldUseSafariWebScrollIgnore } from "@/utils/shouldUseSafariWebScrollIgnore";

function resolveRetriedInitialScrollOffsetFromMeasurements(
    ctx: StateContext,
    target: ScrollIndexWithOffsetAndContentOffset,
) {
    const state = ctx.state;
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
        if (!shouldUseSafariWebScrollIgnore()) {
            return undefined;
        }
        baseOffset = calculateOffsetForIndex(ctx, target.index);
    }

    return clampScrollOffset(ctx, calculateOffsetWithOffsetPosition(ctx, baseOffset, target), target);
}

function shouldSkipWebMVCPForInitialScrollSettling(state: StateContext["state"], shouldReplayInitialScroll: boolean) {
    if (!shouldReplayInitialScroll) {
        return false;
    }

    return isInitialScrollMVCPAnchorActive(state) || !!state.initialScroll || !!state.scrollingTo?.isInitialScroll;
}

function shouldUseInitialScrollReplay() {
    return Platform.OS === "ios" || (Platform.OS === "web" && shouldUseSafariWebScrollIgnore());
}

function runOrScheduleMVCPRecalculate(ctx: StateContext) {
    // Runs the MVCP recalculation pass after item-size changes.
    // On web, an active anchor lock coalesces recalculations to one RAF to reduce oscillating adjustments.
    const state = ctx.state;
    const shouldUseInitialScrollReplayForPlatform = shouldUseInitialScrollReplay();
    if (Platform.OS === "web") {
        const shouldCoalesceWebRecalculate = !!state.mvcpAnchorLock || !!state.scrollingTo || !!state.initialScroll; // ||
        const shouldSkipMVCPForInitialScrollSettling = shouldSkipWebMVCPForInitialScrollSettling(
            state,
            shouldUseInitialScrollReplayForPlatform,
        );

        if (!shouldCoalesceWebRecalculate) {
            if (state.queuedMVCPRecalculate !== undefined) {
                cancelAnimationFrame(state.queuedMVCPRecalculate);
                state.queuedMVCPRecalculate = undefined;
            }
            const doMVCP = !shouldSkipMVCPForInitialScrollSettling;
            calculateItemsInView(ctx, { doMVCP });
            retryInitialScroll(ctx, (target) => resolveRetriedInitialScrollOffsetFromMeasurements(ctx, target));
            return;
        }

        if (state.queuedMVCPRecalculate !== undefined) {
            return;
        }

        state.queuedMVCPRecalculate = requestAnimationFrame(() => {
            state.queuedMVCPRecalculate = undefined;
            const doMVCP = !shouldSkipWebMVCPForInitialScrollSettling(state, shouldUseInitialScrollReplayForPlatform);
            calculateItemsInView(ctx, {
                doMVCP,
            });
            retryInitialScroll(ctx, (target) => resolveRetriedInitialScrollOffsetFromMeasurements(ctx, target));
        });
    } else {
        const doMVCP = !shouldSkipWebMVCPForInitialScrollSettling(state, shouldUseInitialScrollReplayForPlatform);
        calculateItemsInView(ctx, { doMVCP });
        if (shouldUseInitialScrollReplayForPlatform) {
            retryInitialScroll(ctx, (target) => resolveRetriedInitialScrollOffsetFromMeasurements(ctx, target));
        }
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
        const deferredBoundaryIndex =
            state.firstFullyOnScreenIndex >= 0 ? state.firstFullyOnScreenIndex : state.startNoBuffer;
        const usedDeferredSizeShift =
            supportsDeferredGeometry && deferredBoundaryIndex >= 0 && index < deferredBoundaryIndex;
        if (supportsDeferredGeometry && deferredBoundaryIndex >= 0 && index < deferredBoundaryIndex) {
            state.pendingDeferredSizeShift += diff;
            if (IS_DEV) {
                console.log("[legend-list][deferred-debug][updateItemSize]", {
                    deferredBoundaryIndex,
                    diff,
                    firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
                    index,
                    pendingDeferredSizeShift: state.pendingDeferredSizeShift,
                    startBuffered: state.startBuffered,
                    startNoBuffer: state.startNoBuffer,
                    usedDeferredSizeShift: true,
                });
            }
        } else if (diff !== 0 && IS_DEV) {
            console.log("[legend-list][deferred-debug][updateItemSize]", {
                deferredBoundaryIndex,
                diff,
                firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
                index,
                pendingDeferredSizeShift: state.pendingDeferredSizeShift,
                startBuffered: state.startBuffered,
                startNoBuffer: state.startNoBuffer,
                usedDeferredSizeShift: false,
            });
            if (index < deferredBoundaryIndex) {
                console.log("[legend-list][deferred-debug][deferred-blockers]", {
                    dataChangeNeedsScrollUpdate: state.dataChangeNeedsScrollUpdate,
                    deferredBoundaryIndex,
                    didFinishInitialScroll: state.didFinishInitialScroll,
                    firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
                    hasActiveMVCPAnchorLock: hasActiveMVCPAnchorLock(state),
                    ignoreScrollFromMVCP: state.ignoreScrollFromMVCP !== undefined,
                    index,
                    initialScroll: !!state.initialScroll,
                    initialScrollRetryWindowActive: state.initialScrollRetryWindowUntil > Date.now(),
                    pendingNativeMVCPAdjust: !!state.pendingNativeMVCPAdjust,
                    scrollingTo: !!state.scrollingTo,
                    startNoBuffer: state.startNoBuffer,
                    supportsDeferredGeometry,
                    usedDeferredSizeShift,
                });
            }
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
