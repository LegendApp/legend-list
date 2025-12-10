import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getItemSize } from "@/utils/getItemSize";

// Multi-column layout helpers used by the hot positioning paths to keep
// column bookkeeping and row math centralized.

interface ColumnStartState {
    startIndex: number;
    currentRowTop: number;
    column: number;
}

// Determine the correct start index and layout offsets before continuing a
// position sweep from an arbitrary index.
export function prepareColumnStartState(
    ctx: StateContext,
    startIndex: number,
    useAverageSize: boolean,
): ColumnStartState {
    const state = ctx.state;
    const numColumns = peek$(ctx, "numColumns");

    let rowStartIndex = startIndex;
    const columnAtStart = state.columns.get(state.idCache[startIndex]!)!;
    if (columnAtStart !== 1) {
        rowStartIndex = findRowStartIndex(state, numColumns, startIndex);
    }

    let currentRowTop = 0;
    const curId = state.idCache[rowStartIndex]!;
    const column = state.columns.get(curId)!;

    if (rowStartIndex > 0) {
        const prevIndex = rowStartIndex - 1;
        const prevId = state.idCache[prevIndex]!;
        const prevPosition = state.positions.get(prevId) ?? 0;

        const prevRowStart = findRowStartIndex(state, numColumns, prevIndex);
        const prevRowHeight = calculateRowMaxSize(ctx, prevRowStart, prevIndex, useAverageSize);

        currentRowTop = prevPosition + prevRowHeight;
    }

    return {
        column,
        currentRowTop,
        startIndex: rowStartIndex,
    };
}

function findRowStartIndex(state: InternalState, numColumns: number, index: number): number {
    if (numColumns <= 1) {
        return Math.max(0, index);
    }

    let rowStart = Math.max(0, index);
    while (rowStart > 0) {
        const columnForIndex = state.columns.get(state.idCache[rowStart]!)!;
        if (columnForIndex === 1) {
            break;
        }
        rowStart--;
    }
    return rowStart;
}

// Compute the tallest item height within the inclusive range to advance the row baseline.
function calculateRowMaxSize(ctx: StateContext, startIndex: number, endIndex: number, useAverageSize: boolean): number {
    const state = ctx.state;
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
        const id = state.idCache[i]!;
        const size = getItemSize(ctx, id, i, data[i], useAverageSize);
        if (size > maxSize) {
            maxSize = size;
        }
    }
    return maxSize;
}
