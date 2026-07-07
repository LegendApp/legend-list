import { addTotalSize } from "@/core/addTotalSize";
import { Platform } from "@/platform/Platform";
import { notifyPosition$, peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

export interface UpdateItemPositionsOptions {
    doMVCP: boolean | undefined;
    forceFullUpdate?: boolean;
    optimizeForVisibleWindow?: boolean;
    scrollBottomBuffered: number;
    scrollVelocity?: number;
    startIndex: number;
}

interface ColumnStartState {
    column: number;
    currentRowTop: number;
    startIndex: number;
}

export function clearArrayLayoutCache(state: InternalState, options?: { includeColumns?: boolean }) {
    state.positions.length = 0;
    if (options?.includeColumns) {
        state.columns.length = 0;
        state.columnSpans.length = 0;
    }
}

export function updateArrayItemPositions(
    ctx: StateContext,
    dataChanged: boolean | undefined,
    {
        doMVCP,
        forceFullUpdate = false,
        optimizeForVisibleWindow = false,
        scrollBottomBuffered,
        scrollVelocity,
        startIndex,
    }: UpdateItemPositionsOptions = {
        doMVCP: false,
        forceFullUpdate: false,
        optimizeForVisibleWindow: false,
        scrollBottomBuffered: -1,
        startIndex: 0,
    },
) {
    const state = ctx.state;
    const hasPositionListeners = ctx.positionListeners.size > 0;
    const {
        columns,
        columnSpans,
        indexByKey,
        positions,
        idCache,
        sizesKnown,
        props: { data, overrideItemLayout, snapToIndices },
        scrollingTo,
    } = state;
    const dataLength = data!.length;
    const numColumns = peek$(ctx, "numColumns") ?? 1;
    const hasColumns = numColumns > 1;
    const indexByKeyForChecking = IS_DEV ? new Map() : undefined;
    const extraData = peek$(ctx, "extraData");
    const layoutConfig = overrideItemLayout ? { span: 1 } : undefined;

    // Early-break optimization: when the list is stable (no forceFullUpdate/data change) and either scroll velocity
    // is non-zero or a large scroll delta indicates a jump, cap position calculations to the visible window plus buffer
    // instead of walking the full list
    const lastScrollDelta = state.lastScrollDelta;
    const velocity = scrollVelocity ?? getScrollVelocity(state);
    const shouldOptimize =
        !forceFullUpdate &&
        !dataChanged &&
        (optimizeForVisibleWindow ||
            Math.abs(velocity) > 0 ||
            (Platform.OS === "web" && state.scrollLength > 0 && lastScrollDelta > state.scrollLength));

    const maxVisibleArea = scrollBottomBuffered + 1000;

    const useAverageSize = true;
    const preferCachedSize =
        !doMVCP ||
        dataChanged ||
        state.scrollAdjustHandler.getAdjust() !== 0 ||
        (peek$(ctx, "scrollAdjustPending") ?? 0) !== 0;
    const notifyTotalSizeWhileCachingSizes = false;

    let currentRowTop = 0;
    let column = 1;
    let maxSizeInRow = 0;

    if (dataChanged) {
        columnSpans.length = 0;
    }
    if (!hasColumns) {
        if (columns.length) {
            columns.length = 0;
        }
        if (columnSpans.length) {
            columnSpans.length = 0;
        }
    }

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
            const prevPosition = getArrayLayoutOffset(state, prevIndex) ?? 0;
            const prevSize =
                sizesKnown.get(prevId) ??
                getItemSize(
                    ctx,
                    prevId,
                    prevIndex,
                    data[prevIndex],
                    useAverageSize,
                    preferCachedSize,
                    notifyTotalSizeWhileCachingSizes,
                );
            currentRowTop = prevPosition + prevSize;
        }
    }

    const needsIndexByKey = dataChanged || indexByKey.size === 0;
    const canOverrideSpan = hasColumns && !!overrideItemLayout && !!layoutConfig;

    let didBreakEarly = false;

    let breakAt: number | undefined;
    // Note that this loop is micro-optimized because it's a hot path
    for (let i = startIndex; i < dataLength; i++) {
        if (shouldOptimize && breakAt !== undefined && i > breakAt) {
            didBreakEarly = true;
            break;
        }
        // Early exit if we've processed items beyond the visible area
        // This is a performance optimization to constrain the number of items processed
        if (shouldOptimize && breakAt === undefined && !scrollingTo && !dataChanged && currentRowTop > maxVisibleArea) {
            // Finish laying out the current row before breaking to avoid gaps
            // when an item exceeds the viewport height
            const itemsPerRow = hasColumns ? numColumns : 1;
            // We don't want to break immediately because it can cause
            // issues with items that are much taller than screen size
            // So we add a buffer before breaking
            breakAt = i + itemsPerRow + 10;
        }

        // Inline the map get calls to avoid the overhead of the function call
        const id = idCache[i] ?? getId(state, i)!;
        let span = 1;
        if (canOverrideSpan) {
            layoutConfig!.span = 1;
            overrideItemLayout!(layoutConfig!, data[i], i, numColumns, extraData);
            const requestedSpan = layoutConfig!.span;
            if (requestedSpan !== undefined && Number.isFinite(requestedSpan)) {
                span = Math.max(1, Math.min(numColumns, Math.round(requestedSpan)));
            }
        }

        if (hasColumns && column + span - 1 > numColumns) {
            // Move to next row when item doesn't fit in remaining columns
            currentRowTop += maxSizeInRow;
            column = 1;
            maxSizeInRow = 0;
        }

        const knownSize = sizesKnown.get(id);
        const size =
            knownSize !== undefined
                ? knownSize
                : getItemSize(ctx, id, i, data[i], useAverageSize, preferCachedSize, notifyTotalSizeWhileCachingSizes);

        // Set index mapping for this item
        if (IS_DEV && needsIndexByKey) {
            if (indexByKeyForChecking!.has(id)) {
                console.error(
                    `[legend-list] Error: Detected overlapping key (${id}) which causes missing items and gaps and other terrrible things. Check that keyExtractor returns unique values.`,
                );
            }
            indexByKeyForChecking!.set(id, i);
        }

        if (currentRowTop !== positions[i]) {
            // Set position for this item
            positions[i] = currentRowTop;
            if (hasPositionListeners) {
                notifyPosition$(ctx, id, currentRowTop);
            }
        }

        // Update indexByKey if needed
        if (needsIndexByKey) {
            indexByKey.set(id, i);
        }

        // Single-column fast path: skip column/span writes and row fit checks
        if (!hasColumns) {
            currentRowTop += size;
        } else {
            // Set column data for this item
            columns[i] = column;
            columnSpans[i] = span;

            if (size > maxSizeInRow) {
                maxSizeInRow = size;
            }

            column += span;
            if (column > numColumns) {
                // Move to next row
                currentRowTop += maxSizeInRow;
                column = 1;
                maxSizeInRow = 0;
            }
        }
    }

    // If we didn't break early, update total size
    // otherwise expect that a diff will be applied while updating item sizes
    if (!didBreakEarly) {
        updateTotalSizeFromArrayLayout(ctx, state);
    }

    if (snapToIndices) {
        updateSnapToOffsets(ctx);
    }
}

