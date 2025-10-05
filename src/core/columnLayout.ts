import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

// Multi-column layout helpers used by the hot positioning paths to keep
// column bookkeeping and row math centralized.

interface ColumnStartState {
    startIndex: number;
    currentRowTop: number;
    column: number;
    maxSizeInRow: number;
    numColumns: number;
}

// Determine the correct start index and layout offsets before continuing a
// position sweep from an arbitrary index.
export function prepareColumnStartState(
    ctx: StateContext,
    state: InternalState,
    startIndex: number,
    useAverageSize: boolean,
    numColumnsOverride?: number,
): ColumnStartState {
    const data = state.props.data;
    const dataLength = data ? data.length : 0;
    const numColumns = numColumnsOverride ?? peek$(ctx, "numColumns");

    let currentRowTop = 0;
    let column = 1;
    let maxSizeInRow = 0;

    // Nothing to do without data; bail quickly so callers can keep their hot path simple.
    if (!data || dataLength === 0) {
        return { column, currentRowTop, maxSizeInRow, numColumns, startIndex: 0 };
    }

    const normalizedStartIndex = Math.max(0, startIndex);

    // Starting from index 0 means we can keep the initial defaults.
    if (normalizedStartIndex === 0) {
        return {
            column,
            currentRowTop,
            maxSizeInRow,
            numColumns,
            startIndex: normalizedStartIndex,
        };
    }

    // Adjust the user-provided index so we resume from a row boundary when necessary.
    let adjustedStartIndex = normalizedStartIndex;

    const hasColumns = numColumns > 1;

    if (hasColumns && adjustedStartIndex < dataLength) {
        const startColumn = getColumnForIndex(state, numColumns, adjustedStartIndex);
        if (startColumn !== 1) {
            // Snap back to the item in column 1 so the upcoming sweep recomputes the full row.
            adjustedStartIndex = findRowStartIndex(state, numColumns, adjustedStartIndex);
        }
    }

    if (adjustedStartIndex === 0) {
        return { column, currentRowTop, maxSizeInRow, numColumns, startIndex: 0 };
    }

    if (adjustedStartIndex < dataLength) {
        const prevIndex = adjustedStartIndex - 1;
        const prevId = getIdForIndex(state, prevIndex);
        const prevPosition = state.positions.get(prevId) ?? 0;

        if (hasColumns) {
            const prevColumn = state.columns.get(prevId) ?? (prevIndex % numColumns) + 1;
            column = (prevColumn % numColumns) + 1;

            if (column === 1) {
                // We wrapped to the next row; push the top offset by the tallest item in the previous row.
                const prevRowStartIndex = findRowStartIndex(state, numColumns, prevIndex);
                const prevRowHeight = calculateRowMaxSize(state, prevRowStartIndex, prevIndex, useAverageSize);
                currentRowTop = prevPosition + prevRowHeight;
            } else {
                // Still on the same row; reuse the current baseline but preload the current row max height.
                currentRowTop = prevPosition;
                const rowStartIndex = findRowStartIndex(state, numColumns, adjustedStartIndex);
                maxSizeInRow = calculateRowMaxSize(state, rowStartIndex, adjustedStartIndex - 1, useAverageSize);
            }
        } else {
            // Single-column logic: just append the last item's size to the previous position.
            const prevSize =
                state.sizesKnown.get(prevId) ?? getItemSize(state, prevId, prevIndex, data[prevIndex], useAverageSize);
            currentRowTop = prevPosition + prevSize;
        }
    }

    return { column, currentRowTop, maxSizeInRow, numColumns, startIndex: adjustedStartIndex };
}

// Resolve the effective column for the provided index, even when the columns
// map has not been populated yet.
export function getColumnIndex(ctx: StateContext, state: InternalState, index: number): number {
    const numColumns = peek$(ctx, "numColumns");
    return getColumnForIndex(state, numColumns, index);
}

// Locate the index of the first item in the row that contains the supplied index.
export function getRowStartIndex(ctx: StateContext, state: InternalState, index: number): number {
    const numColumns = peek$(ctx, "numColumns");
    return findRowStartIndex(state, numColumns, index);
}

// Prefer cached IDs to avoid repeatedly invoking the key extractor.
function getIdForIndex(state: InternalState, index: number): string {
    const cached = state.idCache.get(index);
    if (cached !== undefined) {
        return cached;
    }
    return getId(state, index)!;
}

function getColumnForIndex(state: InternalState, numColumns: number, index: number): number {
    if (numColumns <= 1 || index < 0) {
        return 1;
    }
    const id = getIdForIndex(state, index);
    const column = state.columns.get(id);
    return column ?? (index % numColumns) + 1;
}

function findRowStartIndex(state: InternalState, numColumns: number, index: number): number {
    if (numColumns <= 1) {
        return Math.max(0, index);
    }

    let rowStart = Math.max(0, index);
    while (rowStart > 0) {
        const columnForIndex = getColumnForIndex(state, numColumns, rowStart);
        if (columnForIndex === 1) {
            break;
        }
        rowStart--;
    }
    return rowStart;
}

// Compute the tallest item height within the inclusive range to advance the row baseline.
function calculateRowMaxSize(
    state: InternalState,
    startIndex: number,
    endIndex: number,
    useAverageSize: boolean,
): number {
    if (endIndex < startIndex) {
        return 0;
    }

    const { data } = state.props;
    if (!data) {
        return 0;
    }

    let maxSize = 0;
    for (let i = startIndex; i <= endIndex; i++) {
        if (i < 0 || i >= data.length) {
            continue;
        }
        const id = getIdForIndex(state, i);
        const size = state.sizesKnown.get(id) ?? getItemSize(state, id, i, data[i], useAverageSize);
        if (size > maxSize) {
            maxSize = size;
        }
    }
    return maxSize;
}
