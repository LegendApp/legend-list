import { ENABLE_DEBUG_VIEW, POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { evaluateBootstrapInitialScroll } from "@/core/bootstrapInitialScroll";
import {
    materializeFixedLayoutStoreRange,
    materializeFixedLayoutStoreRangeAtOffsets,
} from "@/core/fixedLayoutMaterialization";
import { getDataItem, getDataLength, getIndexedData } from "@/core/IndexedData";
import { resolveInitialScrollOffset } from "@/core/initialScroll";
import { handleInitialScrollLayoutReady } from "@/core/initialScrollLifecycle";
import { createLayoutAccess, type LayoutAccess } from "@/core/layoutAccessors";
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
import { resetLayoutCachesForDataChange } from "@/core/resetLayoutCachesForDataChange";
import { syncMountedContainer } from "@/core/syncMountedContainer";
import { getViewabilityStartOffset, hasViewabilityConsumers, updateViewableItems } from "@/core/viewability";
import { batchedUpdates } from "@/platform/batchedUpdates";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { getExpandedContainerPoolSize } from "@/utils/containerPool";
import { findAvailableContainers } from "@/utils/findAvailableContainers";
import type { DrawDistanceMode } from "@/utils/getEffectiveDrawDistance";
import { getEffectiveDrawDistance } from "@/utils/getEffectiveDrawDistance";
import { getId } from "@/utils/getId";
import { getItemSize, getKnownOrFixedItemSize } from "@/utils/getItemSize";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { isNullOrUndefined } from "@/utils/helpers";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";
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
    const previousTimeout = state.timeoutRenderRangeProjectionSettle;
    if (previousTimeout !== undefined) {
        clearTimeout(previousTimeout);
        state.timeouts.delete(previousTimeout);
    }

    const timeout: any = setTimeout(() => {
        state.timeoutRenderRangeProjectionSettle = undefined;
        state.timeouts.delete(timeout);
        state.scrollHistory.length = 0;
        state.triggerCalculateItemsInView?.();
    }, RENDER_RANGE_PROJECTION_SETTLE_DELAY);
    state.timeoutRenderRangeProjectionSettle = timeout;
    state.timeouts.add(timeout);
}

