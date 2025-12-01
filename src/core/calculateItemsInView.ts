import { ENABLE_DEBUG_VIEW, POSITION_OUT_OF_VIEW } from "@/constants";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { ensureInitialAnchor } from "@/core/ensureInitialAnchor";
import { prepareMVCP } from "@/core/mvcp";
import { updateItemPositions } from "@/core/updateItemPositions";
import { updateViewableItems } from "@/core/viewability";
import { batchedUpdates } from "@/platform/batchedUpdates";
import { Platform } from "@/platform/Platform";
import { getContentSize, peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { findAvailableContainers } from "@/utils/findAvailableContainers";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { setDidLayout } from "@/utils/setDidLayout";

function findCurrentStickyIndex(stickyArray: number[], scroll: number, state: InternalState): number {
    const idCache = state.idCache;
    const positions = state.positions;
    for (let i = stickyArray.length - 1; i >= 0; i--) {
        const stickyIndex = stickyArray[i];
        const stickyId = idCache[stickyIndex] ?? getId(state, stickyIndex);
        const stickyPos = stickyId ? positions.get(stickyId) : undefined;
        if (stickyPos !== undefined && scroll >= stickyPos) {
            return i;
        }
    }
    return -1;
}

function getActiveStickyIndices(
    ctx: StateContext,
    state: InternalState,
    stickyHeaderIndices: Set<number>,
): Set<number> {
    return new Set(
        Array.from(state.stickyContainerPool)
            .map((i) => peek$(ctx, `containerItemKey${i}`))
            .map((key) => (key ? state.indexByKey.get(key) : undefined))
            .filter((idx): idx is number => idx !== undefined && stickyHeaderIndices.has(idx)),
    );
}

function handleStickyActivation(
    ctx: StateContext,
    state: InternalState,
    stickyHeaderIndices: Set<number>,
    stickyArray: number[],
    currentStickyIdx: number,
    needNewContainers: number[],
    startBuffered: number,
    endBuffered: number,
): void {
    const activeIndices = getActiveStickyIndices(ctx, state, stickyHeaderIndices);

    // Update activeStickyIndex to the actual data index (not array position)
    state.activeStickyIndex = currentStickyIdx >= 0 ? stickyArray[currentStickyIdx] : undefined;

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
            (stickyIndex < startBuffered || stickyIndex > endBuffered)
        ) {
            needNewContainers.push(stickyIndex);
        }
    }
}

function handleStickyRecycling(
    ctx: StateContext,
    state: InternalState,
    stickyArray: number[],
    scroll: number,
    scrollBuffer: number,
    currentStickyIdx: number,
    pendingRemoval: number[],
): void {
    for (const containerIndex of state.stickyContainerPool) {
        const itemKey = peek$(ctx, `containerItemKey${containerIndex}`);
        const itemIndex = itemKey ? state.indexByKey.get(itemKey) : undefined;
        if (itemIndex === undefined) continue;

        const arrayIdx = stickyArray.indexOf(itemIndex);
        if (arrayIdx === -1) {
            state.stickyContainerPool.delete(containerIndex);
            set$(ctx, `containerSticky${containerIndex}`, false);
            set$(ctx, `containerStickyOffset${containerIndex}`, undefined);
            continue;
        }

        // Keep current and adjacent sticky items, recycle distant ones
        const isRecentSticky = arrayIdx >= currentStickyIdx - 1 && arrayIdx <= currentStickyIdx + 1;
        if (isRecentSticky) continue;

        const nextIndex = stickyArray[arrayIdx + 1];
        let shouldRecycle = false;

        if (nextIndex) {
            const nextId = state.idCache[nextIndex] ?? getId(state, nextIndex);
            const nextPos = nextId ? state.positions.get(nextId) : undefined;
            shouldRecycle = nextPos !== undefined && scroll > nextPos + scrollBuffer * 2;
        } else {
            const currentId = state.idCache[itemIndex] ?? getId(state, itemIndex);
            if (currentId) {
                const currentPos = state.positions.get(currentId);
                const currentSize =
                    state.sizes.get(currentId) ??
                    getItemSize(ctx, state, currentId, itemIndex, state.props.data[itemIndex]);
                shouldRecycle = currentPos !== undefined && scroll > currentPos + currentSize + scrollBuffer * 3;
            }
        }

        if (shouldRecycle) {
            pendingRemoval.push(containerIndex);
        }
    }
}

