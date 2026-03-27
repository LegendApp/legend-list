import { ensureDeferredGeometryState } from "@/core/deferredPositionState";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import {
    getInitialBootstrapTargetIndex,
    isInitialBootstrapActive,
    resolveInitialBootstrapDesiredOffset,
    syncInitialBootstrapDesiredOffset,
} from "@/core/initialBootstrap";
import { handlePrependTransactionMeasurement } from "@/core/prependTransaction";
import { setSize } from "@/core/setSize";
import { getScrollStabilityState } from "@/core/scrollOwnership";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { logInitialScrollDebug } from "@/utils/debugInitialScroll";
import { IS_DEV } from "@/utils/devEnvironment";
import { getItemSize } from "@/utils/getItemSize";
import { roundSize } from "@/utils/helpers";

type SizeStabilizationOwner = "bootstrap" | "deferred_geometry" | "direct_scroll" | "mvcp";

function getSizeStabilizationOwner(ctx: StateContext, numColumns: number): SizeStabilizationOwner {
    const { state } = ctx;
    if (isInitialBootstrapActive(state)) {
        return "bootstrap";
    }

    const scrollStabilityState = getScrollStabilityState(state, {
        allowDeferredGeometry: true,
        numColumns,
    });

    if (
        state.didFinishInitialScroll &&
        !state.scrollingTo &&
        !!state.props.maintainVisibleContentPosition.size &&
        scrollStabilityState.owner === "mvcp"
    ) {
        return "mvcp";
    }

    if (scrollStabilityState.owner === "deferred_geometry") {
        return "deferred_geometry";
    }

    return "direct_scroll";
}

function runOrScheduleStabilizationRecalculate(ctx: StateContext, stabilizationOwner: SizeStabilizationOwner) {
    // Route item-size driven recalculations through the central trigger so updateItemSize
    // does not call calculateItemsInView directly.
    const state = ctx.state;
    const recalculateParams = {
        doMVCP: stabilizationOwner === "mvcp",
    };
    logInitialScrollDebug("schedule-stabilization-recalculate", {
        doMVCP: recalculateParams.doMVCP,
        initialScroll: !!state.initialScroll,
        isBootstrapActive: isInitialBootstrapActive(state),
        mvcpAnchorLock: !!state.mvcpAnchorLock,
        queuedMVCPRecalculate: state.queuedMVCPRecalculate !== undefined,
        scrollingTo: !!state.scrollingTo,
    });
    if (Platform.OS === "web") {
        const shouldCoalesceWebRecalculate = !!state.mvcpAnchorLock || !!state.scrollingTo || !!state.initialScroll;

        if (!shouldCoalesceWebRecalculate) {
            if (state.queuedMVCPRecalculate !== undefined) {
                cancelAnimationFrame(state.queuedMVCPRecalculate);
                state.queuedMVCPRecalculate = undefined;
            }
            state.triggerCalculateItemsInView?.(recalculateParams);
            return;
        }

        if (state.queuedMVCPRecalculate !== undefined) {
            return;
        }

        state.queuedMVCPRecalculate = requestAnimationFrame(() => {
            state.queuedMVCPRecalculate = undefined;
            state.triggerCalculateItemsInView?.(recalculateParams);
        });
    } else {
        state.triggerCalculateItemsInView?.(recalculateParams);
    }
}