function findCurrentStickyIndex(layout: LayoutAccess, stickyArray: number[], scroll: number): number {
    for (let i = stickyArray.length - 1; i >= 0; i--) {
        const stickyIndex = stickyArray[i];
        const stickyPos = layout.getOffset(stickyIndex);
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
    layout: LayoutAccess,
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
            set$(ctx, `containerSticky${containerIndex}`, false);
            continue;
        }

        // Keep current and adjacent sticky items, recycle distant ones
        const isRecentSticky = arrayIdx >= currentStickyIdx - 1 && arrayIdx <= currentStickyIdx + 1;
        if (isRecentSticky) continue;

        const nextIndex = stickyArray[arrayIdx + 1];
        let shouldRecycle = false;

        if (nextIndex) {
            const nextPos = layout.getOffset(nextIndex);
            shouldRecycle = nextPos !== undefined && scroll > nextPos + drawDistance * 2;
        } else {
            const currentId = state.idCache[itemIndex] ?? getId(state, itemIndex);
            if (currentId) {
                const currentPos = layout.getOffset(itemIndex);
                const currentSize =
                    layout.getSize(itemIndex) ?? getItemSize(ctx, currentId, itemIndex, getDataItem(state, itemIndex));
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
    if (range.startNoBuffer === null && top + size > scroll) {
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
    layout: LayoutAccess,
    index: number,
    id: string,
    preferKnownOrFixedSize: boolean,
) {
    return (
        (preferKnownOrFixedSize ? getKnownOrFixedItemSize(ctx, index) : undefined) ??
        layout.getSize(index) ??
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

function findFirstVisibleIndexInCachedRange(ctx: StateContext, layout: LayoutAccess, scroll: number) {
    const state = ctx.state;
    const { endBuffered, idCache, startBuffered } = state;
    const dataLength = getDataLength(state);

    if (startBuffered === null || endBuffered === null || startBuffered < 0 || endBuffered < startBuffered) {
        return null;
    }

    for (let i = startBuffered; i <= endBuffered && i < dataLength; i++) {
        const id = idCache[i] ?? getId(state, i);
        const size = getVisibleLoopItemSize(ctx, state, layout, i, id, false);
        const top = layout.getOffset(i);
        if (top !== undefined && top + size > scroll) {
            return i;
        }
    }

    return null;
}

function updateViewabilityForCachedRange(
    ctx: StateContext,
    layout: LayoutAccess,
    viewabilityConfigCallbackPairs: NonNullable<InternalState["viewabilityConfigCallbackPairs"]>,
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
        const top = layout.getOffset(i);
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

    Object.assign(state, {
        endNoBuffer: visibleRange.endNoBuffer,
        firstFullyOnScreenIndex: visibleRange.firstFullyOnScreenIndex,
        idsInView: getIdsInVisibleRange(state, visibleRange),
        startNoBuffer: visibleRange.startNoBuffer,
    });

    maybeEmitFirstVisibleItemChanged(
        state,
        firstVisibleScroll === undefined ? visibleRange.startNoBuffer : visibleRange.firstVisibleIndex,
    );

    if (visibleRange.startNoBuffer !== null && visibleRange.endNoBuffer !== null) {
        updateViewableItems(
            ctx,
            viewabilityConfigCallbackPairs,
            scrollLength,
            visibleRange.startNoBuffer,
            visibleRange.endNoBuffer,
            startBuffered,
            endBuffered,
            layout,
        );
    }
}

export function calculateItemsInView(
    ctx: StateContext,
    params: {
        doMVCP?: boolean;
        dataChanged?: boolean;
        drawDistanceMode?: DrawDistanceMode;
        forceFullItemPositions?: boolean;
        initialLayout?: boolean;
        scrollVelocity?: number;
    } = {},
) {
    const state = ctx.state;
    batchedUpdates(() => {
        const {
            containerItemKeys,
            enableScrollForNextCalculateItemsInView,
            idCache,
            indexByKey,
            minIndexSizeChanged,
            props: { alwaysRenderIndicesArr, alwaysRenderIndicesSet, getItemType, keyExtractor, onStickyHeaderChange },
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
        const { doMVCP, forceFullItemPositions, initialLayout } = params;
        const didDataChange = !!params.dataChanged;
        const isInitialLayout = !!initialLayout;
        const bootstrapInitialScrollState =
            state.initialScrollSession?.kind === "bootstrap" ? state.initialScrollSession.bootstrap : undefined;
        const suppressInitialScrollSideEffects = !!bootstrapInitialScrollState;
        const prevNumContainers = peek$(ctx, "numContainers");
        if (scrollLength === 0 || !prevNumContainers) {
            return;
        }
        const dataLength = indexedData.getLength();
        syncLayoutStoreStructure(ctx);
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
        if (syncActiveRowLayoutStoreSpans(ctx)) {
            syncLayoutStoreState(ctx);
        }

        let totalSize = getContentSize(ctx);
        const topPad = peek$(ctx, "stylePaddingTop") + peek$(ctx, "alignItemsAtEndPadding") + peek$(ctx, "headerSize");
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
        let scrollAdjustPad = 0;
        let scroll = 0;
        let scrollTopBuffered = 0;
        let scrollBottom = 0;
        let scrollBottomBuffered = 0;
        let nativeScrollState = scrollState;
        const updateScroll = (nextScrollState: number) => {
            nativeScrollState = nextScrollState;
            scrollAdjustPending = peek$(ctx, "scrollAdjustPending") ?? 0;
            scrollAdjustPad = scrollAdjustPending - topPad;
            // Subtract top padding to put scroll into the coordinate system of the item positions
            scroll = Math.round(nextScrollState + scrollExtra + scrollAdjustPad);
            if (scroll + scrollLength > totalSize) {
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

        let layout = createLayoutAccess(ctx, getActiveLayoutStore(ctx));
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
                !!onStickyHeaderChange && stickyHeaderIndicesArr.length > 0 && stickyIndexDidChange;
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

        if (speed > 0 || (speed === 0 && scroll < Math.max(50, drawDistance))) {
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
            const scrollStart = Math.max(0, scroll);
            // Preserve a full item-space viewport during native overscroll without
            // treating header/padding offset as visible item space.
            const overscrollBeforeContent = Math.max(0, -nativeScrollState);
            scrollBottom = Math.max(scrollStart, scroll + scrollLength + overscrollBeforeContent);
            scrollTopBuffered = scrollStart - scrollBufferTop + projectedBufferAdjustment;
            scrollBottomBuffered = scrollBottom + scrollBufferBottom + projectedBufferAdjustment;
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
            enableScrollForNextCalculateItemsInView &&
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
                    if (viewabilityConfigCallbackPairs) {
                        updateViewabilityForCachedRange(
                            ctx,
                            layout,
                            viewabilityConfigCallbackPairs,
                            scrollLength,
                            scroll,
                            scrollBottom,
                        );
                    } else if (state.props.onFirstVisibleItemChanged) {
                        maybeEmitFirstVisibleItemChanged(
                            state,
                            firstVisibleScroll === null
                                ? null
                                : findFirstVisibleIndexInCachedRange(ctx, layout, firstVisibleScroll ?? scroll),
                        );
                    }
                    stickyState?.finishCalculateItemsInView?.();
                    return;
                }
            }
        }

        ////// Sync layout store and do MVCP
        // Handle maintainVisibleContentPosition adjustment early, before data-change
        // reconciliation mutates offsets.
        const checkMVCP = doMVCP && !suppressInitialScrollSideEffects ? prepareMVCP(ctx, didDataChange) : undefined;

        const hasActiveLayoutStore = !!getActiveLayoutStore(ctx);
        const didApplyDataSourceMutation = !!state.dataSourceMutationApplied && !state.dataSourceNeedsReset;
        const shouldReconcileLayoutStoreDataChange =
            !forceFullItemPositions &&
            didDataChange &&
            !state.isFirst &&
            hasActiveLayoutStore &&
            !state.dataSourceNeedsReset &&
            !didApplyDataSourceMutation &&
            state.props.hasReliableKeyExtractor;
        const previousIdCache = shouldReconcileLayoutStoreDataChange ? getSparseIdCacheSnapshot(state) : undefined;
        if (didDataChange && !didApplyDataSourceMutation) {
            resetLayoutCachesForDataChange(state, {
                includeLayoutStoreMeasurements: !shouldReconcileLayoutStoreDataChange,
            });
        }

        if (didApplyDataSourceMutation) {
            layout = createLayoutAccess(ctx, getActiveLayoutStore(ctx));
        }
        const shouldMaterializeLayoutStoreRange =
            hasActiveLayoutStore && (!didDataChange || didApplyDataSourceMutation);
        let layoutStoreMaterializedRange = shouldMaterializeLayoutStoreRange
            ? materializeLayoutStoreOffsetRange(ctx, scrollTopBuffered, scrollBottomBuffered)
            : undefined;
        let didReconcileLayoutStoreDataChange = false;

        if (!layoutStoreMaterializedRange && shouldReconcileLayoutStoreDataChange) {
            didReconcileLayoutStoreDataChange = reconcileLayoutStoreDataChange(ctx, {
                didKeyExtractorChange: state.dataChangeKeyExtractorChanged,
                previousIdCache,
            });
            if (didReconcileLayoutStoreDataChange) {
                layout = createLayoutAccess(ctx, getActiveLayoutStore(ctx));
                layoutStoreMaterializedRange = materializeLayoutStoreOffsetRange(
                    ctx,
                    scrollTopBuffered,
                    scrollBottomBuffered,
                );
            }
        }

        if (!layoutStoreMaterializedRange && didDataChange && hasActiveLayoutStore && !didApplyDataSourceMutation) {
            const didFailReliableReconcile = shouldReconcileLayoutStoreDataChange && !didReconcileLayoutStoreDataChange;
            if (didFailReliableReconcile || !state.props.hasReliableKeyExtractor) {
                clearUnsafeSizeCaches(state);
            }
            resetLayoutCachesForDataChange(state);
            rebuildLayoutStoreExact(ctx);
            layout = createLayoutAccess(ctx, getActiveLayoutStore(ctx));
            layoutStoreMaterializedRange = materializeLayoutStoreOffsetRange(
                ctx,
                scrollTopBuffered,
                scrollBottomBuffered,
            );
        }

        syncLayoutStoreState(ctx);

        // Appends can grow content size while the scroll offset is unchanged. Refresh the
        // cached content size after positions update so the next scroll-range cache reflects
        // the new tail instead of the pre-update end-of-list.
        totalSize = getContentSize(ctx);

        if (minIndexSizeChanged !== undefined) {
            // Clear minIndexSizeChanged after using it for position updates
            state.minIndexSizeChanged = undefined;
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
                if (
                    shouldRestorePosition &&
                    !shouldRestorePosition(indexedData.getItem(index), index, legacyData ?? [])
                )
                    continue;
                protectedContainerKeys.add(id);
            }
        }
        const scrollBeforeMVCP = state.scroll;
        const scrollAdjustPendingBeforeMVCP = peek$(ctx, "scrollAdjustPending") ?? 0;
        checkMVCP?.();
        const didMVCPAdjustScroll =
            !!checkMVCP &&
            (state.scroll !== scrollBeforeMVCP ||
                (peek$(ctx, "scrollAdjustPending") ?? 0) !== scrollAdjustPendingBeforeMVCP);
        if (didMVCPAdjustScroll && (initialScroll || state.scrollingTo)) {
            updateScroll(state.scroll);
            updateScrollRange();
            firstVisibleScroll =
                firstVisibleItemStartOffset >= scrollLength
                    ? null
                    : firstVisibleItemStartOffset > 0
                      ? scroll + firstVisibleItemStartOffset
                      : undefined;
        }

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
            const top = layout.getOffset(i);
            if (top === undefined) {
                break;
            }
            const size = getVisibleLoopItemSize(
                ctx,
                state,
                layout,
                i,
                id,
                isInitialLayout && hasActiveInitialScroll(state),
            );
            const bottom = top + size;

            if (bottom > scrollTopBuffered) {
                loopStart = i;
            } else {
                break;
            }
        }

        if (numColumns > 1) {
            while (loopStart > 0) {
                const loopColumn = layout.getColumn(loopStart);
                if (loopColumn === 1 || loopColumn === undefined) {
                    break;
                }
                loopStart -= 1;
            }
        }

        let foundEnd = false;
        let nextTop: number | undefined | null;
        let nextBottom: number | undefined | null;

        // TODO PERF: Could cache this while looping through numContainers at the end of this function
        // This takes 0.03 ms in an example in the ios simulator
        let maxIndexRendered = 0;
        for (let i = 0; i < prevNumContainers; i++) {
            const key = peek$(ctx, `containerItemKey${i}`);
            if (key !== undefined) {
                const index = indexByKey.get(key);
                if (index !== undefined) {
                    maxIndexRendered = Math.max(maxIndexRendered, index);
                }
            }
        }

        const visibleRange: VisibleRangeState = {
            endNoBuffer: null,
            firstFullyOnScreenIndex: undefined,
            firstVisibleIndex: null,
            startNoBuffer: null,
        };

        // Continue until we've found the end and we've calculated start/end indices of all items in view
        for (let i = Math.max(0, loopStart); i < dataLength && (!foundEnd || i <= maxIndexRendered); i++) {
            const id = idCache[i] ?? getId(state, i);
            const top = layout.getOffset(i);
            if (top === undefined && layoutStoreMaterializedRange) {
                break;
            }
            if (top === undefined) {
                continue;
            }
            const size = getVisibleLoopItemSize(
                ctx,
                state,
                layout,
                i,
                id,
                isInitialLayout && hasActiveInitialScroll(state),
            );

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
                if (visibleRange.startNoBuffer !== null) {
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
                }
            }
        }

        Object.assign(state, {
            endBuffered,
            endNoBuffer: visibleRange.endNoBuffer,
            firstFullyOnScreenIndex: visibleRange.firstFullyOnScreenIndex,
            idsInView: getIdsInVisibleRange(state, visibleRange),
            startBuffered,
            startBufferedId,
            startNoBuffer: visibleRange.startNoBuffer,
        });

        // Precompute the scroll that will be needed for the range to change
        // so it can be skipped if not needed
        if (enableScrollForNextCalculateItemsInView && nextTop !== undefined && nextBottom !== undefined) {
            state.scrollForNextCalculateItemsInView =
                isNullOrUndefined(nextTop) && isNullOrUndefined(nextBottom)
                    ? undefined
                    : {
                          bottom: nextBottom,
                          top: nextTop,
                      };
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

        // Place newly added items into containers
        if (startBuffered !== null && endBuffered !== null) {
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

            for (let i = startBuffered; i <= endBuffered; i++) {
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
                    startBuffered,
                    endBuffered,
                );
            } else if (previousStickyIndex !== -1) {
                // Clear activeStickyIndex when no sticky indices are configured
                set$(ctx, "activeStickyIndex", -1);
            }

            if (needNewContainers.length > 0) {
                const getRequiredItemType = getItemType
                    ? (i: number) => {
                          const item = indexedData.getItem(i);
                          const itemType = item !== undefined ? getItemType(item, i) : undefined;
                          return itemType !== undefined ? String(itemType) : "";
                      }
                    : undefined;

                const availableContainerAllocations = findAvailableContainers(
                    ctx,
                    needNewContainers,
                    startBuffered,
                    endBuffered,
                    pendingRemoval,
                    getRequiredItemType,
                    protectedContainerKeys,
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

                    set$(ctx, `containerItemKey${containerIndex}`, id);
                    set$(ctx, `containerItemData${containerIndex}`, indexedData.getItem(i));

                    // Store item type for type-safe container reuse
                    if (allocation.itemType !== undefined) {
                        state.containerItemTypes.set(containerIndex, allocation.itemType);
                    }

                    // Update cache when adding new item
                    containerItemKeys!.set(id, containerIndex);
                    state.userScrollAnchorReset?.keys.add(id);
                    if (IsNewArchitecture) {
                        // Fabric reports the replacement item's real size from a layout effect.
                        // Defer size-driven recalculation until those expected measurements drain,
                        // otherwise recycled containers can briefly render with stale positions.
                        state.pendingLayoutEffectMeasurements ??= new Set();
                        state.pendingLayoutEffectMeasurements.add(id);
                    }

                    const containerSticky = `containerSticky${containerIndex}` as const;
                    // Mark as sticky if this item is in stickyHeaderIndices
                    const isSticky = stickyHeaderIndicesSet.has(i);
                    const isPinnedRender = isPinnedRenderIndex(i);
                    if (isSticky) {
                        set$(ctx, containerSticky, true);
                        // Add container to sticky pool
                        state.stickyContainerPool.add(containerIndex);
                    } else {
                        if (peek$(ctx, containerSticky)) {
                            set$(ctx, containerSticky, false);
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
                        set$(ctx, "numContainersPooled", getExpandedContainerPoolSize(dataLength, numContainers));
                    }
                }
            }

            if (state.userScrollAnchorReset?.keys.size === 0) {
                state.userScrollAnchorReset = undefined;
            }
        }

        // Handle sticky container recycling
        if (state.stickyContainerPool.size > 0) {
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
        // Update top positions of all containers
        for (let i = 0; i < numContainers; i++) {
            const itemKey = peek$(ctx, `containerItemKey${i}`);

            // If it's pending removal, then it's not in view anymore
            if (pendingRemovalSet?.has(i)) {
                // Update cache when removing item
                if (itemKey !== undefined) {
                    containerItemKeys!.delete(itemKey);
                }

                // Clear container item type when deallocating
                state.containerItemTypes.delete(i);

                // Clear sticky state if this was a sticky container
                if (state.stickyContainerPool.has(i)) {
                    set$(ctx, `containerSticky${i}`, false);
                    // Remove container from sticky pool
                    state.stickyContainerPool.delete(i);
                }

                set$(ctx, `containerItemKey${i}`, undefined);
                set$(ctx, `containerItemData${i}`, undefined);
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${i}`, -1);
                set$(ctx, `containerSpan${i}`, 1);
            } else {
                const itemIndex = indexByKey.get(itemKey);
                if (itemIndex !== undefined) {
                    didChangePositions =
                        syncMountedContainer(ctx, i, itemIndex, {
                            layout,
                            scrollAdjustPending,
                            updateLayout: true,
                        }).didChangePosition || didChangePositions;
                }
            }
        }

        if (Platform.OS === "web" && didChangePositions) {
            set$(ctx, "lastPositionUpdate", Date.now());
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

        if (
            viewabilityConfigCallbackPairs &&
            visibleRange.startNoBuffer !== null &&
            visibleRange.endNoBuffer !== null
        ) {
            if (!didMVCPAdjustScroll) {
                updateViewableItems(
                    ctx,
                    viewabilityConfigCallbackPairs,
                    scrollLength,
                    visibleRange.startNoBuffer,
                    visibleRange.endNoBuffer,
                    startBuffered ?? visibleRange.startNoBuffer,
                    endBuffered ?? visibleRange.endNoBuffer,
                    layout,
                );
            }
        }

        stickyState?.finishCalculateItemsInView?.();
    });
}
