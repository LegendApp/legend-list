import { updateTotalSize } from "@/core/updateTotalSize";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

function getRequiredRange(_ctx: StateContext, state: InternalState): { start: number; end: number } {
    const bufferSize = 10;
    const dataLength = state.props.data.length;
    let minIndex = 0;
    let maxIndex = dataLength - 1;

    if (dataLength < 500) {
        return { end: maxIndex, start: 0 };
    }

    const hasVisibleRange = state.startBuffered >= 0 && state.endBuffered >= 0;
    if (hasVisibleRange) {
        minIndex = state.startBuffered;
        maxIndex = state.endBuffered;
    }

    if (state.scrollingTo?.index !== undefined) {
        if (hasVisibleRange) {
            minIndex = Math.min(minIndex, state.scrollingTo.index);
            maxIndex = Math.max(maxIndex, state.scrollingTo.index);
        } else {
            minIndex = state.scrollingTo.index;
            maxIndex = state.scrollingTo.index;
        }
    }

    minIndex = Math.max(0, minIndex - bufferSize);
    maxIndex = Math.min(dataLength - 1, maxIndex + bufferSize);

    return { end: maxIndex, start: minIndex };
}

export function ensurePositionCalculated(ctx: StateContext, state: InternalState, index: number) {
    // Initialize positionRange if not set
    if (!state.positionRange) {
        state.positionRange = { end: -1, start: 0, valid: false };
    }

    if (state.positionRange.valid && index >= state.positionRange.start && index <= state.positionRange.end) {
        return;
    }

    const newStart = state.positionRange.valid ? Math.min(state.positionRange.start, index) : 0;
    const newEnd = Math.min(
        state.props.data.length - 1,
        Math.max(state.positionRange.valid ? state.positionRange.end : 0, index + 50),
    );

    updateItemPositions(ctx, state, false, newStart, newEnd);
}

export function updateItemPositions(
    ctx: StateContext,
    state: InternalState,
    dataChanged?: boolean,
    startIndex = 0,
    endIndex?: number,
) {
    const {
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

    let currentRowTop = 0;
    let column = 1;
    let maxSizeInRow = 0;

    const hasColumns = numColumns > 1;
    const dataLength = data!.length;

    // Determine required range for optimization
    const requiredRange = getRequiredRange(ctx, state);
    const shouldOptimize = dataLength >= 500;
    const optimizedEndIndex = shouldOptimize ? Math.min(dataLength - 1, requiredRange.end) : dataLength - 1;
    const actualEndIndex = endIndex !== undefined ? Math.min(endIndex, dataLength - 1) : optimizedEndIndex;

    // Handle fast scrolling gaps: ensure we maintain position continuity by filling any gaps
    let adjustedStartIndex = startIndex;
    let adjustedEndIndex = actualEndIndex;

    if (state.positionRange?.valid && !dataChanged && shouldOptimize) {
        const existingStart = state.positionRange.start;
        const existingEnd = state.positionRange.end;
        const requiredStart = requiredRange.start;
        const requiredEnd = requiredRange.end;

        // Always ensure continuity by expanding our calculation range to cover any gaps
        if (requiredStart <= existingEnd + 1 && requiredEnd >= existingStart - 1) {
            // Ranges overlap or are adjacent - extend to cover both
            adjustedStartIndex = Math.min(startIndex, Math.min(existingStart, requiredStart));
            adjustedEndIndex = Math.max(actualEndIndex, Math.max(existingEnd, requiredEnd));
        } else if (requiredStart > existingEnd + 1) {
            // Gap forward: fill from end of existing to new range
            adjustedStartIndex = Math.min(startIndex, existingEnd + 1);
            adjustedEndIndex = Math.max(actualEndIndex, requiredEnd);
        } else if (requiredEnd < existingStart - 1) {
            // Gap backward: fill from new range to start of existing
            adjustedStartIndex = Math.min(startIndex, requiredStart);
            adjustedEndIndex = Math.max(actualEndIndex, existingStart - 1);
        }
    }

    // If starting from a non-zero index, continue from previous item's state
    if (adjustedStartIndex > 0) {
        const prevIndex = adjustedStartIndex - 1;
        const prevId = idCache.get(prevIndex) ?? getId(state, prevIndex)!;
        const prevPosition = positions.get(prevId) ?? 0;

        if (hasColumns) {
            const prevColumn = columns.get(prevId) ?? 1;
            currentRowTop = prevPosition;
            column = (prevColumn % numColumns) + 1;
        } else {
            const prevSize =
                sizesKnown.get(prevId) ?? getItemSize(state, prevId, prevIndex, data[prevIndex], useAverageSize);
            currentRowTop = prevPosition + prevSize;
        }
    }

    const needsIndexByKey = dataChanged || indexByKey.size === 0;

    // Note that this loop is micro-optimized because it's a hot path

    let actualEndReached = adjustedStartIndex;

    for (let i = adjustedStartIndex; i < dataLength; i++) {
        const id = idCache.get(i) ?? getId(state, i)!;
        const size = sizesKnown.get(id) ?? getItemSize(state, id, i, data[i], useAverageSize);

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

        // Early bailout optimization
        actualEndReached = i;
        if (shouldOptimize && i >= adjustedEndIndex && (!state.scrollingTo?.index || i >= state.scrollingTo.index)) {
            break;
        }
    }

    // Update position range tracking
    if (!state.positionRange) {
        state.positionRange = { end: -1, start: 0, valid: false };
    }

    // If data changed, invalidate the range and reset it
    if (dataChanged) {
        state.positionRange = {
            end: actualEndReached,
            start: adjustedStartIndex,
            valid: true,
        };
    } else {
        // Extend the existing range
        state.positionRange = {
            end: Math.max(state.positionRange.valid ? state.positionRange.end : actualEndReached, actualEndReached),
            start: Math.min(
                state.positionRange.valid ? state.positionRange.start : adjustedStartIndex,
                adjustedStartIndex,
            ),
            valid: true,
        };
    }

    updateTotalSize(ctx, state);

    if (snapToIndices) {
        updateSnapToOffsets(ctx, state);
    }
}
