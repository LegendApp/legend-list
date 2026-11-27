import { ENABLE_DEBUG_VIEW, POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { evaluateBootstrapInitialScroll } from "@/core/bootstrapInitialScroll";
import { createContainerItemMetadata, resolveContainerItemMetadata } from "@/core/containerItemMetadata";
import {
    materializeFixedLayoutStoreRange,
    materializeFixedLayoutStoreRangeAtOffsets,
} from "@/core/fixedLayoutMaterialization";
import { getItemSpaceOffset, getStartOffsetAdjustment } from "@/core/getStartOffsetAdjustment";
import { getDataItem, getDataLength, getIndexedData } from "@/core/IndexedData";
import { resolveInitialScrollOffset } from "@/core/initialScroll";
import { handleInitialScrollLayoutReady } from "@/core/initialScrollLifecycle";
import type { LayoutStore } from "@/core/LayoutStore";
import { getLayoutColumnForStore, getLayoutOffsetForStore, getLayoutSizeForStore } from "@/core/layoutAccessors";
import {
    getActiveLayoutStore,
    getSparseIdCacheSnapshot,
    materializeLayoutStoreRange,
    rebuildLayoutStoreExact,
    reconcileLayoutStoreDataChange,
    syncActiveRowLayoutStoreSpans,
    syncLayoutStoreState,
    syncLayoutStoreStructure,
} from "@/core/layoutStoreLifecycle";
import { prepareMVCP } from "@/core/mvcp";
import { getObservedScrollOffset } from "@/core/observedScroll";
import { resetLayoutCachesForDataChange } from "@/core/resetLayoutCachesForDataChange";
import { scheduleContainerLayout, triggerMountedContainerLayouts } from "@/core/scheduleContainerLayout";
import { reconcileActiveScrollTarget } from "@/core/scrollTo";
import { syncMountedContainer } from "@/core/syncMountedContainer";
import { getViewabilityStartOffset, hasViewabilityConsumers, updateViewableItems } from "@/core/viewability";
import { batchedUpdates } from "@/platform/batchedUpdates";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import { type DeferredListeners, peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState, ScrollAdjustmentSource } from "@/types.internal";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { getExpandedContainerPoolSize } from "@/utils/containerPool";
import { findAvailableContainers } from "@/utils/findAvailableContainers";
import type { DrawDistanceMode } from "@/utils/getEffectiveDrawDistance";
import { getEffectiveDrawDistance, isSparePoolPending } from "@/utils/getEffectiveDrawDistance";
import { getId } from "@/utils/getId";
import { getItemSize, getKnownOrFixedItemSize } from "@/utils/getItemSize";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { isNullOrUndefined } from "@/utils/helpers";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";
import { isHorizontalRTL } from "@/utils/rtl";
import { setDidLayout } from "@/utils/setDidLayout";

const RENDER_RANGE_PROJECTION_FULL_VELOCITY = 4;
const RENDER_RANGE_PROJECTION_SETTLE_DELAY = 100;
const EMPTY_INDEX_SET = new Set<number>();

function getProjectedBufferAdjustment(scrollVelocity: number, trailingBuffer: number) {
    if (trailingBuffer <= 0) {
        return 0;
    }

    const velocityProgress = Math.min(1, Math.abs(scrollVelocity) / RENDER_RANGE_PROJECTION_FULL_VELOCITY);
    return Math.sign(scrollVelocity) * trailingBuffer * velocityProgress;
}

function scheduleRenderRangeProjectionSettle(ctx: StateContext) {
    const state = ctx.state;
    const key = "renderRangeProjection";
    state.renderRangeProjectionSettleAt = performance.now() + RENDER_RANGE_PROJECTION_SETTLE_DELAY;
    if (state.scheduledWork.has(key)) {
        return;
    }

    const settle = () => {
        const remaining = Math.ceil(state.renderRangeProjectionSettleAt! - performance.now());
        if (remaining > 0) {
            state.scheduledWork.timeout(settle, remaining, key);
        } else {
            state.scrollHistory.length = 0;
            state.triggerCalculateItemsInView?.();
        }
    };
    state.scheduledWork.timeout(settle, RENDER_RANGE_PROJECTION_SETTLE_DELAY, key);
}

function findCurrentStickyIndex(layout: LayoutStore | undefined, stickyArray: number[], scroll: number): number {
    for (let i = stickyArray.length - 1; i >= 0; i--) {
        const stickyIndex = stickyArray[i];
        const stickyPos = getLayoutOffsetForStore(layout, stickyIndex);
        if (stickyPos !== undefined && scroll >= stickyPos) {
            return i;
        }
    }
    return -1;
}

function isStickyIndexActive(ctx: StateContext, targetIndex: number): boolean {
    const state = ctx.state;
    let isActive = false;
    for (const containerIndex of state.stickyContainerPool) {
        const key = peek$(ctx, `containerItemKey${containerIndex}`);
        const itemIndex = key ? state.indexByKey.get(key) : undefined;
        if (itemIndex === targetIndex) {
            isActive = true;
            break;
        }
    }

    return isActive;
}

function handleStickyActivation(
    ctx: StateContext,
    stickyArray: number[],
    currentStickyIdx: number,
    needNewContainers: number[],
    needNewContainersSet: Set<number>,
    startBuffered: number,
    endBuffered: number,
): void {
    const state = ctx.state;

    // Update activeStickyIndex to the actual data index (not array position)
    set$(ctx, "activeStickyIndex", currentStickyIdx >= 0 ? stickyArray[currentStickyIdx] : -1);

    // Activate current and previous sticky items, but only if they're not already covered by regular buffered range
    for (let offset = 0; offset <= 1; offset++) {
        const idx = currentStickyIdx - offset;
        if (idx < 0) continue;

        const stickyIndex = stickyArray[idx];
        if (isStickyIndexActive(ctx, stickyIndex)) continue;
        const stickyId = state.idCache[stickyIndex] ?? getId(state, stickyIndex);

        // Only add if it's not already in the regular buffered range and not already in containers
        if (
            stickyId &&
            !state.containerItemKeys.has(stickyId) &&
            (stickyIndex < startBuffered || stickyIndex > endBuffered) &&
            !needNewContainersSet.has(stickyIndex)
        ) {
            needNewContainersSet.add(stickyIndex);
            needNewContainers.push(stickyIndex);
        }
    }
}

function handleStickyRecycling(
    ctx: StateContext,
    layout: LayoutStore | undefined,
    stickyArray: number[],
    scroll: number,
    drawDistance: number,
    currentStickyIdx: number,
    pendingRemoval: number[],
    isPinnedRenderIndex: (itemIndex: number) => boolean,
): void {
    const state = ctx.state;
    for (const containerIndex of state.stickyContainerPool) {
        const itemKey = peek$(ctx, `containerItemKey${containerIndex}`);
        const itemIndex = itemKey ? state.indexByKey.get(itemKey) : undefined;
        if (itemIndex === undefined) continue;
        if (isPinnedRenderIndex(itemIndex)) continue;

        const arrayIdx = stickyArray.indexOf(itemIndex);
        if (arrayIdx === -1) {
            state.stickyContainerPool.delete(containerIndex);
            // Pinned rows join the pool without becoming sticky; releasing them must not re-render them.
            if (peek$(ctx, `containerSticky${containerIndex}`)) {
                set$(ctx, `containerSticky${containerIndex}`, false);
            }
            continue;
        }

        // Keep current and adjacent sticky items, recycle distant ones
        const isRecentSticky = arrayIdx >= currentStickyIdx - 1 && arrayIdx <= currentStickyIdx + 1;
        if (isRecentSticky) continue;

        const nextIndex = stickyArray[arrayIdx + 1];
        let shouldRecycle = false;

        if (nextIndex) {
            const nextPos = getLayoutOffsetForStore(layout, nextIndex);
            shouldRecycle = nextPos !== undefined && scroll > nextPos + drawDistance * 2;
        } else {
            const currentId = state.idCache[itemIndex] ?? getId(state, itemIndex);
            if (currentId) {
                const currentPos = getLayoutOffsetForStore(layout, itemIndex);
                const currentSize =
                    getLayoutSizeForStore(layout, itemIndex) ??
                    getItemSize(ctx, currentId, itemIndex, getDataItem(state, itemIndex));
                shouldRecycle = currentPos !== undefined && scroll > currentPos + currentSize + drawDistance * 3;
            }
        }

        if (shouldRecycle) {
            pendingRemoval.push(containerIndex);
        }
    }
}

interface VisibleRangeState {
    endNoBuffer: number | null;
    firstFullyOnScreenIndex: number | undefined;
    firstVisibleIndex: number | null;
    startNoBuffer: number | null;
}

function trackVisibleRange(
    range: VisibleRangeState,
    i: number,
    top: number,
    size: number,
    scroll: number,
    scrollBottom: number,
    firstVisibleScroll: number | null | undefined,
) {
    let didPassVisibleEnd = false;
    if (range.startNoBuffer === null && top + size > scroll && top <= scrollBottom) {
        range.startNoBuffer = i;
    }
    if (typeof firstVisibleScroll === "number" && range.firstVisibleIndex === null && top + size > firstVisibleScroll) {
        range.firstVisibleIndex = i;
    }
    // Subtract 10px for a little buffer so it can be slightly off screen, but still
    // require the row to begin within the visible window so we don't anchor to the
    // next item below an oversized partially visible row.
    if (range.firstFullyOnScreenIndex === undefined && top >= scroll - 10 && top <= scrollBottom) {
        range.firstFullyOnScreenIndex = i;
    }
    if (range.startNoBuffer !== null) {
        if (top <= scrollBottom) {
            range.endNoBuffer = i;
        } else {
            didPassVisibleEnd = true;
        }
    }

    return didPassVisibleEnd;
}

function getIdsInVisibleRange(state: InternalState, range: VisibleRangeState) {
    const idsInView: string[] = [];
    const firstVisibleAnchorIndex = range.firstFullyOnScreenIndex ?? range.startNoBuffer;
    if (firstVisibleAnchorIndex !== null && firstVisibleAnchorIndex !== undefined && range.endNoBuffer !== null) {
        for (let i = firstVisibleAnchorIndex; i <= range.endNoBuffer; i++) {
            const id = state.idCache[i] ?? getId(state, i);
            idsInView.push(id);
        }
    }

    return idsInView;
}

function getVisibleLoopItemSize(
    ctx: StateContext,
    state: InternalState,
    layout: LayoutStore | undefined,
    index: number,
    id: string,
    preferKnownOrFixedSize: boolean,
) {
    if (!state.didContainersLayout && state.props.getFixedItemSize && getDataItem(state, index) !== undefined) {
        preferKnownOrFixedSize = true;
    }
    return (
        (preferKnownOrFixedSize ? getKnownOrFixedItemSize(ctx, index) : undefined) ??
        getLayoutSizeForStore(layout, index) ??
        getItemSize(ctx, id, index, getDataItem(state, index))
    );
}

function reconcileLayoutStorePinnedIndices(
    ctx: StateContext,
    options: {
        alwaysRenderIndices: number[];
        currentStickyIdx: number;
        dataLength: number;
        hasScrollTargetPinnedRange: boolean;
        scrollTargetPinnedEnd: number;
        scrollTargetPinnedStart: number;
        stickyHeaderIndices: number[];
    },
) {
    const hasStickyIndex = options.currentStickyIdx >= 0 && options.stickyHeaderIndices.length > 0;
    if (options.alwaysRenderIndices.length === 0 && !options.hasScrollTargetPinnedRange && !hasStickyIndex) {
        return;
    }

    let didMaterializeFixedSizes = false;
    const materializeRange = (startIndex: number | undefined, endIndex = startIndex) => {
        if (startIndex !== undefined && endIndex !== undefined && options.dataLength > 0) {
            const start = Math.max(0, Math.min(startIndex, endIndex));
            const end = Math.min(options.dataLength - 1, Math.max(startIndex, endIndex));
            if (start <= end) {
                didMaterializeFixedSizes =
                    materializeFixedLayoutStoreRange(ctx, start, end) || didMaterializeFixedSizes;
                materializeLayoutStoreRange(ctx, start, end);
            }
        }
    };

    for (const index of options.alwaysRenderIndices) {
        materializeRange(index);
    }
    if (options.hasScrollTargetPinnedRange) {
        materializeRange(options.scrollTargetPinnedStart, options.scrollTargetPinnedEnd);
    }
    for (let offset = 0; offset <= 1; offset++) {
        materializeRange(options.stickyHeaderIndices[options.currentStickyIdx - offset]);
    }
    if (didMaterializeFixedSizes) {
        syncLayoutStoreState(ctx);
    }
}

function materializeLayoutStoreOffsetRange(ctx: StateContext, startOffset: number, endOffset: number) {
    const materialized = materializeFixedLayoutStoreRangeAtOffsets(ctx, startOffset, endOffset);
    if (materialized.didChange) {
        syncLayoutStoreState(ctx);
    }
    let range: { end: number; start: number } | undefined;

    if (materialized.range) {
        range = materializeLayoutStoreRange(ctx, materialized.range.start, materialized.range.end);
    }

    return range;
}

function clearUnsafeSizeCaches(state: InternalState) {
    state.sizes.clear();
    state.sizesKnown.clear();
    for (const key in state.averageSizes) {
        delete state.averageSizes[key];
    }
}

function maybeEmitFirstVisibleItemChanged(state: InternalState, index: number | null) {
    const onFirstVisibleItemChanged = state.props.onFirstVisibleItemChanged;
    if (!onFirstVisibleItemChanged || index === null || index < 0 || index >= getDataLength(state)) {
        return;
    }

    const key = state.idCache[index] ?? getId(state, index);
    const previous = state.lastFirstVisibleItemCallback;
    if (previous?.index === index && previous.key === key) {
        return;
    }

    state.lastFirstVisibleItemCallback = { index, key };
    onFirstVisibleItemChanged({ index, item: getDataItem(state, index), key });
}

function updateVisibleRangeForCachedRange(
    ctx: StateContext,
    layout: LayoutStore | undefined,
    viewabilityConfigCallbackPairs: InternalState["viewabilityConfigCallbackPairs"],
    scrollLength: number,
    scroll: number,
    scrollBottom: number,
) {
    const state = ctx.state;
    const { endBuffered, idCache, startBuffered } = state;
    const dataLength = getDataLength(state);

    if (startBuffered === null || endBuffered === null || startBuffered < 0 || endBuffered < startBuffered) {
        return;
    }

    const visibleRange: VisibleRangeState = {
        endNoBuffer: null,
        firstFullyOnScreenIndex: undefined,
        firstVisibleIndex: null,
        startNoBuffer: null,
    };
    const startOffset = getViewabilityStartOffset(state.props.viewabilityConfig);
    const firstVisibleScroll = startOffset >= scrollLength ? null : startOffset > 0 ? scroll + startOffset : undefined;

    for (let i = startBuffered; i <= endBuffered && i < dataLength; i++) {
        const id = idCache[i] ?? getId(state, i);
        const top = getLayoutOffsetForStore(layout, i);
        if (top !== undefined) {
            const size = getVisibleLoopItemSize(ctx, state, layout, i, id, false);
            const didPassVisibleEnd = trackVisibleRange(
                visibleRange,
                i,
                top,
                size,
                scroll,
                scrollBottom,
                firstVisibleScroll,
            );
            if (didPassVisibleEnd) {
                break;
            }
        } else if (visibleRange.startNoBuffer !== null) {
            break;
        }
    }

    Object.assign(state, visibleRange, {
        idsInView: getIdsInVisibleRange(state, visibleRange),
    });

    maybeEmitFirstVisibleItemChanged(
        state,
        firstVisibleScroll === undefined ? visibleRange.startNoBuffer : visibleRange.firstVisibleIndex,
    );

    // An empty item viewport (for example, within a footer) still ends visibility
    // and must revoke any minimum-view-time credit before a row can reenter.
    if (viewabilityConfigCallbackPairs) {
        updateViewableItems(
            ctx,
            viewabilityConfigCallbackPairs,
            scrollLength,
            visibleRange.startNoBuffer ?? -1,
            visibleRange.endNoBuffer ?? -1,
            startBuffered,
            endBuffered,
            layout,
        );
    }
}

export function schedulePendingDataChangeLayout(ctx: StateContext) {
    const state = ctx.state;
    state.scheduledWork.microtask(() => {
        // A normal commit handles this before the microtask. Suspense can keep its
        // layout effects disconnected while the visible list still receives scrolls.
        if (!state.isUnmounted && state.didDataChange && state.layoutDataChangeEpoch !== state.dataChangeEpoch) {
            calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });
        }
    }, "dataChangeLayout");
}