function updateTotalSizeFromArrayLayout(ctx: StateContext, state: InternalState) {
    const {
        props: { data },
    } = state;
    const numColumns = peek$(ctx, "numColumns") ?? 1;

    if (data.length === 0) {
        addTotalSize(ctx, null, 0);
    } else {
        const lastIndex = data.length - 1;
        const lastId = getId(state, lastIndex);
        const lastPosition = getArrayLayoutOffset(state, lastIndex);
        if (lastId !== undefined && lastPosition !== undefined) {
            if (numColumns > 1) {
                let rowStart = lastIndex;
                while (rowStart > 0) {
                    const column = state.columns[rowStart];
                    if (column === 1 || column === undefined) {
                        break;
                    }
                    rowStart -= 1;
                }

                let maxSize = 0;
                for (let i = rowStart; i <= lastIndex; i++) {
                    const rowId = state.idCache[i] ?? getId(state, i);
                    const size = getItemSize(ctx, rowId, i, data[i]);
                    if (size > maxSize) {
                        maxSize = size;
                    }
                }

                addTotalSize(ctx, null, lastPosition + maxSize);
            } else {
                const lastSize = getItemSize(ctx, lastId, lastIndex, data[lastIndex]);
                if (lastSize !== undefined) {
                    const totalSize = lastPosition + lastSize;
                    addTotalSize(ctx, null, totalSize);
                }
            }
        }
    }
}

function prepareColumnStartState(
    ctx: StateContext,
    state: InternalState,
    startIndex: number,
    useAverageSize: boolean,
): ColumnStartState {
    const numColumns = peek$(ctx, "numColumns");

    let rowStartIndex = startIndex;
    const columnAtStart = state.columns[startIndex]!;
    if (columnAtStart !== 1) {
        rowStartIndex = findRowStartIndex(state, numColumns, startIndex);
    }

    let currentRowTop = 0;
    const column = state.columns[rowStartIndex]!;

    if (rowStartIndex > 0) {
        const prevIndex = rowStartIndex - 1;
        const prevPosition = getArrayLayoutOffset(state, prevIndex) ?? 0;

        const prevRowStart = findRowStartIndex(state, numColumns, prevIndex);
        const prevRowHeight = calculateRowMaxSize(ctx, state, prevRowStart, prevIndex, useAverageSize);

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
        const columnForIndex = state.columns[rowStart]!;
        if (columnForIndex === 1) {
            break;
        }
        rowStart--;
    }
    return rowStart;
}

function calculateRowMaxSize(
    ctx: StateContext,
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
        const id = state.idCache[i]!;
        const size = getItemSize(ctx, id, i, data[i], useAverageSize);
        if (size > maxSize) {
            maxSize = size;
        }
    }
    return maxSize;
}

function getArrayLayoutOffset(state: InternalState, index: number | undefined) {
    return index !== undefined && Number.isInteger(index) && index >= 0 ? state.positions[index] : undefined;
}