function applyOutOfViewSizeChangeImpact(params: {
    ctx: StateContext;
    diff: number;
    index: number;
    itemKey: string;
    shouldSuppressDeferredSizeShift: boolean;
    stabilizationOwner: SizeStabilizationOwner;
}) {
    const { ctx, diff, index, itemKey, shouldSuppressDeferredSizeShift, stabilizationOwner } = params;
    const state = ctx.state;
    const deferredGeometry = ensureDeferredGeometryState(state);
    const deferredBoundaryIndex = state.firstFullyOnScreenIndex >= 0 ? state.firstFullyOnScreenIndex : state.startNoBuffer;
    const bootstrapTargetIndex = isInitialBootstrapActive(state) ? getInitialBootstrapTargetIndex(state) : undefined;
    const canAbsorbOutOfViewSizeChange =
        stabilizationOwner === "deferred_geometry" || stabilizationOwner === "mvcp";

    let needsRecalculate = false;
    let absorbedByDeferredGeometry = false;

    if (!shouldSuppressDeferredSizeShift && canAbsorbOutOfViewSizeChange) {
        if (bootstrapTargetIndex !== undefined) {
            if (index < bootstrapTargetIndex && !isInitialBootstrapActive(state)) {
                if (stabilizationOwner === "mvcp") {
                    needsRecalculate = true;
                } else {
                    deferredGeometry.pendingSizeShift += diff;
                    absorbedByDeferredGeometry = true;
                }
                logInitialScrollDebug("size-change-before-bootstrap-target", {
                    absorbedByDeferredGeometry,
                    bootstrapTargetIndex,
                    deferredDelta: deferredGeometry.delta,
                    diff,
                    index,
                    needsRecalculate,
                    pendingSizeShift: deferredGeometry.pendingSizeShift,
                    stabilizationOwner,
                });
            } else if (index === bootstrapTargetIndex && state.initialBootstrap) {
                state.initialBootstrap.target.key ??= itemKey;
                syncInitialBootstrapDesiredOffset(state, resolveInitialBootstrapDesiredOffset(ctx), {
                    adjustVisualOffset: isInitialBootstrapActive(state),
                });
            }
        } else if (deferredBoundaryIndex >= 0 && index < deferredBoundaryIndex) {
            if (stabilizationOwner === "mvcp") {
                needsRecalculate = true;
            } else {
                deferredGeometry.pendingSizeShift += diff;
                absorbedByDeferredGeometry = true;
            }
            logInitialScrollDebug("size-change-before-visible-boundary", {
                absorbedByDeferredGeometry,
                deferredBoundaryIndex,
                deferredDelta: deferredGeometry.delta,
                diff,
                index,
                needsRecalculate,
                pendingSizeShift: deferredGeometry.pendingSizeShift,
                stabilizationOwner,
            });
        }
    }

    if (bootstrapTargetIndex !== undefined && isInitialBootstrapActive(state) && index <= bootstrapTargetIndex) {
        needsRecalculate = true;
    }

    return { absorbedByDeferredGeometry, bootstrapTargetIndex, needsRecalculate };
}

