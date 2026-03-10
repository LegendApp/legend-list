import { ENABLE_DEBUG_VIEW, POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { ensureInitialAnchor } from "@/core/ensureInitialAnchor";
import { INTERNAL_PERF_CONFIG } from "@/core/internalPerfConfig";
import { prepareMVCP } from "@/core/mvcp";
import {
    applyDeferredPositionDelta,
    ensureDeferredPositionBaseline,
    resetDeferredPositionDelta,
    setupDeferredPositionPass,
    shouldDeferPositionDeltaVisualAdjust,
} from "@/core/deferredPositionDelta";
import { type UpdateItemPositionsMetrics, updateItemPositions } from "@/core/updateItemPositions";
import { updateViewableItems } from "@/core/viewability";
import { batchedUpdates } from "@/platform/batchedUpdates";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types.base";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { findAvailableContainers } from "@/utils/findAvailableContainers";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { isNullOrUndefined } from "@/utils/helpers";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";
import { setDidLayout } from "@/utils/setDidLayout";

function findCurrentStickyIndex(stickyArray: number[], scroll: number, state: InternalState): number {
    const positions = state.positions;
    for (let i = stickyArray.length - 1; i >= 0; i--) {
        const stickyIndex = stickyArray[i];
        const stickyPos = positions[stickyIndex];
        if (stickyPos !== undefined && scroll >= stickyPos) {
            return i;
        }
    }
    return -1;
}

function getActiveStickyIndices(ctx: StateContext, stickyHeaderIndices: Set<number>): Set<number> {
    const state = ctx.state;
    return new Set(
        Array.from(state.stickyContainerPool)
            .map((i) => peek$(ctx, `containerItemKey${i}`))
            .map((key) => (key ? state.indexByKey.get(key) : undefined))
            .filter((idx): idx is number => idx !== undefined && stickyHeaderIndices.has(idx)),
    );
}

function handleStickyActivation(
    ctx: StateContext,
    stickyHeaderIndices: Set<number>,
    stickyArray: number[],
    currentStickyIdx: number,
    needNewContainers: number[],
    needNewContainersSet: Set<number>,
    startBuffered: number,
    endBuffered: number,
): void {
    const state = ctx.state;
    const activeIndices = getActiveStickyIndices(ctx, stickyHeaderIndices);

    // Update activeStickyIndex to the actual data index (not array position)
    set$(ctx, "activeStickyIndex", currentStickyIdx >= 0 ? stickyArray[currentStickyIdx] : -1);

    // Activate current and previous sticky items, but only if they're not already covered by regular buffered range
    for (let offset = 0; offset <= 1; offset++) {
        const idx = currentStickyIdx - offset;
        if (idx < 0 || activeIndices.has(stickyArray[idx])) continue;

        const stickyIndex = stickyArray[idx];
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
    stickyArray: number[],
    scroll: number,
    drawDistance: number,
    currentStickyIdx: number,
    pendingRemoval: number[],
    alwaysRenderIndicesSet: Set<number>,
): void {
    const state = ctx.state;
    for (const containerIndex of state.stickyContainerPool) {
        const itemKey = peek$(ctx, `containerItemKey${containerIndex}`);
        const itemIndex = itemKey ? state.indexByKey.get(itemKey) : undefined;
        if (itemIndex === undefined) continue;
        if (alwaysRenderIndicesSet.has(itemIndex)) continue;

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
            const nextPos = state.positions[nextIndex];
            shouldRecycle = nextPos !== undefined && scroll > nextPos + drawDistance * 2;
        } else {
            const currentId = state.idCache[itemIndex] ?? getId(state, itemIndex);
            if (currentId) {
                const currentPos = state.positions[itemIndex];
                const currentSize =
                    state.sizes.get(currentId) ?? getItemSize(ctx, currentId, itemIndex, state.props.data[itemIndex]);
                shouldRecycle = currentPos !== undefined && scroll > currentPos + currentSize + drawDistance * 3;
            }
        }

        if (shouldRecycle) {
            pendingRemoval.push(containerIndex);
        }
    }
}

function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function roundPerfValue(value: number | undefined) {
    return value === undefined ? undefined : Math.round(value * 100) / 100;
}

export function calculateItemsInView(
    ctx: StateContext,
    params: { doMVCP?: boolean; dataChanged?: boolean; forceFullItemPositions?: boolean } = {},
) {
    const state = ctx.state;
    batchedUpdates(() => {
        const {
            columns,
            columnSpans,
            containerItemKeys,
            enableScrollForNextCalculateItemsInView,
            idCache,
            indexByKey,
            initialScroll,
            minIndexSizeChanged,
            positions,
            props: {
                alwaysRenderIndicesArr,
                alwaysRenderIndicesSet,
                drawDistance,
                getItemType,
                itemsAreEqual,
                keyExtractor,
                onStickyHeaderChange,
            },
            scrollForNextCalculateItemsInView,
            scrollLength,
            sizes,
            startBufferedId: startBufferedIdOrig,
            viewabilityConfigCallbackPairs,
        } = state;
        const perfConfig = INTERNAL_PERF_CONFIG;
        const shouldLogPerf = perfConfig.log;
        const perfLabel = perfConfig.label;
        const perfStartedAt = shouldLogPerf ? nowMs() : 0;
        let perfPassId = 0;
        if (shouldLogPerf) {
            state.perfExperimentPassCount = (state.perfExperimentPassCount ?? 0) + 1;
            perfPassId = state.perfExperimentPassCount;
        }
        let updateItemPositionsMetrics: UpdateItemPositionsMetrics | undefined;
        let containerPositionAttempted = 0;
        let containerPositionApplied = 0;
        let containerPositionSuppressed = 0;
        const maxContainerPositionWritesPerPass = perfConfig.maxContainerPositionWritesPerPass;
        let deferredPositionDeltaApplied = 0;
        let deferredPositionMatchCount = 0;
        const setContainerPosition = (containerId: number, position: number) => {
            containerPositionAttempted += 1;
            if (
                maxContainerPositionWritesPerPass !== undefined &&
                containerPositionApplied >= maxContainerPositionWritesPerPass
            ) {
                containerPositionSuppressed += 1;
                return false;
            }

            containerPositionApplied += 1;
            set$(ctx, `containerPosition${containerId}`, position);
            return true;
        };
        const { data } = state.props;
        const stickyIndicesArr = state.props.stickyIndicesArr || [];
        const stickyIndicesSet = state.props.stickyIndicesSet || new Set<number>();
        const alwaysRenderArr = alwaysRenderIndicesArr || [];
        const alwaysRenderSet = alwaysRenderIndicesSet || new Set<number>();
        const { dataChanged, doMVCP, forceFullItemPositions } = params;
        const prevNumContainers = peek$(ctx, "numContainers");
        const numColumnsForDeferredPositionDelta = peek$(ctx, "numColumns") ?? 1;
        const deferredPositionBaseline = ensureDeferredPositionBaseline(state);
        const deferPositionDeltaVisualAdjust = shouldDeferPositionDeltaVisualAdjust(
            state,
            numColumnsForDeferredPositionDelta,
        );
        if (forceFullItemPositions) {
            state.deferredPositionNeedsStablePass = true;
            deferredPositionBaseline.clear();
        }
        if (!data || scrollLength === 0 || !prevNumContainers) {
            resetDeferredPositionDelta(ctx, state, deferredPositionBaseline);
            if (shouldLogPerf) {
                console.log(
                    "[legend-list][perf]",
                    JSON.stringify({
                        event: "calculateItemsInView",
                        label: perfLabel,
                        passId: perfPassId,
                        reason: "not-ready",
                    }),
                );
            }
            if (!IsNewArchitecture && state.initialAnchor) {
                ensureInitialAnchor(ctx);
            }
            return;
        }

        let totalSize = getContentSize(ctx);
        const topPad = peek$(ctx, "stylePaddingTop") + peek$(ctx, "headerSize");
        const numColumns = peek$(ctx, "numColumns");
        const speed = getScrollVelocity(state);

        ////// Calculate scroll state
        const scrollExtra = 0;
        // Disabled this optimization for now because it was causing blanks to appear sometimes
        // We may need to control speed calculation better, or not have a 5 item history to avoid this issue
        // const scrollExtra = Math.max(-16, Math.min(16, speed)) * 24;

        const { queuedInitialLayout } = state;
        let { scroll: scrollState } = state;
        const shouldDeferVisualInitialScroll =
            !state.initialScrollUsesOffset &&
            initialScroll?.index !== undefined &&
            (initialScroll.viewPosition ?? 0) === 0 &&
            Math.abs(initialScroll.viewOffset ?? 0) <= 1 &&
            !state.scrollingTo?.isInitialScroll &&
            state.props.data.length > 0 &&
            (state.props.getEstimatedItemSize || state.props.getFixedItemSize);

        if (!queuedInitialLayout && initialScroll) {
            // If this is before the initial layout, and we have an initialScrollIndex,
            // then ignore the actual scroll which might be shifting due to scrollAdjustHandler
            // and use the calculated offset of the initialScrollIndex instead.
            if (!shouldDeferVisualInitialScroll) {
                const updatedOffset = state.initialScrollUsesOffset
                    ? (initialScroll.contentOffset ?? 0)
                    : calculateOffsetWithOffsetPosition(
                          ctx,
                          calculateOffsetForIndex(ctx, initialScroll.index),
                          initialScroll,
                      );
                scrollState = updatedOffset;
            }
        }
        const {
            canUseDeferredPositionDelta,
            deferredPositionDeltaBefore,
            deferredPositionFlushReason,
            pendingDeferredPositionDeltaBefore,
            shouldDeferPositionDeltaVisualAdjust: shouldDeferPositionDeltaVisualAdjustForPass,
            shouldSuppressVisualAdjustForPass,
        } = setupDeferredPositionPass({
            ctx,
            dataChanged,
            numColumns: numColumnsForDeferredPositionDelta,
            scrollLength,
            scrollState,
        });
        const shouldForcePostInitialMVCP = !!forceFullItemPositions && !!state.postInitialSettleTarget;
        const doMVCPForPass = !!doMVCP || shouldForcePostInitialMVCP;
        const effectiveDoMVCP = shouldSuppressVisualAdjustForPass ? false : doMVCPForPass;
        if (
            !state.scrollingTo &&
            !state.postInitialSettleTarget &&
            (state.deferredGeometryFlushPending || !!deferredPositionFlushReason)
        ) {
            state.deferredGeometryFlushPending = false;
            state.scrollAdjustHandler.flushPendingAdjust();
        }
        const scrollAdjustPending = shouldSuppressVisualAdjustForPass ? 0 : (peek$(ctx, "scrollAdjustPending") ?? 0);
        const scrollAdjustPad = scrollAdjustPending - topPad;
        let scroll = Math.round(scrollState + scrollExtra + scrollAdjustPad + pendingDeferredPositionDeltaBefore);

        if (shouldLogPerf && state.scrollingTo) {
            console.log(
                "[legend-list][perf]",
                JSON.stringify({
                    canUseDeferredPositionDelta,
                    dataChanged: !!dataChanged,
                    deferPositionDeltaVisualAdjust,
                    effectiveDoMVCP: !!effectiveDoMVCP,
                    event: "calculateItemsInView-scroll-target",
                    deferredPositionDeltaBefore,
                    passId: perfPassId,
                    pendingDeferredPositionDeltaBefore,
                    scrollingTo: {
                        animated: !!state.scrollingTo.animated,
                        index: state.scrollingTo.index,
                        offset: state.scrollingTo.offset,
                        targetOffset: state.scrollingTo.targetOffset,
                        viewPosition: state.scrollingTo.viewPosition,
                    },
                    scrollState,
                    deferredPositionFlushReason,
                    shouldDeferPositionDeltaVisualAdjust: shouldDeferPositionDeltaVisualAdjustForPass,
                    shouldSuppressVisualAdjustForPass,
                }),
            );
        }

        if (scroll + scrollLength > totalSize) {
            // Sometimes we may have scrolled past the visible area which can make items at the top of the
            // screen not render. So make sure we clamp scroll to the end.
            scroll = Math.max(0, totalSize - scrollLength);
        }

        if (ENABLE_DEBUG_VIEW) {
            set$(ctx, "debugRawScroll", scrollState);
            set$(ctx, "debugComputedScroll", scroll);
        }

        const previousStickyIndex = peek$(ctx, "activeStickyIndex");
        const currentStickyIdx =
            stickyIndicesArr.length > 0 ? findCurrentStickyIndex(stickyIndicesArr, scroll, state) : -1;
        const nextActiveStickyIndex = currentStickyIdx >= 0 ? stickyIndicesArr[currentStickyIdx] : -1;
        if (currentStickyIdx >= 0 || previousStickyIndex >= 0) {
            set$(ctx, "activeStickyIndex", nextActiveStickyIndex);
        }

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

        const scrollTopBuffered = scroll - scrollBufferTop;
        const scrollBottom = scroll + scrollLength + (scroll < 0 ? -scroll : 0);
        const scrollBottomBuffered = scrollBottom + scrollBufferBottom;

        // Check precomputed scroll range to see if we can skip this check
        if (!dataChanged && !forceFullItemPositions && scrollForNextCalculateItemsInView) {
            const { top, bottom } = scrollForNextCalculateItemsInView;
            if (top === null && bottom === null) {
                state.scrollForNextCalculateItemsInView = undefined;
            } else if (
                (top === null || scrollTopBuffered > top) &&
                (bottom === null || scrollBottomBuffered < bottom)
            ) {
                if (!IsNewArchitecture && state.initialAnchor) {
                    ensureInitialAnchor(ctx);
                }
                // On web, MVCP anchor lock still needs a pass even inside the cached range window.
                if (Platform.OS !== "web" || !isInMVCPActiveMode(state)) {
                    if (shouldLogPerf) {
                        console.log(
                            "[legend-list][perf]",
                            JSON.stringify({
                                canUseDeferredPositionDelta,
                                event: "calculateItemsInView",
                                label: perfLabel,
                                deferredPositionDelta: canUseDeferredPositionDelta
                                    ? (state.deferredPositionDelta ?? 0)
                                    : 0,
                                passId: perfPassId,
                                pendingDeferredPositionDelta: canUseDeferredPositionDelta
                                    ? (state.deferredPositionDelta ?? 0)
                                    : 0,
                                reason: "cached-range-skip",
                                scroll,
                                scrollBottomBuffered,
                                scrollingTo: state.scrollingTo
                                    ? {
                                          animated: !!state.scrollingTo.animated,
                                          index: state.scrollingTo.index,
                                          offset: state.scrollingTo.offset,
                                          targetOffset: state.scrollingTo.targetOffset,
                                        viewPosition: state.scrollingTo.viewPosition,
                                      }
                                    : undefined,
                                scrollTopBuffered,
                                deferredPositionFlushReason,
                                shouldDeferPositionDeltaVisualAdjust: shouldDeferPositionDeltaVisualAdjustForPass,
                            }),
                        );
                    }
                    return;
                }
            }
        }

        ////// Update item positions and do MVCP
        // Handle maintainVisibleContentPosition adjustment early
        const checkMVCP = effectiveDoMVCP ? prepareMVCP(ctx, dataChanged) : undefined;

        if (dataChanged) {
            indexByKey.clear();
            idCache.length = 0;
            positions.length = 0;
            columns.length = 0;
            columnSpans.length = 0;
        }

        // Update all positions upfront so we can assume they're correct
        // Use minIndexSizeChanged to avoid recalculating from index 0 when only later items changed
        const startIndex =
            forceFullItemPositions || dataChanged ? 0 : (minIndexSizeChanged ?? state.startBuffered ?? 0);

        updateItemPositionsMetrics = updateItemPositions(ctx, dataChanged, {
            doMVCP: effectiveDoMVCP,
            forceFullUpdate: !!forceFullItemPositions,
            scrollBottomBuffered,
            startIndex,
        });
        const isDeferredPositionPassStable = (updateItemPositionsMetrics?.changedPositions ?? 0) === 0;
        const shouldCompareDeferredPositionDeltas =
            canUseDeferredPositionDelta && !state.deferredPositionNeedsStablePass;
        const shouldTrackDeferredPositionBaseline =
            canUseDeferredPositionDelta &&
            !forceFullItemPositions &&
            (!state.deferredPositionNeedsStablePass || isDeferredPositionPassStable);

        // Appends can grow content size while the scroll offset is unchanged. Refresh the
        // cached content size after positions update so the next scroll-range cache reflects
        // the new tail instead of the pre-update end-of-list.
        totalSize = getContentSize(ctx);

        if (minIndexSizeChanged !== undefined) {
            // Clear minIndexSizeChanged after using it for position updates
            state.minIndexSizeChanged = undefined;
        }

        checkMVCP?.();

        ////// Prepare for loop
        let startNoBuffer: number | null = null;
        let startBuffered: number | null = null;
        let startBufferedId: string | null = null;
        let endNoBuffer: number | null = null;
        let endBuffered: number | null = null;

        let loopStart: number = !dataChanged && startBufferedIdOrig ? indexByKey.get(startBufferedIdOrig) || 0 : 0;

        // Go backwards from the last start position to find the first item that is in view
        // This is an optimization to avoid looping through all items, which could slow down
        // when scrolling at the end of a long list.
        for (let i = loopStart; i >= 0; i--) {
            const id = idCache[i] ?? getId(state, i);
            const top = positions[i]!;
            const size = sizes.get(id) ?? getItemSize(ctx, id, i, data[i]);
            const bottom = top + size;

            if (bottom > scroll - scrollBufferTop) {
                loopStart = i;
            } else {
                break;
            }
        }

        if (numColumns > 1) {
            while (loopStart > 0) {
                const loopColumn = columns[loopStart];
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
                const index = indexByKey.get(key)!;
                maxIndexRendered = Math.max(maxIndexRendered, index);
            }
        }

        let firstFullyOnScreenIndex: number | undefined;

        // Continue until we've found the end and we've calculated start/end indices of all items in view
        const dataLength = data!.length;
        for (let i = Math.max(0, loopStart); i < dataLength && (!foundEnd || i <= maxIndexRendered); i++) {
            const id = idCache[i] ?? getId(state, i);
            const size = sizes.get(id) ?? getItemSize(ctx, id, i, data[i]);
            const top = positions[i]!;

            if (!foundEnd) {
                if (startNoBuffer === null && top + size > scroll) {
                    startNoBuffer = i;
                }
                // Subtract 10px for a little buffer so it can be slightly off screen, but still
                // require the row to begin within the visible window so we don't anchor to the
                // next item below an oversized partially visible row.
                if (firstFullyOnScreenIndex === undefined && top >= scroll - 10 && top <= scrollBottom) {
                    firstFullyOnScreenIndex = i;
                }

                if (startBuffered === null && top + size > scrollTopBuffered) {
                    startBuffered = i;
                    startBufferedId = id;
                    if (scrollTopBuffered < 0) {
                        nextTop = null;
                    } else {
                        nextTop = top;
                    }
                }
                if (startNoBuffer !== null) {
                    if (top <= scrollBottom) {
                        endNoBuffer = i;
                    }
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

        const idsInView: string[] = [];
        // MVCP needs at least one intersecting anchor even when the viewport sits inside an oversized item
        // whose top edge is already above the viewport. So fall back to the first intersecting item for
        // idsInView so prepend anchoring stays stable.
        const firstVisibleAnchorIndex = firstFullyOnScreenIndex ?? startNoBuffer;
        if (firstVisibleAnchorIndex !== null && firstVisibleAnchorIndex !== undefined && endNoBuffer !== null) {
            for (let i = firstVisibleAnchorIndex; i <= endNoBuffer; i++) {
                const id = idCache[i] ?? getId(state, i);
                idsInView.push(id);
            }
        }

        Object.assign(state, {
            endBuffered,
            endNoBuffer,
            firstFullyOnScreenIndex,
            idsInView,
            startBuffered,
            startBufferedId,
            startNoBuffer,
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
        if (dataChanged) {
            for (let i = 0; i < numContainers; i++) {
                const itemKey = peek$(ctx, `containerItemKey${i}`);
                if (!keyExtractor || (itemKey && indexByKey.get(itemKey) === undefined)) {
                    pendingRemoval.push(i);
                }
            }
        }

        // Place newly added items into containers
        if (startBuffered !== null && endBuffered !== null) {
            const needNewContainers: number[] = [];
            const needNewContainersSet = new Set<number>();

            for (let i = startBuffered!; i <= endBuffered; i++) {
                const id = idCache[i] ?? getId(state, i);
                if (!containerItemKeys.has(id)) {
                    needNewContainersSet.add(i);
                    needNewContainers.push(i);
                }
            }

            if (alwaysRenderArr.length > 0) {
                for (const index of alwaysRenderArr) {
                    if (index < 0 || index >= dataLength) continue;
                    const id = idCache[index] ?? getId(state, index);
                    if (id && !containerItemKeys.has(id) && !needNewContainersSet.has(index)) {
                        needNewContainersSet.add(index);
                        needNewContainers.push(index);
                    }
                }
            }

            // Handle sticky item activation
            if (stickyIndicesArr.length > 0) {
                handleStickyActivation(
                    ctx,
                    stickyIndicesSet,
                    stickyIndicesArr,
                    currentStickyIdx,
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
                // Calculate required item types for type-safe container reuse
                const requiredItemTypes = getItemType
                    ? needNewContainers.map((i) => {
                          const itemType = getItemType(data[i], i);
                          return itemType !== undefined ? String(itemType) : "";
                      })
                    : undefined;

                const availableContainers = findAvailableContainers(
                    ctx,
                    needNewContainers.length,
                    startBuffered,
                    endBuffered,
                    pendingRemoval,
                    requiredItemTypes,
                    needNewContainers,
                );
                for (let idx = 0; idx < needNewContainers.length; idx++) {
                    const i = needNewContainers[idx];
                    const containerIndex = availableContainers[idx];
                    const id = idCache[i] ?? getId(state, i);

                    // Remove old key from cache
                    const oldKey = peek$(ctx, `containerItemKey${containerIndex}`);
                    if (oldKey && oldKey !== id) {
                        containerItemKeys!.delete(oldKey);
                        deferredPositionBaseline.delete(containerIndex);
                    }

                    set$(ctx, `containerItemKey${containerIndex}`, id);
                    set$(ctx, `containerItemData${containerIndex}`, data[i]);

                    // Store item type for type-safe container reuse
                    if (requiredItemTypes) {
                        state.containerItemTypes.set(containerIndex, requiredItemTypes[idx]);
                    }

                    // Update cache when adding new item
                    containerItemKeys!.set(id, containerIndex);

                    const containerSticky = `containerSticky${containerIndex}` as const;
                    // Mark as sticky if this item is in stickyHeaderIndices
                    const isSticky = stickyIndicesSet.has(i);
                    const isAlwaysRender = alwaysRenderSet.has(i);
                    if (isSticky) {
                        set$(ctx, containerSticky, true);
                        // Add container to sticky pool
                        state.stickyContainerPool.add(containerIndex);
                    } else {
                        if (peek$(ctx, containerSticky)) {
                            set$(ctx, containerSticky, false);
                        }
                        if (isAlwaysRender) {
                            state.stickyContainerPool.add(containerIndex);
                        } else if (state.stickyContainerPool.has(containerIndex)) {
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
                        set$(ctx, "numContainersPooled", Math.ceil(numContainers * 1.5));
                    }
                }
            }

            if (alwaysRenderArr.length > 0) {
                for (const index of alwaysRenderArr) {
                    if (index < 0 || index >= dataLength) continue;
                    const id = idCache[index] ?? getId(state, index);
                    const containerIndex = containerItemKeys.get(id);
                    if (containerIndex !== undefined) {
                        state.stickyContainerPool.add(containerIndex);
                    }
                }
            }
        }

        // Handle sticky container recycling
        if (state.stickyContainerPool.size > 0) {
            handleStickyRecycling(
                ctx,
                stickyIndicesArr,
                scroll,
                drawDistance,
                currentStickyIdx,
                pendingRemoval,
                alwaysRenderSet,
            );
        }

        const deferredPositionDeltaBeforePass = canUseDeferredPositionDelta ? deferredPositionDeltaBefore : 0;
        const containerUpdates: Array<{
            absolutePosition?: number;
            column: number;
            containerId: number;
            isPendingRemoval: boolean;
            item?: any;
            itemIndex?: number;
            prevColumn: number | undefined;
            prevData: any;
            prevPos: number | undefined;
            prevSpan: number | undefined;
            span: number;
        }> = [];
        const deferredPositionDeltaCandidates: number[] = [];

        for (let i = 0; i < numContainers; i++) {
            const itemKey = peek$(ctx, `containerItemKey${i}`);

            if (pendingRemoval.includes(i)) {
                containerUpdates.push({
                    column: -1,
                    containerId: i,
                    isPendingRemoval: true,
                    prevColumn: peek$(ctx, `containerColumn${i}`),
                    prevData: peek$(ctx, `containerItemData${i}`),
                    prevPos: peek$(ctx, `containerPosition${i}`),
                    prevSpan: peek$(ctx, `containerSpan${i}`),
                    span: 1,
                });
                continue;
            }

            const itemIndex = indexByKey.get(itemKey)!;
            const item = data[itemIndex];
            if (item === undefined) {
                continue;
            }

            const absolutePosition = positions[itemIndex];
            const prevAbsolutePosition = deferredPositionBaseline.get(i);
            if (
                shouldCompareDeferredPositionDeltas &&
                absolutePosition !== undefined &&
                prevAbsolutePosition !== undefined &&
                absolutePosition !== prevAbsolutePosition
            ) {
                deferredPositionDeltaCandidates.push(absolutePosition - prevAbsolutePosition);
            }

            containerUpdates.push({
                absolutePosition,
                column: columns[itemIndex] || 1,
                containerId: i,
                isPendingRemoval: false,
                item,
                itemIndex,
                prevColumn: peek$(ctx, `containerColumn${i}`),
                prevData: peek$(ctx, `containerItemData${i}`),
                prevPos: peek$(ctx, `containerPosition${i}`),
                prevSpan: peek$(ctx, `containerSpan${i}`),
                span: columnSpans[itemIndex] || 1,
            });
        }

        const {
            deferredPositionDelta,
            deltaApplied,
            matchCount,
        } = applyDeferredPositionDelta({
            canUseDeferredPositionDelta,
            deferredPositionDeltaBefore: deferredPositionDeltaBeforePass,
            deferredPositionDeltaCandidates,
        });
        if (canUseDeferredPositionDelta) {
            state.deferredPositionDelta = deferredPositionDelta;
        }
        deferredPositionDeltaApplied = deltaApplied;
        deferredPositionMatchCount = matchCount;

        let didChangePositions = false;
        // Update top positions of all containers
        for (const update of containerUpdates) {
            const {
                absolutePosition,
                column,
                containerId,
                isPendingRemoval,
                item,
                itemIndex,
                prevColumn,
                prevData,
                prevPos,
                prevSpan,
                span,
            } = update;

            if (isPendingRemoval) {
                const itemKey = peek$(ctx, `containerItemKey${containerId}`);
                // Update cache when removing item
                if (itemKey !== undefined) {
                    containerItemKeys!.delete(itemKey);
                }

                deferredPositionBaseline.delete(containerId);
                // Clear container item type when deallocating
                state.containerItemTypes.delete(containerId);

                // Clear sticky state if this was a sticky container
                if (state.stickyContainerPool.has(containerId)) {
                    set$(ctx, `containerSticky${containerId}`, false);
                    // Remove container from sticky pool
                    state.stickyContainerPool.delete(containerId);
                }

                set$(ctx, `containerItemKey${containerId}`, undefined);
                set$(ctx, `containerItemData${containerId}`, undefined);
                setContainerPosition(containerId, POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${containerId}`, -1);
                set$(ctx, `containerSpan${containerId}`, 1);
                continue;
            }

            if (absolutePosition === undefined) {
                deferredPositionBaseline.delete(containerId);
                // This item may have been in view before data changed and positions were reset
                // so we need to set it to out of view
                setContainerPosition(containerId, POSITION_OUT_OF_VIEW);
                continue;
            }

            if (!shouldTrackDeferredPositionBaseline) {
                deferredPositionBaseline.delete(containerId);
            } else {
                deferredPositionBaseline.set(containerId, absolutePosition);
            }
            const position = canUseDeferredPositionDelta
                ? absolutePosition - deferredPositionDelta - scrollAdjustPending
                : absolutePosition - scrollAdjustPending;

            if (position > POSITION_OUT_OF_VIEW && position !== prevPos) {
                didChangePositions = setContainerPosition(containerId, position) || didChangePositions;
            }
            if (column >= 0 && column !== prevColumn) {
                set$(ctx, `containerColumn${containerId}`, column);
            }
            if (span !== prevSpan) {
                set$(ctx, `containerSpan${containerId}`, span);
            }

            if (prevData !== item && (itemsAreEqual ? !itemsAreEqual(prevData, item, itemIndex!, data) : true)) {
                set$(ctx, `containerItemData${containerId}`, item);
            }
        }

        if (Platform.OS === "web" && didChangePositions) {
            set$(ctx, "lastPositionUpdate", Date.now());
        }

        if (canUseDeferredPositionDelta && state.deferredPositionNeedsStablePass && isDeferredPositionPassStable) {
            state.deferredPositionNeedsStablePass = false;
        }
        if (state.postInitialSettleTarget && isDeferredPositionPassStable) {
            state.postInitialSettleTarget = undefined;
        }

        if (!queuedInitialLayout && endBuffered !== null) {
            // If waiting for initial layout and all items in view have a known size then
            // initial layout is complete
            if (checkAllSizesKnown(state)) {
                setDidLayout(ctx);
            }
        }

        if (viewabilityConfigCallbackPairs) {
            updateViewableItems(state, ctx, viewabilityConfigCallbackPairs, scrollLength, startNoBuffer!, endNoBuffer!);
        }

        if (
            onStickyHeaderChange &&
            stickyIndicesArr.length > 0 &&
            nextActiveStickyIndex !== undefined &&
            nextActiveStickyIndex !== previousStickyIndex
        ) {
            const item = data[nextActiveStickyIndex];
            if (item !== undefined) {
                onStickyHeaderChange({ index: nextActiveStickyIndex, item });
            }
        }

        if (shouldLogPerf) {
            console.log(
                "[legend-list][perf]",
                JSON.stringify({
                    canUseDeferredPositionDelta,
                    containerPosition: {
                        applied: containerPositionApplied,
                        attempted: containerPositionAttempted,
                        maxPerPass: maxContainerPositionWritesPerPass,
                        suppressed: containerPositionSuppressed,
                    },
                    dataChanged: !!dataChanged,
                    deferPositionDeltaVisualAdjust,
                    doMVCP: !!effectiveDoMVCP,
                    endBuffered,
                    endNoBuffer,
                    event: "calculateItemsInView",
                    forceFullItemPositions: !!forceFullItemPositions,
                    idsInView: idsInView.length,
                    label: perfLabel,
                    deferredPositionDelta: canUseDeferredPositionDelta ? deferredPositionDelta : 0,
                    passId: perfPassId,
                    pendingDeferredPositionDelta: canUseDeferredPositionDelta ? deferredPositionDelta : 0,
                    scroll,
                    scrollingTo: state.scrollingTo
                        ? {
                              animated: !!state.scrollingTo.animated,
                              index: state.scrollingTo.index,
                              offset: state.scrollingTo.offset,
                              targetOffset: state.scrollingTo.targetOffset,
                              viewPosition: state.scrollingTo.viewPosition,
                          }
                        : undefined,
                    scrollLength,
                    deferredPositionDeltaApplied,
                    deferredPositionFlushReason,
                    deferredPositionMatchCount,
                    startBuffered,
                    startIndex,
                    startNoBuffer,
                    totalDurationMs: roundPerfValue(nowMs() - perfStartedAt),
                    updateItemPositions: updateItemPositionsMetrics
                        ? {
                              changedPositions: updateItemPositionsMetrics.changedPositions,
                              didBreakEarly: updateItemPositionsMetrics.didBreakEarly,
                              durationMs: roundPerfValue(updateItemPositionsMetrics.durationMs),
                              itemsVisited: updateItemPositionsMetrics.itemsVisited,
                              optimizeDirection: updateItemPositionsMetrics.optimizeDirection,
                              shouldOptimize: updateItemPositionsMetrics.shouldOptimize,
                              startIndex: updateItemPositionsMetrics.startIndex,
                          }
                        : undefined,
                }),
            );
        }
    });

    if (!IsNewArchitecture && state.initialAnchor) {
        ensureInitialAnchor(ctx);
    }
}