export function calculateItemsInView(
    ctx: StateContext,
    state: InternalState,
    params: { doMVCP?: boolean; dataChanged?: boolean; forceFullItemPositions?: boolean } = {},
) {
    batchedUpdates(() => {
        const {
            columns,
            containerItemKeys,
            enableScrollForNextCalculateItemsInView,
            idCache,
            indexByKey,
            initialScroll,
            minIndexSizeChanged,
            positions,
            props: { getItemType, itemsAreEqual, keyExtractor, onStickyHeaderChange, scrollBuffer },
            scrollForNextCalculateItemsInView,
            scrollLength,
            sizes,
            startBufferedId: startBufferedIdOrig,
            viewabilityConfigCallbackPairs,
        } = state;
        const { data } = state.props;
        const stickyIndicesArr = state.props.stickyIndicesArr || [];
        const stickyIndicesSet = state.props.stickyIndicesSet || new Set<number>();
        const prevNumContainers = peek$(ctx, "numContainers");
        if (!data || scrollLength === 0 || !prevNumContainers) {
            if (state.initialAnchor) {
                ensureInitialAnchor(ctx, state);
            }
            return;
        }

        const totalSize = getContentSize(ctx);
        const topPad = peek$(ctx, "stylePaddingTop") + peek$(ctx, "headerSize");
        const numColumns = peek$(ctx, "numColumns");
        const { dataChanged, doMVCP, forceFullItemPositions } = params;
        const speed = getScrollVelocity(state);

        ////// Calculate scroll state
        const scrollExtra = 0;
        // Disabled this optimization for now because it was causing blanks to appear sometimes
        // We may need to control speed calculation better, or not have a 5 item history to avoid this issue
        // const scrollExtra = Math.max(-16, Math.min(16, speed)) * 24;

        const { queuedInitialLayout } = state;
        let { scroll: scrollState } = state;

        if (!queuedInitialLayout && initialScroll) {
            // If this is before the initial layout, and we have an initialScrollIndex,
            // then ignore the actual scroll which might be shifting due to scrollAdjustHandler
            // and use the calculated offset of the initialScrollIndex instead.
            const updatedOffset = calculateOffsetWithOffsetPosition(
                ctx,
                state,
                calculateOffsetForIndex(ctx, state, initialScroll.index),
                initialScroll,
            );
            scrollState = updatedOffset;
        }

        const scrollAdjustPending = peek$(ctx, "scrollAdjustPending") ?? 0;
        const scrollAdjustPad = scrollAdjustPending - topPad;
        let scroll = Math.round(scrollState + scrollExtra + scrollAdjustPad);

        if (scroll + scrollLength > totalSize) {
            // Sometimes we may have scrolled past the visible area which can make items at the top of the
            // screen not render. So make sure we clamp scroll to the end.
            scroll = Math.max(0, totalSize - scrollLength);
        }

        if (ENABLE_DEBUG_VIEW) {
            set$(ctx, "debugRawScroll", scrollState);
            set$(ctx, "debugComputedScroll", scroll);
        }

        const previousStickyIndex = state.activeStickyIndex;
        const currentStickyIdx =
            stickyIndicesArr.length > 0 ? findCurrentStickyIndex(stickyIndicesArr, scroll, state) : -1;
        const nextActiveStickyIndex = currentStickyIdx >= 0 ? stickyIndicesArr[currentStickyIdx] : undefined;
        state.activeStickyIndex = nextActiveStickyIndex;
        set$(ctx, "activeStickyIndex", nextActiveStickyIndex);

        let scrollBufferTop = scrollBuffer;
        let scrollBufferBottom = scrollBuffer;

        if (speed > 0 || (speed === 0 && scroll < Math.max(50, scrollBuffer))) {
            // If we're scrolling fast, or we're at the top of the list and not scrolling
            scrollBufferTop = scrollBuffer * 0.5;
            scrollBufferBottom = scrollBuffer * 1.5;
        } else {
            scrollBufferTop = scrollBuffer * 1.5;
            scrollBufferBottom = scrollBuffer * 0.5;
        }

        const scrollTopBuffered = scroll - scrollBufferTop;
        const scrollBottom = scroll + scrollLength + (scroll < 0 ? -scroll : 0);
        const scrollBottomBuffered = scrollBottom + scrollBufferBottom;

        // Check precomputed scroll range to see if we can skip this check
        if (!dataChanged && scrollForNextCalculateItemsInView) {
            const { top, bottom } = scrollForNextCalculateItemsInView;
            if ((top === null || scrollTopBuffered > top) && (bottom === null || scrollBottomBuffered < bottom)) {
                if (state.initialAnchor) {
                    ensureInitialAnchor(ctx, state);
                }
                return;
            }
        }

        ////// Update item positions and do MVCP
        // Handle maintainVisibleContentPosition adjustment early
        const checkMVCP = doMVCP ? prepareMVCP(ctx, state, dataChanged) : undefined;

        if (dataChanged) {
            indexByKey.clear();
            idCache.length = 0;
            positions.clear();
        }

        // Update all positions upfront so we can assume they're correct
        // Use minIndexSizeChanged to avoid recalculating from index 0 when only later items changed
        const startIndex = dataChanged ? 0 : (minIndexSizeChanged ?? state.startBuffered ?? 0);

        updateItemPositions(ctx, state, dataChanged, {
            doMVCP,
            forceFullUpdate: !!forceFullItemPositions,
            scrollBottomBuffered,
            startIndex,
        });

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
            const top = positions.get(id)!;
            const size = sizes.get(id) ?? getItemSize(ctx, state, id, i, data[i]);
            const bottom = top + size;

            if (bottom > scroll - scrollBufferTop) {
                loopStart = i;
            } else {
                break;
            }
        }

        const loopStartMod = loopStart % numColumns;
        if (loopStartMod > 0) {
            loopStart -= loopStartMod;
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
            const size = sizes.get(id) ?? getItemSize(ctx, state, id, i, data[i]);
            const top = positions.get(id)!;

            if (!foundEnd) {
                if (startNoBuffer === null && top + size > scroll) {
                    startNoBuffer = i;
                }
                // Subtract 10px for a little buffer so it can be slightly off screen
                if (firstFullyOnScreenIndex === undefined && top >= scroll - 10) {
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
        for (let i = firstFullyOnScreenIndex!; i <= endNoBuffer!; i++) {
            const id = idCache[i] ?? getId(state, i);
            idsInView.push(id);
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
                nextTop !== undefined && nextBottom !== undefined
                    ? {
                          bottom: nextBottom,
                          top: nextTop,
                      }
                    : undefined;
        }

        const numContainers = peek$(ctx, "numContainers");
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
            let numContainers = prevNumContainers;
            const needNewContainers: number[] = [];

            for (let i = startBuffered!; i <= endBuffered; i++) {
                const id = idCache[i] ?? getId(state, i);
                if (!containerItemKeys.has(id)) {
                    needNewContainers.push(i);
                }
            }

            // Handle sticky item activation
            if (stickyIndicesArr.length > 0) {
                handleStickyActivation(
                    ctx,
                    state,
                    stickyIndicesSet,
                    stickyIndicesArr,
                    currentStickyIdx,
                    needNewContainers,
                    startBuffered,
                    endBuffered,
                );
            } else {
                // Clear activeStickyIndex when no sticky indices are configured
                state.activeStickyIndex = undefined;
                set$(ctx, "activeStickyIndex", undefined);
            }

            if (needNewContainers.length > 0) {
                // Calculate required item types for type-safe container reuse
                const requiredItemTypes = getItemType
                    ? needNewContainers.map((i) => {
                          const itemType = getItemType!(data[i], i);
                          return itemType ? String(itemType) : "";
                      })
                    : undefined;

                const availableContainers = findAvailableContainers(
                    ctx,
                    state,
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
                    }

                    set$(ctx, `containerItemKey${containerIndex}`, id);
                    set$(ctx, `containerItemData${containerIndex}`, data[i]);

                    // Store item type for type-safe container reuse
                    if (requiredItemTypes) {
                        state.containerItemTypes.set(containerIndex, requiredItemTypes[idx]);
                    }

                    // Update cache when adding new item
                    containerItemKeys!.add(id);

                    const containerSticky = `containerSticky${containerIndex}` as const;
                    // Mark as sticky if this item is in stickyHeaderIndices
                    if (stickyIndicesSet.has(i)) {
                        set$(ctx, containerSticky, true);
                        // Set sticky offset to top padding for proper sticky positioning
                        const topPadding = (peek$(ctx, "stylePaddingTop") || 0) + (peek$(ctx, "headerSize") || 0);
                        set$(ctx, `containerStickyOffset${containerIndex}`, topPadding);
                        // Add container to sticky pool
                        state.stickyContainerPool.add(containerIndex);
                    } else if (peek$(ctx, containerSticky)) {
                        set$(ctx, containerSticky, false);
                        // Ensure container is not in sticky pool if item is not sticky
                        state.stickyContainerPool.delete(containerIndex);
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
        }

        // Handle sticky container recycling
        if (stickyIndicesArr.length > 0) {
            handleStickyRecycling(ctx, state, stickyIndicesArr, scroll, scrollBuffer, currentStickyIdx, pendingRemoval);
        }

        let didChangePositions = false;
        // Update top positions of all containers
        for (let i = 0; i < numContainers; i++) {
            const itemKey = peek$(ctx, `containerItemKey${i}`);

            // If it's pending removal, then it's not in view anymore
            if (pendingRemoval.includes(i)) {
                // Update cache when removing item
                if (itemKey !== undefined) {
                    containerItemKeys!.delete(itemKey);
                }

                // Clear container item type when deallocating
                state.containerItemTypes.delete(i);

                // Clear sticky state if this was a sticky container
                if (state.stickyContainerPool.has(i)) {
                    set$(ctx, `containerSticky${i}`, false);
                    set$(ctx, `containerStickyOffset${i}`, undefined);
                    // Remove container from sticky pool
                    state.stickyContainerPool.delete(i);
                }

                set$(ctx, `containerItemKey${i}`, undefined);
                set$(ctx, `containerItemData${i}`, undefined);
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${i}`, -1);
            } else {
                const itemIndex = indexByKey.get(itemKey)!;
                const item = data[itemIndex];
                if (item !== undefined) {
                    const id = idCache[itemIndex] ?? getId(state, itemIndex);
                    const positionValue = positions.get(id);

                    if (positionValue === undefined) {
                        // This item may have been in view before data changed and positions were reset
                        // so we need to set it to out of view
                        set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                    } else {
                        const position = (positionValue || 0) - scrollAdjustPending;
                        const column = columns.get(id) || 1;

                        const prevPos = peek$(ctx, `containerPosition${i}`);
                        const prevColumn = peek$(ctx, `containerColumn${i}`);
                        const prevData = peek$(ctx, `containerItemData${i}`);

                        if (position > POSITION_OUT_OF_VIEW && position !== prevPos) {
                            set$(ctx, `containerPosition${i}`, position);
                            didChangePositions = true;
                        }
                        if (column >= 0 && column !== prevColumn) {
                            set$(ctx, `containerColumn${i}`, column);
                        }

                        if (
                            prevData !== item &&
                            (itemsAreEqual ? !itemsAreEqual(prevData, item, itemIndex, data) : true)
                        ) {
                            set$(ctx, `containerItemData${i}`, item);
                        }
                    }
                }
            }
        }

        if (Platform.OS === "web" && didChangePositions) {
            set$(ctx, "lastPositionUpdate", Date.now());
        }

        if (!queuedInitialLayout && endBuffered !== null) {
            // If waiting for initial layout and all items in view have a known size then
            // initial layout is complete
            if (checkAllSizesKnown(state)) {
                setDidLayout(ctx, state);
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
    });

    if (state.initialAnchor) {
        ensureInitialAnchor(ctx, state);
    }
}