function classifyDeferredGeometryRecalculate(params: {
    absorbedByDeferredGeometry: boolean;
    deferredBoundaryIndex: number;
    endBuffered: number;
    endNoBuffer: number;
    index: number;
    needsRecalculateFromBufferedRange: boolean;
    needsRecalculateFromMountedContainer: boolean;
    needsRecalculateFromNoBufferRange: boolean;
    needsRecalculateFromOwnership: boolean;
    startBuffered: number;
    startNoBuffer: number;
    stabilizationOwner: SizeStabilizationOwner;
}) {
    const {
        absorbedByDeferredGeometry,
        deferredBoundaryIndex,
        endBuffered,
        endNoBuffer,
        index,
        needsRecalculateFromBufferedRange,
        needsRecalculateFromMountedContainer,
        needsRecalculateFromNoBufferRange,
        needsRecalculateFromOwnership,
        startBuffered,
        startNoBuffer,
        stabilizationOwner,
    } = params;
    if (stabilizationOwner !== "deferred_geometry") {
        return undefined;
    }
    return {
        absorbedByDeferredGeometry,
        deferredBoundaryIndex,
        index,
        isBeforeDeferredBoundary: deferredBoundaryIndex >= 0 && index < deferredBoundaryIndex,
        isBufferedOnly:
            needsRecalculateFromBufferedRange &&
            !needsRecalculateFromNoBufferRange,
        isMountedOnly:
            needsRecalculateFromMountedContainer &&
            !needsRecalculateFromBufferedRange &&
            !needsRecalculateFromNoBufferRange,
        isTrueVisible: needsRecalculateFromNoBufferRange,
        needsRecalculateFromBufferedRange,
        needsRecalculateFromMountedContainer,
        needsRecalculateFromNoBufferRange,
        needsRecalculateFromOwnership,
        visibleBufferedRange: [startBuffered, endBuffered] as const,
        visibleNoBufferRange: [startNoBuffer, endNoBuffer] as const,
    };
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
    const numColumns = peek$(ctx, "numColumns") ?? 1;
    const activePrependTransaction = state.pendingPrependTransaction;
    const stabilizationOwner = getSizeStabilizationOwner(ctx, numColumns);

    const prevSizeKnown = state.sizesKnown.get(itemKey);

    const diff = updateOneItemSize(ctx, itemKey, sizeObj);
    const size = roundSize(horizontal ? sizeObj.width : sizeObj.height);

    if (diff !== 0) {
        const shouldSuppressDeferredSizeShift = !!activePrependTransaction;
        const {
            absorbedByDeferredGeometry,
            bootstrapTargetIndex,
            needsRecalculate: needsRecalculateFromOwnership,
        } = applyOutOfViewSizeChangeImpact({
            ctx,
            diff,
            index,
            itemKey,
            shouldSuppressDeferredSizeShift,
            stabilizationOwner,
        });
        logInitialScrollDebug("update-item-size", {
            activePrependTransaction: !!activePrependTransaction,
            absorbedByDeferredGeometry,
            bootstrapTargetIndex,
            diff,
            index,
            itemKey,
            stabilizationOwner,
            suppressDeferredSizeShift: shouldSuppressDeferredSizeShift,
        });
        needsRecalculate ||= needsRecalculateFromOwnership;

        const deferredBoundaryIndex =
            state.firstFullyOnScreenIndex >= 0 ? state.firstFullyOnScreenIndex : state.startNoBuffer;
        // Check if item is in view
        const { endBuffered, endNoBuffer, startBuffered, startNoBuffer } = state;
        const isWithinBufferedRange = index >= startBuffered && index <= endBuffered;
        const isWithinNoBufferRange = index >= startNoBuffer && index <= endNoBuffer;
        const isMountedContainer = state.containerItemKeys.has(itemKey);
        const shouldSkipDeferredAbsorbedRecalculate =
            stabilizationOwner === "deferred_geometry" &&
            absorbedByDeferredGeometry &&
            !isWithinBufferedRange &&
            !isWithinNoBufferRange &&
            !isMountedContainer;
        const needsRecalculateFromBufferedRange =
            !shouldSkipDeferredAbsorbedRecalculate && isWithinBufferedRange;
        const needsRecalculateFromNoBufferRange = isWithinNoBufferRange;
        const needsRecalculateFromMountedContainer =
            !shouldSkipDeferredAbsorbedRecalculate && isMountedContainer;
        needsRecalculate ||= needsRecalculateFromBufferedRange || needsRecalculateFromNoBufferRange;
        if (!needsRecalculate && needsRecalculateFromMountedContainer) {
            needsRecalculate = true;
        }

        const shouldTrackMinIndexSizeChanged =
            !absorbedByDeferredGeometry ||
            needsRecalculateFromBufferedRange ||
            needsRecalculateFromNoBufferRange ||
            needsRecalculateFromMountedContainer ||
            needsRecalculateFromOwnership;
        if (shouldTrackMinIndexSizeChanged) {
            minIndexSizeChanged = minIndexSizeChanged !== undefined ? Math.min(minIndexSizeChanged, index) : index;
        }

        logInitialScrollDebug("min-index-size-changed", {
            absorbedByDeferredGeometry,
            deferredBoundaryIndex,
            diff,
            index,
            minIndexSizeChanged,
            needsRecalculate,
            needsRecalculateFromBufferedRange,
            needsRecalculateFromNoBufferRange,
            needsRecalculateFromMountedContainer,
            needsRecalculateFromOwnership,
            endBuffered: state.endBuffered,
            endNoBuffer: state.endNoBuffer,
            firstFullyOnScreenIndex: state.firstFullyOnScreenIndex,
            startBuffered: state.startBuffered,
            startNoBuffer: state.startNoBuffer,
        });
        const deferredRecalculateClassification = classifyDeferredGeometryRecalculate({
            absorbedByDeferredGeometry,
            deferredBoundaryIndex,
            endBuffered,
            endNoBuffer,
            index,
            needsRecalculateFromBufferedRange,
            needsRecalculateFromMountedContainer,
            needsRecalculateFromNoBufferRange,
            needsRecalculateFromOwnership,
            stabilizationOwner,
            startBuffered,
            startNoBuffer,
        });
        if (deferredRecalculateClassification) {
            logInitialScrollDebug("deferred-recalculate-classification", deferredRecalculateClassification);
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

    if (activePrependTransaction && handlePrependTransactionMeasurement(ctx, itemKey)) {
        return;
    }

    if (activePrependTransaction && state.pendingPrependTransaction) {
        return;
    }

    if (didContainersLayout || checkAllSizesKnown(state)) {
        if (needsRecalculate) {
            state.scrollForNextCalculateItemsInView = undefined;
            runOrScheduleStabilizationRecalculate(ctx, stabilizationOwner);
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
