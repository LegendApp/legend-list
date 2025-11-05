import { prepareColumnStartState } from "@/core/prepareColumnStartState";
import { updateTotalSize } from "@/core/updateTotalSize";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

interface Options {
    startIndex: number;
    scrollBottomBuffered: number;
    forceFullUpdate?: boolean;
}

export function updateItemPositions(
    ctx: StateContext,
    state: InternalState,
    dataChanged: boolean | undefined,
    { startIndex, scrollBottomBuffered, forceFullUpdate = false }: Options = {
        forceFullUpdate: false,
        scrollBottomBuffered: -1,
        startIndex: 0,
    },
) {
    const {
        columns,
        indexByKey,
        positions,
        idCache,
        sizesKnown,
        props: { getEstimatedItemSize, snapToIndices, enableAverages, maintainVisibleContentPosition },
    } = state;
    const data = state.props.data;
    const dataLength = data!.length;
    const numColumns = peek$(ctx, "numColumns");
    const scrollingTo = peek$(ctx, "scrollingTo");
    const hasColumns = numColumns > 1;
    const indexByKeyForChecking = IS_DEV ? new Map() : undefined;

    const shouldOptimize = !forceFullUpdate && !dataChanged && Math.abs(getScrollVelocity(state)) > 0;

    const maxVisibleArea = scrollBottomBuffered + 1000;

    // Only use average size if user did not provide a getEstimatedItemSize function
    // and enableAverages is true. Note that with estimatedItemSize, we use it for the first render and then
    // we can use average size after that.
    const useAverageSize = enableAverages && !getEstimatedItemSize;
    const preferCachedSize =
        maintainVisibleContentPosition &&
        (dataChanged || state.scrollAdjustHandler.getAdjust() !== 0 || (peek$(ctx, "scrollAdjustPending") ?? 0) !== 0);

    let currentRowTop = 0;
    let column = 1;
    let maxSizeInRow = 0;

    if (startIndex > 0) {
        if (hasColumns) {
            const { startIndex: processedStartIndex, currentRowTop: initialRowTop } = prepareColumnStartState(
                ctx,
                state,
                startIndex,
                useAverageSize,
            );

            startIndex = processedStartIndex;
            currentRowTop = initialRowTop;
        } else if (startIndex < dataLength) {
            const prevIndex = startIndex - 1;
            const prevId = getId(state, prevIndex)!;
            const prevPosition = positions.get(prevId) ?? 0;
            const prevSize =
                sizesKnown.get(prevId) ??
                getItemSize(ctx, state, prevId, prevIndex, data[prevIndex], useAverageSize, preferCachedSize);
            currentRowTop = prevPosition + prevSize;
        }
    }

    const needsIndexByKey = dataChanged || indexByKey.size === 0;

    let didBreakEarly = false;

    let breakAt: number | undefined;
    // Note that this loop is micro-optimized because it's a hot path
    for (let i = startIndex; i < dataLength; i++) {
        if (shouldOptimize && breakAt !== undefined && i > breakAt) {
            didBreakEarly = true;
            break;
        }
        // Early exit if we've processed items beyond the visible area
        // This is a performance optimization to constrain the number of items processed.
        if (shouldOptimize && breakAt === undefined && !scrollingTo && !dataChanged && currentRowTop > maxVisibleArea) {
            // Finish laying out the current row before breaking to avoid gaps
            // when an item exceeds the viewport height.
            const itemsPerRow = hasColumns ? numColumns : 1;
            // We don't want to break immediately because it can cause
            // issues with items that are much taller than screen size.
            // So we add a buffer before breaking.

            breakAt = i + itemsPerRow + 10;
        }

        // Inline the map get calls to avoid the overhead of the function call
        const id = idCache[i] ?? getId(state, i)!;
        const size = sizesKnown.get(id) ?? getItemSize(ctx, state, id, i, data[i], useAverageSize, preferCachedSize);

        // Set index mapping for this item
        if (IS_DEV && needsIndexByKey) {
            if (indexByKeyForChecking!.has(id)) {
                console.error(
                    `[legend-list] Error: Detected overlapping key (${id}) which causes missing items and gaps and other terrrible things. Check that keyExtractor returns unique values.`,
                );
            }
            indexByKeyForChecking!.set(id, i);
        }

        // Set position for this item
        positions.set(id, currentRowTop);

        // Update indexByKey if needed
        if (needsIndexByKey) {
            indexByKey.set(id, i);
        }

        // Set column for this item
        columns.set(id, column);

        if (hasColumns) {
            if (size > maxSizeInRow) {
                maxSizeInRow = size;
            }

            column++;
            if (column > numColumns) {
                // Move to next row
                currentRowTop += maxSizeInRow;
                column = 1;
                maxSizeInRow = 0;
            }
        } else {
            currentRowTop += size;
        }
    }

    // If we didn't break early, update total size
    // otherwise expect that a diff will be applied in updateItemSize
    if (!didBreakEarly) {
        updateTotalSize(ctx, state);
    }

    if (snapToIndices) {
        updateSnapToOffsets(ctx, state);
    }
}
