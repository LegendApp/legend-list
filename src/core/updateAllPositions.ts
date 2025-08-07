import { updateTotalSize } from "@/core/updateTotalSize";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { roundSize } from "@/utils/helpers";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

export function updateAllPositions(ctx: StateContext, state: InternalState, dataChanged?: boolean) {
    const {
        averageSizes,
        columns,
        indexByKey,
        positions,
        firstFullyOnScreenIndex,
        idCache,
        sizesKnown,
        props: { getEstimatedItemSize, snapToIndices, enableAverages },
    } = state;
    const start = performance.now();
    const data = state.props.data;
    const numColumns = peek$(ctx, "numColumns");
    const indexByKeyForChecking = __DEV__ ? new Map() : undefined;
    const scrollVelocity = getScrollVelocity(state);

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

    // Check if we should use backwards optimization when scrolling up
    const shouldUseBackwards =
        !dataChanged && scrollVelocity < 0 && firstFullyOnScreenIndex > 5 && firstFullyOnScreenIndex < data!.length;

    if (shouldUseBackwards && firstFullyOnScreenIndex !== undefined) {
        // Get the current position of firstFullyOnScreenIndex as anchor
        const anchorId = getId(state, firstFullyOnScreenIndex)!;
        const anchorPosition = positions.get(anchorId);

        // If we don't have the anchor position, fall back to regular behavior
        if (anchorPosition !== undefined) {
            // Start from the anchor and go backwards
            let currentRowTop = anchorPosition;
            let maxSizeInRow = 0;
            let bailout = false;

            // Process items backwards from firstFullyOnScreenIndex - 1 to 0
            for (let i = firstFullyOnScreenIndex - 1; i >= 0; i--) {
                const id = idCache.get(i) ?? getId(state, i)!;
                const size =
                    sizesKnown.get(id) ??
                    getItemSize(
                        state,
                        id,
                        i,
                        data[i],
                        useAverageSize,
                        averageSize,
                        /*preferRenderedCache*/ !!dataChanged,
                    );
                const itemColumn = columns.get(id)!;

                maxSizeInRow = Math.max(maxSizeInRow, size);

                // When we reach column 1, we're at the start of a new row going backwards
                if (itemColumn === 1) {
                    currentRowTop -= maxSizeInRow;
                    maxSizeInRow = 0;
                }

                // Check if position goes too low - bail if so
                if (currentRowTop < -2000) {
                    bailout = true;
                    break;
                }

                // Update position for this item (columns and indexByKey already set)
                positions.set(id, currentRowTop);
            }

            if (!bailout) {
                // We successfully processed backwards, we're done
                updateTotalSize(ctx, state);
                return;
            }
        }
    }

    // Regular ascending behavior (either not scrolling up or bailed out)
    // Use integer pixel positions on web to avoid subpixel accumulation causing gaps/overlaps
    let currentRowTop = 0;
    let column = 1;
    let maxSizeInRow = 0;

    const hasColumns = numColumns > 1;
    const needsIndexByKey = dataChanged || indexByKey.size === 0;

    // Note that this loop is micro-optimized because it's a hot path
    const dataLength = data!.length;
    for (let i = 0; i < dataLength; i++) {
        // Inline the map get calls to avoid the overhead of the function call
        const id = idCache.get(i) ?? getId(state, i)!;
        const size =
            sizesKnown.get(id) ??
            getItemSize(state, id, i, data[i], useAverageSize, averageSize, /*preferRenderedCache*/ !!dataChanged);

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
                if (typeof window !== "undefined") currentRowTop = Math.round(currentRowTop);
                column = 1;
                maxSizeInRow = 0;
            }
        } else {
            currentRowTop += size;
            if (typeof window !== "undefined") currentRowTop = Math.round(currentRowTop);
        }
    }

    updateTotalSize(ctx, state);

    if (snapToIndices) {
        updateSnapToOffsets(ctx, state);
    }

    console.log("updateAllPositions time", performance.now() - start);
}
