import { updateTotalSize } from "@/core/updateTotalSize";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { roundSize } from "@/utils/helpers";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

export function updateAllPositions(ctx: StateContext, state: InternalState, dataChanged?: boolean, startIndex = 0) {
    const {
        averageSizes,
        columns,
        indexByKey,
        positions,
        idCache,
        sizesKnown,
        props: { getEstimatedItemSize, snapToIndices, enableAverages },
    } = state;
    const data = state.props.data;
    const numColumns = peek$(ctx, "numColumns");
    const indexByKeyForChecking = __DEV__ ? new Map() : undefined;

    // Only use average size if user did not provide a getEstimatedItemSize function
    // and enableAverages is true. Note that with estimatedItemSize, we use it for the first render and then
    // we can use average size after that.
    const useAverageSize = enableAverages && !getEstimatedItemSize;

    // Perf optimization to pre-calculate default average size
    const itemType = "";
    let averageSize = averageSizes[itemType]?.avg;
    if (averageSize !== undefined) {
        averageSize = roundSize(averageSize);
    }

    let currentRowTop = 0;
    let column = 1;
    let maxSizeInRow = 0;

    const hasColumns = numColumns > 1;

    // If starting from a non-zero index, continue from previous item's state
    if (startIndex > 0) {
        const prevIndex = startIndex - 1;
        const prevId = idCache.get(prevIndex) ?? getId(state, prevIndex)!;
        const prevPosition = positions.get(prevId) ?? 0;
        
        if (hasColumns) {
            const prevColumn = columns.get(prevId) ?? 1;
            currentRowTop = prevPosition;
            column = (prevColumn % numColumns) + 1;
        } else {
            const prevSize = sizesKnown.get(prevId) ?? getItemSize(state, prevId, prevIndex, data[prevIndex], useAverageSize, averageSize);
            currentRowTop = prevPosition + prevSize;
        }
    }

    const needsIndexByKey = dataChanged || indexByKey.size === 0;

    // Note that this loop is micro-optimized because it's a hot path
    const dataLength = data!.length;
    for (let i = startIndex; i < dataLength; i++) {
        // Inline the map get calls to avoid the overhead of the function call
        const id = idCache.get(i) ?? getId(state, i)!;
        const size = sizesKnown.get(id) ?? getItemSize(state, id, i, data[i], useAverageSize, averageSize);

        // Set index mapping for this item
        if (__DEV__ && needsIndexByKey) {
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

    updateTotalSize(ctx, state);

    if (snapToIndices) {
        updateSnapToOffsets(ctx, state);
    }
}