export function calculateItemsInView(
    ctx: StateContext,
    params: {
        doMVCP?: boolean;
        dataChanged?: boolean;
        didMeasureEstimatedLayout?: boolean;
        drawDistanceMode?: DrawDistanceMode;
        forceFullItemPositions?: boolean;
        refreshFixedSizes?: boolean;
        mvcpAdjustmentSource?: ScrollAdjustmentSource;
        initialLayout?: boolean;
        scrollVelocity?: number;
    } = {},
) {
    const state = ctx.state;
    // Measure against the existing layout until the data-change pass reconciles moved keys.
    if (
        state.didDataChange &&
        !state.isFirst &&
        !params.dataChanged &&
        state.layoutDataChangeEpoch !== state.dataChangeEpoch &&
        !state.dataSourceMutationApplied
    ) {
        const indexedData = getIndexedData(state);
        const count = indexedData.getLength();
        for (const key of state.containerItemKeys.keys()) {
            const index = state.indexByKey.get(key);
            if (index === undefined || index >= count || indexedData.getKey(index) !== key) {
                schedulePendingDataChangeLayout(ctx);
                return;
            }
        }
        // Appends leave existing indices in place, so they can reconcile in this pass.
        params = { ...params, dataChanged: true, doMVCP: true };
    }
    batchedUpdates(() => {
        const {
            containerItemKeys,
            idCache,
            indexByKey,
            props: { alwaysRenderIndicesArr, alwaysRenderIndicesSet, keyExtractor, onStickyHeaderChange },
            scrollForNextCalculateItemsInView,
            scrollLength,
            startBufferedId: startBufferedIdOrig,
            viewabilityConfigCallbackPairs: configuredViewabilityConfigCallbackPairs,
        } = state;
        const viewabilityConfigCallbackPairs = hasViewabilityConsumers(ctx, configuredViewabilityConfigCallbackPairs)
            ? configuredViewabilityConfigCallbackPairs
            : undefined;
        const indexedData = getIndexedData(state);
        const legacyData = indexedData.getLegacyData();
        const stickyHeaderIndicesArr = state.props.stickyHeaderIndicesArr || [];
        const stickyHeaderIndicesSet = state.props.stickyHeaderIndicesSet || EMPTY_INDEX_SET;
        const drawDistance = getEffectiveDrawDistance(ctx, params.drawDistanceMode);
        const { didMeasureEstimatedLayout, forceFullItemPositions, initialLayout } = params;
        const dataChanged =
            params.dataChanged && (!state.didDataChange || state.layoutDataChangeEpoch !== state.dataChangeEpoch);
        const { hasEstimatedInitialLayout } = state;
        const didDataChange = !!dataChanged;
        const isInitialLayout = !!initialLayout;
        const bootstrapInitialScrollState = state.initialScroll?.bootstrap;
        const suppressInitialScrollSideEffects = !!bootstrapInitialScrollState;
        const prevNumContainers = peek$(ctx, "numContainers");
        if (scrollLength === 0 || !prevNumContainers) {
            if (didDataChange && !state.isFirst && !state.dataSourceMutationApplied) {
                syncLayoutStoreStructure(ctx);
                reconcileLayoutStoreDataChange(ctx);
                syncLayoutStoreState(ctx);
                state.layoutDataChangeEpoch = state.dataChangeEpoch;
            }
            return;
        }
        const dataLength = indexedData.getLength();
        if (!didDataChange || !getActiveLayoutStore(ctx)) syncLayoutStoreStructure(ctx);
        const scrollTargetPinnedRange = state.scrollTargetPinnedRange;
        let scrollTargetPinnedStart = 0;
        let scrollTargetPinnedEnd = -1;
        if (scrollTargetPinnedRange) {
            scrollTargetPinnedStart = Math.max(0, Math.min(scrollTargetPinnedRange.start, scrollTargetPinnedRange.end));
            scrollTargetPinnedEnd = Math.min(
                dataLength - 1,
                Math.max(scrollTargetPinnedRange.start, scrollTargetPinnedRange.end),
            );
        }
        const hasScrollTargetPinnedRange = scrollTargetPinnedStart <= scrollTargetPinnedEnd;
        const isPinnedRenderIndex = (index: number) =>
            alwaysRenderIndicesSet.has(index) ||
            (hasScrollTargetPinnedRange && index >= scrollTargetPinnedStart && index <= scrollTargetPinnedEnd);

        if ((didDataChange || isInitialLayout) && state.isFirst) {
            syncLayoutStoreState(ctx);
        }
        if (!didDataChange && syncActiveRowLayoutStoreSpans(ctx)) {
            syncLayoutStoreState(ctx);
        }

        // Native RTL rows are positioned within the item extent, before the container minimum.
        const includeContentContainerMinSize = Platform.OS === "web" || !isHorizontalRTL(state);
        let totalSize = getContentSize(ctx, includeContentContainerMinSize);
        let changedContainerIds: Set<number> | undefined;
        const topPad = getStartOffsetAdjustment(ctx);
        const numColumns = peek$(ctx, "numColumns");
        const speed = params.scrollVelocity ?? getScrollVelocity(state);

        ////// Calculate scroll state
        const scrollExtra = 0;
        // Disabled this optimization for now because it was causing blanks to appear sometimes
        // We may need to control speed calculation better, or not have a 5 item history to avoid this issue
        // const scrollExtra = Math.max(-16, Math.min(16, speed)) * 24;

        const { initialScroll, queuedInitialLayout } = state;
        const scrollState = suppressInitialScrollSideEffects
            ? (bootstrapInitialScrollState?.scroll ?? state.scroll)
            : !queuedInitialLayout && hasActiveInitialScroll(state) && initialScroll
              ? // Before the initial layout settles, keep viewport math anchored to the
                // current initial-scroll target instead of transient native adjustments.
                resolveInitialScrollOffset(ctx, initialScroll)
              : state.scroll;

        let scrollAdjustPending = 0;
        let scroll = 0;
        let scrollTopBuffered = 0;
        let scrollBottom = 0;
        let scrollBottomBuffered = 0;
        let nativeScrollState = scrollState;
        const updateScroll = (nextScrollState: number) => {
            nativeScrollState = nextScrollState;
            scrollAdjustPending = peek$(ctx, "scrollAdjustPending") ?? 0;
            // Subtract top padding to put scroll into the coordinate system of the item positions
            scroll = getItemSpaceOffset(ctx, nextScrollState + scrollExtra, scrollAdjustPending, topPad);
            if (!state.props.hasExternalScroll && scroll + scrollLength > totalSize) {
                // Sometimes we may have scrolled past the visible area which can make items at the top of the
                // screen not render. So make sure we clamp scroll to the end.
                scroll = Math.max(0, totalSize - scrollLength);
            }
        };
        updateScroll(scrollState);

        if (ENABLE_DEBUG_VIEW) {
            set$(ctx, "debugRawScroll", scrollState);
            set$(ctx, "debugComputedScroll", scroll);
        }

        let layout = getActiveLayoutStore(ctx);
        const previousStickyIndex = peek$(ctx, "activeStickyIndex");
        const resolveStickyState = () => {
            const currentStickyIdx =
                stickyHeaderIndicesArr.length > 0 ? findCurrentStickyIndex(layout, stickyHeaderIndicesArr, scroll) : -1;
            const nextActiveStickyIndex = currentStickyIdx >= 0 ? stickyHeaderIndicesArr[currentStickyIdx] : -1;
            const stickyIndexDidChange = previousStickyIndex !== nextActiveStickyIndex;
            if (currentStickyIdx >= 0 || previousStickyIndex >= 0) {
                set$(ctx, "activeStickyIndex", nextActiveStickyIndex);
            }
            const shouldNotifyStickyHeaderChange =
                !!onStickyHeaderChange &&
                stickyHeaderIndicesArr.length > 0 &&
                (stickyIndexDidChange || didMeasureEstimatedLayout);
            return {
                currentStickyIdx,
                finishCalculateItemsInView: shouldNotifyStickyHeaderChange
                    ? () => {
                          const item = indexedData.getItem(nextActiveStickyIndex);
                          if (item !== undefined) {
                              onStickyHeaderChange?.({ index: nextActiveStickyIndex, item });
                          }
                      }
                    : undefined,
            };
        };
        let stickyState = didDataChange ? undefined : resolveStickyState();

        let scrollBufferTop = drawDistance;
        let scrollBufferBottom = drawDistance;

        // Settling projection clears velocity, not the direction of the render buffer.
        if (speed !== 0) {
            state.scrollBufferDirection = speed > 0 ? 1 : -1;
        }
        const bufferForward =
            state.scrollBufferDirection === 1 ||
            (state.scrollBufferDirection === undefined && scroll < Math.max(50, drawDistance));
        if (bufferForward) {
            // If we're scrolling fast, or we're at the top of the list and not scrolling
            scrollBufferTop = drawDistance * 0.5;
            scrollBufferBottom = drawDistance * 1.5;
        } else {
            scrollBufferTop = drawDistance * 1.5;
            scrollBufferBottom = drawDistance * 0.5;
        }

        const shouldProjectRenderRange =
            !didDataChange &&
            !forceFullItemPositions &&
            !suppressInitialScrollSideEffects &&
            !hasActiveInitialScroll(state) &&
            !state.scrollingTo &&
            !state.pendingNativeMVCPAdjust &&
            !!peek$(ctx, "readyToRender");
        const projectedBufferAdjustment = shouldProjectRenderRange
            ? getProjectedBufferAdjustment(speed, Math.min(scrollBufferTop, scrollBufferBottom))
            : 0;

        const updateScrollRange = () => {
            const scrollStart = state.props.hasExternalScroll ? scroll : Math.max(0, scroll);
            // Preserve a full item-space viewport during native overscroll without
            // treating header/padding offset as visible item space.
            // An external owner's negative offset is preceding content, not native bounce.
            const overscrollBeforeContent = state.props.hasExternalScroll ? 0 : Math.max(0, -nativeScrollState);
            scrollBottom = Math.max(scrollStart, scroll + scrollLength + overscrollBeforeContent);
            scrollTopBuffered = scrollStart - scrollBufferTop + projectedBufferAdjustment;
            scrollBottomBuffered = scrollBottom + scrollBufferBottom + projectedBufferAdjustment;
            if (scrollTopBuffered < 0 && state.didFullDrawDistancePrewarm) {
                // After the first paint, prewarm rows below it so they are mounted before a fling.
                scrollBottomBuffered = Math.max(
                    scrollBottomBuffered,
                    scrollLength + scrollBufferTop + scrollBufferBottom + (state.props.estimatedItemSize ?? 0),
                );
            }
        };
        updateScrollRange();
        const firstVisibleItemStartOffset = getViewabilityStartOffset(state.props.viewabilityConfig);
        let firstVisibleScroll =
            firstVisibleItemStartOffset >= scrollLength
                ? null
                : firstVisibleItemStartOffset > 0
                  ? scroll + firstVisibleItemStartOffset
                  : undefined;

        if (projectedBufferAdjustment !== 0) {
            scheduleRenderRangeProjectionSettle(ctx);
        }

        // Check precomputed scroll range to see if we can skip this check
        if (
            !hasEstimatedInitialLayout &&
            !suppressInitialScrollSideEffects &&
            !didDataChange &&
            !forceFullItemPositions &&
            scrollForNextCalculateItemsInView
        ) {
            const { top, bottom } = scrollForNextCalculateItemsInView;
            if (top === null && bottom === null) {
                state.scrollForNextCalculateItemsInView = undefined;
            } else if (
                (top === null || scrollTopBuffered > top) &&
                (bottom === null || scrollBottomBuffered < bottom)
            ) {
                // On web, MVCP anchor lock still needs a pass even inside the cached range window.
                if (Platform.OS !== "web" || !isInMVCPActiveMode(state)) {
                    updateVisibleRangeForCachedRange(
                        ctx,
                        layout,
                        viewabilityConfigCallbackPairs,
                        scrollLength,
                        scroll,
                        scrollBottom,
                    );
                    stickyState?.finishCalculateItemsInView?.();
                    return;
                }
            }
        }

        // A deferred item-size correction must land in any pass that repositions items, or they move without it.
        const shouldApplyDeferredMVCP =
            !hasEstimatedInitialLayout && !params.doMVCP && state.scheduledWork.has("mvcpRecalculate");
        if (shouldApplyDeferredMVCP) {
            state.scheduledWork.cancel("mvcpRecalculate");
        }
        const doMVCP = !hasEstimatedInitialLayout && (params.doMVCP || shouldApplyDeferredMVCP);
        const mvcpAdjustmentSource = shouldApplyDeferredMVCP ? "item-size" : params.mvcpAdjustmentSource;

        ////// Sync layout store and do MVCP
        // Handle maintainVisibleContentPosition adjustment early, before data-change
        // reconciliation mutates offsets.
        const checkMVCP =
            doMVCP && !suppressInitialScrollSideEffects
                ? prepareMVCP(ctx, didDataChange, mvcpAdjustmentSource)
                : undefined;

        if (didDataChange) {
            syncLayoutStoreStructure(ctx);
            syncActiveRowLayoutStoreSpans(ctx);
        }
        if (params.refreshFixedSizes) {
            rebuildLayoutStoreExact(ctx);
            // The array API refreshes explicit fixed sizes after extraData changes.
            // A source continues to resolve sizes only as its indices are requested.
            if (legacyData) materializeFixedLayoutStoreRange(ctx, 0, dataLength - 1);
        }
        layout = getActiveLayoutStore(ctx);
        const hasActiveLayoutStore = !!layout;
        const didApplyDataSourceMutation = !!state.dataSourceMutationApplied && !state.dataSourceNeedsReset;
        const canReconcileLayoutStoreDataChange =
            didDataChange &&
            !state.isFirst &&
            hasActiveLayoutStore &&
            !state.dataSourceNeedsReset &&
            !didApplyDataSourceMutation &&
            // Index-keyed arrays retain measurements at the same index.
            (state.props.hasReliableKeyExtractor || !state.props.dataSource);
        const previousIdCache = canReconcileLayoutStoreDataChange ? getSparseIdCacheSnapshot(state) : undefined;
        if (didDataChange && !didApplyDataSourceMutation) {
            if (state.dataSourceNeedsReset) {
                // A source reset invalidates geometry, including the keyed cache used
                // to suppress unchanged native measurements. Clear both owners together.
                clearUnsafeSizeCaches(state);
                triggerMountedContainerLayouts(ctx);
            }
            resetLayoutCachesForDataChange(state, {
                includeLayoutStoreMeasurements: !canReconcileLayoutStoreDataChange,
            });
        }

        const shouldMaterializeLayoutStoreRange =
            hasActiveLayoutStore && (!didDataChange || didApplyDataSourceMutation);
        let layoutStoreMaterializedRange = shouldMaterializeLayoutStoreRange
            ? materializeLayoutStoreOffsetRange(ctx, scrollTopBuffered, scrollBottomBuffered)
            : undefined;
        let didReconcileLayoutStoreDataChange = false;

        if (!layoutStoreMaterializedRange && canReconcileLayoutStoreDataChange) {
            didReconcileLayoutStoreDataChange = reconcileLayoutStoreDataChange(ctx, {
                didKeyExtractorChange: state.dataChangeKeyExtractorChanged,
                previousIdCache,
            });
            if (didReconcileLayoutStoreDataChange) {
                layout = getActiveLayoutStore(ctx);
                layoutStoreMaterializedRange = materializeLayoutStoreOffsetRange(
                    ctx,
                    scrollTopBuffered,
                    scrollBottomBuffered,
                );
            }
        }

        if (!layoutStoreMaterializedRange && didDataChange && hasActiveLayoutStore && !didApplyDataSourceMutation) {
            const didFailReliableReconcile = canReconcileLayoutStoreDataChange && !didReconcileLayoutStoreDataChange;
            if (didFailReliableReconcile) {
                clearUnsafeSizeCaches(state);
                triggerMountedContainerLayouts(ctx);
            }
            resetLayoutCachesForDataChange(state);
            rebuildLayoutStoreExact(ctx);
            layout = getActiveLayoutStore(ctx);
            layoutStoreMaterializedRange = materializeLayoutStoreOffsetRange(
                ctx,
                scrollTopBuffered,
                scrollBottomBuffered,
            );
        }

        syncLayoutStoreState(ctx);
        // Advance the position snapshot for later pending renders and the eventual commit.
        if (didDataChange) {
            state.layoutDataChangeEpoch = state.dataChangeEpoch;
        }

        // Appends can grow content size while the scroll offset is unchanged. Refresh the
        // cached content size after positions update so the next scroll-range cache reflects
        // the new tail instead of the pre-update end-of-list.
        totalSize = getContentSize(ctx, includeContentContainerMinSize);
        // Reapply the target after growth: the previous total may have clamped it.
        const previousComputedScroll = scroll;
        updateScroll(nativeScrollState);
        updateScrollRange();
        if (scroll !== previousComputedScroll) {
            layoutStoreMaterializedRange = materializeLayoutStoreOffsetRange(
                ctx,
                scrollTopBuffered,
                scrollBottomBuffered,
            );
            totalSize = getContentSize(ctx, includeContentContainerMinSize);
        }

        let protectedContainerKeys: Set<string> | undefined;
        if (
            didDataChange &&
            doMVCP &&
            state.props.maintainVisibleContentPosition.data &&
            state.didContainersLayout &&
            state.idsInView.length > 0
        ) {
            const shouldRestorePosition = state.props.maintainVisibleContentPosition.shouldRestorePosition;
            protectedContainerKeys = new Set();
            for (const id of state.idsInView) {
                const index = indexByKey.get(id);
                if (index === undefined) continue;
                if (shouldRestorePosition) {
                    const item = indexedData.getItem(index);
                    if (item === undefined || !shouldRestorePosition(item, index, legacyData ?? [])) continue;
                }
                protectedContainerKeys.add(id);
            }
        }
        const scrollBeforeMVCP = state.scroll;
        const scrollAdjustPendingBeforeMVCP = peek$(ctx, "scrollAdjustPending") ?? 0;
        const didRetargetScroll = didDataChange && reconcileActiveScrollTarget(ctx);
        if (!didRetargetScroll) checkMVCP?.();
        const didMVCPAdjustScroll =
            !!checkMVCP &&
            (state.scroll !== scrollBeforeMVCP ||
                (peek$(ctx, "scrollAdjustPending") ?? 0) !== scrollAdjustPendingBeforeMVCP);
        if (didMVCPAdjustScroll) {
            updateScroll(state.scroll);
            updateScrollRange();
        }
        // Native may already have applied and clamped a measurement adjustment before
        // its scroll event arrives. Keep that viewport covered alongside the modeled one.
        const observedNativeScroll =
            Platform.OS !== "web" &&
            mvcpAdjustmentSource === "item-size" &&
            !state.scrollingTo &&
            state.refScroller.current?.getCurrentScrollOffset
                ? getObservedScrollOffset(ctx)
                : undefined;
        const observedItemOffset =
            observedNativeScroll === undefined
                ? scroll
                : getItemSpaceOffset(ctx, observedNativeScroll, scrollAdjustPending, topPad);
        if (
            didMVCPAdjustScroll ||
            (observedNativeScroll !== undefined &&
                (observedItemOffset < scrollTopBuffered || observedItemOffset + scrollLength > scrollBottomBuffered))
        ) {
            scrollTopBuffered = Math.min(scrollTopBuffered, observedItemOffset);
            scrollBottomBuffered = Math.max(scrollBottomBuffered, observedItemOffset + scrollLength);
            layoutStoreMaterializedRange = materializeLayoutStoreOffsetRange(
                ctx,
                scrollTopBuffered,
                scrollBottomBuffered,
            );
            totalSize = getContentSize(ctx, includeContentContainerMinSize);
        }
        firstVisibleScroll =
            firstVisibleItemStartOffset >= scrollLength
                ? null
                : firstVisibleItemStartOffset > 0
                  ? scroll + firstVisibleItemStartOffset
                  : undefined;

        if (didDataChange) {
            stickyState = resolveStickyState();
        }

        ////// Prepare for loop
        let startBuffered: number | null = null;
        let startBufferedId: string | null = null;
        let endBuffered: number | null = null;

        let loopStart: number =
            layoutStoreMaterializedRange?.start ??
            (suppressInitialScrollSideEffects ? bootstrapInitialScrollState?.targetIndexSeed : undefined) ??
            (!didDataChange && startBufferedIdOrig ? indexByKey.get(startBufferedIdOrig) || 0 : 0);

        // Go backwards from the last start position to find the first item that is in view
        // This is an optimization to avoid looping through all items, which could slow down
        // when scrolling at the end of a long list.
        for (let i = loopStart; i >= 0; i--) {
            const id = idCache[i] ?? getId(state, i);
            const top = getLayoutOffsetForStore(layout, i);
            if (top === undefined) {
                break;
            }
            const size = getVisibleLoopItemSize(ctx, state, layout, i, id, hasActiveInitialScroll(state));
            const bottom = top + size;

            if (bottom > scrollTopBuffered) {
                loopStart = i;
            } else {
                break;
            }
        }

        if (numColumns > 1) {
            while (loopStart > 0) {
                const loopColumn = getLayoutColumnForStore(layout, loopStart);
                if (loopColumn === 1 || loopColumn === undefined) {
                    break;
                }
                loopStart -= 1;
            }
        }

        let foundEnd = false;
        let nextTop: number | undefined | null;
        let nextBottom: number | undefined | null;

        const visibleRange: VisibleRangeState = {
            endNoBuffer: null,
            firstFullyOnScreenIndex: undefined,
            firstVisibleIndex: null,
            startNoBuffer: null,
        };

        // Positions come from the layout store; old mounted containers are reconciled
        // separately below. Never scan the skipped gap after an upward scroll jump.
        for (let i = Math.max(0, loopStart); i < dataLength && !foundEnd; i++) {
            const id = idCache[i] ?? getId(state, i);
            const top = getLayoutOffsetForStore(layout, i);
            if (top === undefined && layoutStoreMaterializedRange) {
                break;
            }
            if (top === undefined) {
                continue;
            }
            const size = getVisibleLoopItemSize(ctx, state, layout, i, id, hasActiveInitialScroll(state));

            if (!foundEnd) {
                trackVisibleRange(visibleRange, i, top, size, scroll, scrollBottom, firstVisibleScroll);

                if (startBuffered === null && top + size > scrollTopBuffered) {
                    startBuffered = i;
                    startBufferedId = id;
                    if (scrollTopBuffered < 0) {
                        nextTop = null;
                    } else {
                        nextTop = top;
                    }
                }
                if (startBuffered !== null) {
                    if (top <= scrollBottomBuffered) {
                        endBuffered = i;
                        if (scrollBottomBuffered > totalSize) {
                            nextBottom = null;
                        } else {
                            nextBottom = top + size;
                        }
                    } else {
                        foundEnd = true;
                    }
                } else if (top > scrollBottomBuffered) {
                    foundEnd = true;
                }
            }
        }

        Object.assign(state, visibleRange, {
            endBuffered,
            idsInView: getIdsInVisibleRange(state, visibleRange),
            startBuffered,
            startBufferedId,
        });

        // Precompute the scroll that will be needed for the range to change
        // so it can be skipped if not needed
        if (nextTop !== undefined && nextBottom !== undefined) {
            state.scrollForNextCalculateItemsInView =
                isNullOrUndefined(nextTop) && isNullOrUndefined(nextBottom)
                    ? undefined
                    : {
                          bottom: nextBottom,
                          top: nextTop,
                      };
        } else if (state.props.hasExternalScroll) {
            // A shared owner can keep scrolling while this list is entirely out of range.
            // Re-enter calculation only when the buffer reaches the list again.
            if (scrollBottomBuffered < 0) {
                state.scrollForNextCalculateItemsInView = { bottom: 0, top: null };
            } else if (scrollTopBuffered > totalSize) {
                state.scrollForNextCalculateItemsInView = { bottom: null, top: totalSize };
            }
        }

        let numContainers = prevNumContainers;
        // Reset containers that aren't used anymore because the data has changed
        const pendingRemoval: number[] = [];
        if (didDataChange) {
            for (let i = 0; i < numContainers; i++) {
                const itemKey = peek$(ctx, `containerItemKey${i}`);
                if (!keyExtractor || (itemKey && indexByKey.get(itemKey) === undefined)) {
                    pendingRemoval.push(i);
                }
            }
        }

        if (layoutStoreMaterializedRange) {
            reconcileLayoutStorePinnedIndices(ctx, {
                alwaysRenderIndices: alwaysRenderIndicesArr,
                currentStickyIdx: stickyState?.currentStickyIdx ?? -1,
                dataLength,
                hasScrollTargetPinnedRange,
                scrollTargetPinnedEnd,
                scrollTargetPinnedStart,
                stickyHeaderIndices: stickyHeaderIndicesArr,
            });
        }

        // Container signals notify after the sync loop so each subscriber runs once per pass.
        const deferred: DeferredListeners = new Map();
        // Place newly added items into containers
        if (
            (startBuffered !== null && endBuffered !== null) ||
            alwaysRenderIndicesArr.length ||
            hasScrollTargetPinnedRange
        ) {
            const allocationStart = startBuffered ?? 0;
            const allocationEnd = endBuffered ?? -1;
            const needNewContainers: number[] = [];
            const needNewContainersSet = new Set<number>();
            const addPinnedIndex = (index: number) => {
                if (index >= 0 && index < dataLength) {
                    const id = idCache[index] ?? getId(state, index);
                    const containerIndex = containerItemKeys.get(id);
                    if (containerIndex !== undefined) {
                        state.stickyContainerPool.add(containerIndex);
                    } else if (!isNullOrUndefined(id) && !needNewContainersSet.has(index)) {
                        needNewContainersSet.add(index);
                        needNewContainers.push(index);
                    }
                }
            };

            for (let i = allocationStart; i <= allocationEnd; i++) {
                const id = idCache[i] ?? getId(state, i);
                if (!containerItemKeys.has(id)) {
                    needNewContainersSet.add(i);
                    needNewContainers.push(i);
                }
            }

            for (const index of alwaysRenderIndicesArr) {
                addPinnedIndex(index);
            }
            if (hasScrollTargetPinnedRange) {
                for (let index = scrollTargetPinnedStart; index <= scrollTargetPinnedEnd; index++) {
                    addPinnedIndex(index);
                }
            }

            // Handle sticky item activation
            if (stickyHeaderIndicesArr.length > 0) {
                handleStickyActivation(
                    ctx,
                    stickyHeaderIndicesArr,
                    stickyState?.currentStickyIdx ?? -1,
                    needNewContainers,
                    needNewContainersSet,
                    allocationStart,
                    allocationEnd,
                );
            } else if (previousStickyIndex !== -1) {
                // Clear activeStickyIndex when no sticky indices are configured
                set$(ctx, "activeStickyIndex", -1);
            }

            if (needNewContainers.length > 0) {
                const availableContainerAllocations = findAvailableContainers(
                    ctx,
                    needNewContainers,
                    allocationStart,
                    allocationEnd,
                    pendingRemoval,
                    protectedContainerKeys,
                    // Initial end alignment has no scroll velocity yet. Keep its
                    // target-side rows first until the initial scroll settles.
                    // After a pause velocity can be zero on the first movement;
                    // use its displacement without treating initial insets as motion.
                    hasActiveInitialScroll(state)
                        ? initialScroll?.viewPosition === 1
                        : speed < 0 || (speed === 0 && state.scrollBufferDirection === -1),
                );
                for (const allocation of availableContainerAllocations) {
                    const i = allocation.itemIndex;
                    const containerIndex = allocation.containerIndex;
                    const id = idCache[i] ?? getId(state, i);

                    // Remove old key from cache
                    const oldKey = peek$(ctx, `containerItemKey${containerIndex}`);
                    if (oldKey && oldKey !== id) {
                        containerItemKeys!.delete(oldKey);
                    }
                    // Publish coherent assignment metadata before reactive signals can render the container.
                    // The allocated type also seeds fixed-size resolution without calling getItemType again.
                    state.containerItemMetadata.set(
                        containerIndex,
                        createContainerItemMetadata(state, i, indexedData.getItem(i), allocation.itemType),
                    );

                    if (oldKey !== id) {
                        changedContainerIds ??= new Set();
                        changedContainerIds.add(containerIndex);
                        // Generations distinguish a delayed native measurement from a newer
                        // assignment even if this physical slot later returns to the same key.
                        state.containerItemGenerations[containerIndex] =
                            (state.containerItemGenerations[containerIndex] ?? 0) + 1;

                        // Opted-out lists never publish this signal at all. Containers left
                        // undefined default to ready in the position components, so an opted-out
                        // list pays nothing for the feature.
                        if (state.props.hideItemsUntilMeasured) {
                            // A dynamic row must stay measurable without painting at its
                            // provisional recycled position. A cached size or a fixed size means
                            // measurement has nothing to correct, so those render immediately. The
                            // cheap check runs first so getFixedItemSize is only called for rows
                            // we would otherwise hide.
                            const isLayoutReady =
                                state.sizesKnown.has(id) ||
                                resolveContainerItemMetadata(state, containerIndex, i, indexedData.getItem(i))
                                    .fixedItemSize !== undefined;
                            set$(ctx, `containerLayoutReady${containerIndex}`, isLayoutReady, deferred);
                        }
                    }

                    // Container subscriptions can render synchronously when the key is published.
                    // Make the reverse lookup available first so getRenderedItem can resolve it.
                    indexByKey.set(id, i);
                    set$(ctx, `containerItemKey${containerIndex}`, id, deferred);
                    set$(ctx, `containerItemIndex${containerIndex}`, i, deferred);
                    set$(ctx, `containerItemData${containerIndex}`, indexedData.getItem(i), deferred);

                    // Update cache when adding new item
                    containerItemKeys!.set(id, containerIndex);
                    state.userScrollAnchorReset?.keys.add(id);

                    const containerSticky = `containerSticky${containerIndex}` as const;
                    // Mark as sticky if this item is in stickyHeaderIndices
                    const isSticky = stickyHeaderIndicesSet.has(i);
                    const isPinnedRender = isPinnedRenderIndex(i);
                    if (isSticky) {
                        set$(ctx, containerSticky, true, deferred);
                        // Add container to sticky pool
                        state.stickyContainerPool.add(containerIndex);
                    } else {
                        if (peek$(ctx, containerSticky)) {
                            set$(ctx, containerSticky, false, deferred);
                        }
                        if (isPinnedRender) {
                            // This pool also protects alwaysRender/internal pin containers from reuse.
                            state.stickyContainerPool.add(containerIndex);
                        } else {
                            state.stickyContainerPool.delete(containerIndex);
                        }
                    }

                    if (containerIndex >= numContainers) {
                        numContainers = containerIndex + 1;
                    }
                }

                if (numContainers !== prevNumContainers) {
                    set$(ctx, "numContainers", numContainers);
                    if (numContainers > peek$(ctx, "numContainersPooled")) {
                        set$(
                            ctx,
                            "numContainersPooled",
                            isSparePoolPending(state)
                                ? numContainers
                                : getExpandedContainerPoolSize(dataLength, numContainers),
                        );
                    }
                }
            }

            if (state.userScrollAnchorReset?.keys.size === 0) {
                state.userScrollAnchorReset = undefined;
            }
        }

        // Handle sticky container recycling
        const hasStickyContainers = state.stickyContainerPool.size > 0;
        if (hasStickyContainers) {
            handleStickyRecycling(
                ctx,
                layout,
                stickyHeaderIndicesArr,
                scroll,
                drawDistance,
                stickyState?.currentStickyIdx ?? -1,
                pendingRemoval,
                isPinnedRenderIndex,
            );
        }

        const pendingRemovalSet = pendingRemoval.length > 0 ? new Set(pendingRemoval) : undefined;
        let didChangePositions = false;
        let didChangeIndex = false;
        // Grid spans and RTL positions can change independently of the row tops.
        const canReuseContainerSync = numColumns === 1 && !isHorizontalRTL(state);
        const syncOnlyChanged =
            canReuseContainerSync &&
            state.containerSyncAdjust === scrollAdjustPending &&
            !dataChanged &&
            !state.didDataChange &&
            !forceFullItemPositions &&
            !hasStickyContainers;
        state.containerSyncAdjust = canReuseContainerSync ? scrollAdjustPending : undefined;

        for (let i = 0; i < numContainers; i++) {
            if (syncOnlyChanged && !changedContainerIds?.has(i)) continue;
            const itemKey = peek$(ctx, `containerItemKey${i}`);

            // If it's pending removal, then it's not in view anymore
            if (pendingRemovalSet?.has(i)) {
                // Update cache when removing item
                if (itemKey !== undefined) {
                    containerItemKeys!.delete(itemKey);
                    changedContainerIds ??= new Set();
                    changedContainerIds.add(i);
                    state.containerItemGenerations[i] = (state.containerItemGenerations[i] ?? 0) + 1;
                }

                // Clear metadata when deallocating this physical container.
                state.containerItemMetadata.delete(i);

                // Clear sticky state if this was a sticky container
                if (state.stickyContainerPool.has(i)) {
                    set$(ctx, `containerSticky${i}`, false, deferred);
                    // Remove container from sticky pool
                    state.stickyContainerPool.delete(i);
                }

                set$(ctx, `containerItemKey${i}`, undefined, deferred);
                set$(ctx, `containerItemIndex${i}`, undefined, deferred);
                set$(ctx, `containerItemData${i}`, undefined, deferred);
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW, deferred);
                set$(ctx, `containerColumn${i}`, -1, deferred);
                set$(ctx, `containerSpan${i}`, 1, deferred);
            } else {
                const itemIndex = indexByKey.get(itemKey);
                if (itemIndex !== undefined) {
                    didChangeIndex ||= peek$(ctx, `containerItemIndex${i}`) !== itemIndex;
                    didChangePositions =
                        syncMountedContainer(ctx, i, itemIndex, {
                            deferred,
                            layout,
                            scrollAdjustPending,
                            updateLayout: true,
                        }).didChangePosition || didChangePositions;
                }
            }
        }

        for (const [listener, value] of deferred) {
            listener(value);
        }

        if (changedContainerIds && (IsNewArchitecture || Platform.OS === "web")) {
            scheduleContainerLayout(ctx, changedContainerIds);
        } else if (Platform.OS === "web" && didChangeIndex) {
            // Retained rows changed order; wake the coordinator to sort DOM order without remeasuring.
            set$(ctx, "containerLayoutEpoch", (peek$(ctx, "containerLayoutEpoch") ?? 0) + 1);
        }

        if (Platform.OS === "web" && didChangePositions) {
            set$(ctx, "lastPositionUpdate", Date.now());
        }

        if (hasEstimatedInitialLayout) {
            return;
        }

        if (suppressInitialScrollSideEffects) {
            evaluateBootstrapInitialScroll(ctx);
            return;
        }

        maybeEmitFirstVisibleItemChanged(
            state,
            firstVisibleScroll === undefined ? visibleRange.startNoBuffer : visibleRange.firstVisibleIndex,
        );

        if (!queuedInitialLayout && !state.didContainersLayout) {
            const isInitialLayoutReady = hasActiveInitialScroll(state)
                ? checkAllSizesKnown(state, state.startBuffered, state.endBuffered)
                : checkAllSizesKnown(state, state.startNoBuffer, state.endNoBuffer) ||
                  checkAllSizesKnown(state, state.startBuffered, state.endBuffered);
            if (isInitialLayoutReady) {
                setDidLayout(ctx);
                handleInitialScrollLayoutReady(ctx);
            }
        }

        if (viewabilityConfigCallbackPairs) {
            updateViewableItems(
                ctx,
                viewabilityConfigCallbackPairs,
                scrollLength,
                visibleRange.startNoBuffer ?? -1,
                visibleRange.endNoBuffer ?? -1,
                startBuffered ?? -1,
                endBuffered ?? -1,
                layout,
            );
        }

        stickyState?.finishCalculateItemsInView?.();
    });
}
