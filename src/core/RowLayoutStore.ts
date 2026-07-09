import type { LayoutIndexRange, LayoutStoreSizeEntry, MutableLayoutStore } from "@/core/LayoutStore";
import { PrefixLayoutStore } from "@/core/PrefixLayoutStore";

const SIZE_CACHED = 1;
const SIZE_MEASURED = 2;

type SizeKind = typeof SIZE_CACHED | typeof SIZE_MEASURED;

interface KnownItemSize {
    kind: SizeKind;
    size: number;
}

interface SpanTopology {
    columns: Uint16Array;
    itemRowIndexes: Uint32Array;
    rowEndIndexes: number[];
    rowStartIndexes: number[];
    spans: Uint16Array;
}

export interface RowLayoutStoreOptions {
    estimatedSize: number;
    length: number;
    numColumns: number;
    spans?: ArrayLike<number | undefined>;
}

export class RowLayoutStore implements MutableLayoutStore {
    private estimatedSize: number;
    private knownSizes = new Map<number, KnownItemSize>();
    private lengthValue: number;
    private measuredCount = 0;
    private measuredSizeTotal = 0;
    private numColumns: number;
    private rowLayout: PrefixLayoutStore;
    private spanInput?: ArrayLike<number | undefined>;
    private spanTopology?: SpanTopology;

    constructor(options: RowLayoutStoreOptions) {
        this.lengthValue = normalizeLength(options.length);
        this.estimatedSize = normalizeSize(options.estimatedSize);
        this.numColumns = normalizeNumColumns(options.numColumns);
        this.spanInput = options.spans;
        this.spanTopology = options.spans ? createSpanTopology(this.length, this.numColumns, options.spans) : undefined;
        this.rowLayout = new PrefixLayoutStore(this.getRowCount(), this.estimatedSize);
    }

    get length() {
        return this.lengthValue;
    }

    clearKnownSizes() {
        this.knownSizes.clear();
        this.measuredCount = 0;
        this.measuredSizeTotal = 0;
        this.rowLayout = new PrefixLayoutStore(this.getRowCount(), this.estimatedSize);
    }

    findIndexRangeAtOffsets(startOffset: number, endOffset: number): LayoutIndexRange | undefined {
        const rowRange = this.rowLayout.findIndexRangeAtOffsets(startOffset, endOffset);
        return rowRange
            ? {
                  end: this.getRowEndIndex(rowRange.end),
                  start: this.getRowStartIndex(rowRange.start),
              }
            : undefined;
    }

    forEachLayout(
        startIndex: number,
        endIndex: number,
        callback: (index: number, offset: number, size: number) => void,
    ) {
        const start = Math.max(0, Math.trunc(startIndex));
        const end = Math.min(this.length - 1, Math.trunc(endIndex));

        if (start <= end) {
            let previousRowIndex = -1;
            let offset = 0;
            for (let index = start; index <= end; index++) {
                const rowIndex = this.getRowIndex(index);
                if (rowIndex !== previousRowIndex) {
                    offset = this.rowLayout.getOffset(rowIndex);
                    previousRowIndex = rowIndex;
                }
                callback(index, offset, this.getSize(index));
            }
        }
    }

    getColumn(index: number) {
        this.assertIndex(index);
        return this.spanTopology?.columns[index] || (index % this.numColumns) + 1;
    }

    getOffset(index: number) {
        this.assertIndex(index);
        return this.rowLayout.getOffset(this.getRowIndex(index));
    }

    getSize(index: number) {
        this.assertIndex(index);
        return this.knownSizes.get(index)?.size ?? this.estimatedSize;
    }

    getSpan(index: number) {
        this.assertIndex(index);
        return this.spanTopology?.spans[index] || 1;
    }

    getTotalSize() {
        return this.rowLayout.getTotalSize();
    }

    getMeasuredAverageSize() {
        return this.measuredCount > 0 ? this.measuredSizeTotal / this.measuredCount : undefined;
    }

    getMeasuredCount() {
        return this.measuredCount;
    }

    getEstimatedSize() {
        return this.estimatedSize;
    }

    hasIndex(index: number | undefined): index is number {
        return index !== undefined && Number.isInteger(index) && index >= 0 && index < this.length;
    }

    replaceKnownSizeEntries(entries: LayoutStoreSizeEntry[]) {
        for (const entry of entries) {
            this.assertIndex(entry.index);
            normalizeSize(entry.size);
        }

        const knownSizes = new Map<number, KnownItemSize>();
        for (const entry of entries) {
            const existing = knownSizes.get(entry.index);
            if (entry.type === "measured") {
                knownSizes.set(entry.index, { kind: SIZE_MEASURED, size: entry.size });
            } else if (existing?.kind !== SIZE_MEASURED) {
                knownSizes.set(entry.index, { kind: SIZE_CACHED, size: entry.size });
            }
        }
        this.knownSizes = knownSizes;
        this.rebuildRowsAndTotals();
    }

    invalidateRange(index: number, count: number) {
        assertMutationRange(this.length, index, count, "invalidateRange");
        if (count > 0) {
            const end = index + count;
            for (const knownIndex of this.knownSizes.keys()) {
                if (knownIndex >= index && knownIndex < end) {
                    this.knownSizes.delete(knownIndex);
                }
            }
            this.rebuildRowsAndTotals();
        }
    }

    move(from: number, to: number, count: number) {
        assertMoveRange(this.length, from, to, count);
        if (count > 0 && from !== to) {
            const knownSizes = new Map<number, KnownItemSize>();
            for (const [index, entry] of this.knownSizes) {
                knownSizes.set(transformMoveIndex(index, from, to, count), entry);
            }
            this.knownSizes = knownSizes;
            const spans = this.getMutableSpans();
            if (spans) {
                const moved = spans.splice(from, count);
                spans.splice(to, 0, ...moved);
                this.spanInput = spans;
                this.spanTopology = createSpanTopology(this.length, this.numColumns, spans);
            }
            this.rebuildRowsAndTotals();
        }
    }

    resize(
        length: number,
        spans?: ArrayLike<number | undefined>,
        numColumns = this.numColumns,
        topologyInvalidationIndex?: number,
    ) {
        const normalizedLength = normalizeLength(length);
        const normalizedNumColumns = normalizeNumColumns(numColumns);
        const didTopologyChange =
            topologyInvalidationIndex !== undefined ||
            normalizedLength !== this.length ||
            normalizedNumColumns !== this.numColumns ||
            spans !== this.spanInput;

        if (didTopologyChange) {
            const canUpdateTopologyTail =
                topologyInvalidationIndex !== undefined &&
                normalizedLength === this.length &&
                normalizedNumColumns === this.numColumns &&
                spans !== undefined &&
                this.spanTopology !== undefined;
            this.lengthValue = normalizedLength;
            this.numColumns = normalizedNumColumns;
            this.spanInput = spans;
            if (canUpdateTopologyTail) {
                updateSpanTopologyTail(
                    this.spanTopology!,
                    this.length,
                    this.numColumns,
                    spans,
                    topologyInvalidationIndex,
                );
            } else {
                this.spanTopology = spans ? createSpanTopology(this.length, this.numColumns, spans) : undefined;
            }
            this.pruneKnownSizes();
            this.rebuildRowsAndTotals();
        }
    }

    splice(index: number, deleteCount: number, insertCount: number) {
        assertMutationRange(this.length, index, deleteCount, "splice");
        normalizeLength(insertCount);
        if (deleteCount > 0 || insertCount > 0) {
            const deletedEnd = index + deleteCount;
            const knownSizes = new Map<number, KnownItemSize>();
            for (const [knownIndex, entry] of this.knownSizes) {
                if (knownIndex < index) {
                    knownSizes.set(knownIndex, entry);
                } else if (knownIndex >= deletedEnd) {
                    knownSizes.set(knownIndex + insertCount - deleteCount, entry);
                }
            }
            this.knownSizes = knownSizes;
            const spans = this.getMutableSpans();
            if (spans) {
                spans.splice(index, deleteCount, ...new Array<number>(insertCount).fill(1));
                this.spanInput = spans;
            }
            this.lengthValue += insertCount - deleteCount;
            this.spanTopology = spans ? createSpanTopology(this.length, this.numColumns, spans) : undefined;
            this.rebuildRowsAndTotals();
        }
    }

    setEstimatedSize(estimatedSize: number) {
        const normalizedSize = normalizeSize(estimatedSize);
        if (normalizedSize !== this.estimatedSize) {
            this.estimatedSize = normalizedSize;
            this.rebuildRowsAndTotals();
        }
    }

    setMeasuredSize(index: number, size: number) {
        this.assertIndex(index);
        const normalizedSize = normalizeSize(size);
        const rowIndex = this.getRowIndex(index);
        const previousRowHeight = this.rowLayout.getSize(rowIndex);
        const previous = this.knownSizes.get(index);

        if (previous?.kind === SIZE_CACHED) {
            this.measuredCount++;
            this.measuredSizeTotal += normalizedSize;
        } else if (previous?.kind === SIZE_MEASURED) {
            this.measuredSizeTotal += normalizedSize - previous.size;
        } else {
            this.measuredCount++;
            this.measuredSizeTotal += normalizedSize;
        }

        this.knownSizes.set(index, { kind: SIZE_MEASURED, size: normalizedSize });
        this.syncRowHeight(rowIndex);
        return previousRowHeight !== this.rowLayout.getSize(rowIndex);
    }

    private assertIndex(index: number) {
        if (!this.hasIndex(index)) {
            throw new RangeError(`RowLayoutStore index ${index} is out of bounds for length ${this.length}`);
        }
    }

    private getRowCount() {
        return this.spanTopology?.rowStartIndexes.length ?? Math.ceil(this.length / this.numColumns);
    }

    private getRowEndIndex(rowIndex: number) {
        return (
            this.spanTopology?.rowEndIndexes[rowIndex] ??
            Math.min(this.length - 1, (rowIndex + 1) * this.numColumns - 1)
        );
    }

    private getRowIndex(index: number) {
        return this.spanTopology?.itemRowIndexes[index] ?? Math.floor(index / this.numColumns);
    }

    private getRowStartIndex(rowIndex: number) {
        return this.spanTopology?.rowStartIndexes[rowIndex] ?? rowIndex * this.numColumns;
    }

    private getMutableSpans() {
        let spans: number[] | undefined;
        if (this.spanTopology) {
            spans = Array.from({ length: this.length }, (_, index) => this.spanTopology?.spans[index] || 1);
        }
        return spans;
    }

    private pruneKnownSizes() {
        for (const index of this.knownSizes.keys()) {
            if (index >= this.length) {
                this.knownSizes.delete(index);
            }
        }
    }

    private rebuildRowsAndTotals() {
        this.measuredCount = 0;
        this.measuredSizeTotal = 0;
        this.rowLayout = new PrefixLayoutStore(this.getRowCount(), this.estimatedSize);
        const knownRows = new Set<number>();

        for (const [index, entry] of this.knownSizes) {
            knownRows.add(this.getRowIndex(index));
            if (entry.kind === SIZE_MEASURED) {
                this.measuredCount++;
                this.measuredSizeTotal += entry.size;
            }
        }
        for (const rowIndex of knownRows) {
            this.syncRowHeight(rowIndex);
        }
    }

    private syncRowHeight(rowIndex: number) {
        const start = this.getRowStartIndex(rowIndex);
        const end = this.getRowEndIndex(rowIndex);
        let knownCount = 0;
        let maxKnownSize = 0;

        for (let index = start; index <= end; index++) {
            const knownSize = this.knownSizes.get(index)?.size;
            if (knownSize !== undefined) {
                knownCount++;
                maxKnownSize = Math.max(maxKnownSize, knownSize);
            }
        }

        const itemCount = end - start + 1;
        if (knownCount === itemCount || maxKnownSize > this.estimatedSize) {
            this.rowLayout.setMeasuredSize(
                rowIndex,
                Math.max(maxKnownSize, knownCount < itemCount ? this.estimatedSize : 0),
            );
        } else {
            this.rowLayout.clearKnownSize(rowIndex);
        }
    }
}

function assertMoveRange(length: number, from: number, to: number, count: number) {
    assertMutationRange(length, from, count, "move");
    if (!Number.isInteger(to) || to < 0 || to > length - count) {
        throw new RangeError(
            `RowLayoutStore move destination ${to} is invalid for length ${length} and count ${count}`,
        );
    }
}

function assertMutationRange(length: number, index: number, count: number, operation: string) {
    if (!Number.isInteger(index) || !Number.isInteger(count) || index < 0 || count < 0 || index + count > length) {
        throw new RangeError(`RowLayoutStore ${operation} range ${index}:${count} is invalid for length ${length}`);
    }
}

function transformMoveIndex(index: number, from: number, to: number, count: number) {
    let nextIndex = index;
    if (index >= from && index < from + count) {
        nextIndex = to + index - from;
    } else {
        const indexAfterRemoval = index >= from + count ? index - count : index;
        nextIndex = indexAfterRemoval >= to ? indexAfterRemoval + count : indexAfterRemoval;
    }
    return nextIndex;
}

function createSpanTopology(
    length: number,
    numColumns: number,
    inputSpans: ArrayLike<number | undefined>,
): SpanTopology {
    const columns = new Uint16Array(length);
    const itemRowIndexes = new Uint32Array(length);
    const rowEndIndexes: number[] = [];
    const rowStartIndexes: number[] = [];
    const spans = new Uint16Array(length);
    let column = 1;
    let rowIndex = -1;

    for (let index = 0; index < length; index++) {
        const span = normalizeSpan(inputSpans[index], numColumns);
        if (column + span - 1 > numColumns) {
            column = 1;
        }
        if (column === 1) {
            rowIndex++;
            rowStartIndexes[rowIndex] = index;
        }

        columns[index] = column;
        itemRowIndexes[index] = rowIndex;
        rowEndIndexes[rowIndex] = index;
        spans[index] = span;

        column += span;
        if (column > numColumns) {
            column = 1;
        }
    }

    return {
        columns,
        itemRowIndexes,
        rowEndIndexes,
        rowStartIndexes,
        spans,
    };
}

function updateSpanTopologyTail(
    topology: SpanTopology,
    length: number,
    numColumns: number,
    inputSpans: ArrayLike<number | undefined>,
    invalidationIndex: number,
) {
    const boundedIndex = Math.max(0, Math.min(length - 1, invalidationIndex));
    const firstRowIndex = topology.itemRowIndexes[boundedIndex] ?? 0;
    const startIndex = topology.rowStartIndexes[firstRowIndex] ?? 0;
    topology.rowStartIndexes.length = firstRowIndex;
    topology.rowEndIndexes.length = firstRowIndex;
    let column = 1;
    let rowIndex = firstRowIndex - 1;

    for (let index = startIndex; index < length; index++) {
        const span = normalizeSpan(inputSpans[index], numColumns);
        if (column + span - 1 > numColumns) {
            column = 1;
        }
        if (column === 1) {
            rowIndex++;
            topology.rowStartIndexes[rowIndex] = index;
        }

        topology.columns[index] = column;
        topology.itemRowIndexes[index] = rowIndex;
        topology.rowEndIndexes[rowIndex] = index;
        topology.spans[index] = span;

        column += span;
        if (column > numColumns) {
            column = 1;
        }
    }
}

function normalizeLength(length: number) {
    if (!Number.isInteger(length) || length < 0) {
        throw new RangeError(`RowLayoutStore length must be a non-negative integer. Received ${length}`);
    }
    return length;
}

function normalizeNumColumns(numColumns: number) {
    if (!Number.isInteger(numColumns) || numColumns < 1) {
        throw new RangeError(`RowLayoutStore numColumns must be a positive integer. Received ${numColumns}`);
    }
    return numColumns;
}

function normalizeSize(size: number) {
    if (!Number.isFinite(size) || size < 0) {
        throw new RangeError(`Layout size must be a finite non-negative number. Received ${size}`);
    }
    return size;
}

function normalizeSpan(span: number | undefined, numColumns: number) {
    let normalizedSpan = 1;
    if (span !== undefined && Number.isFinite(span)) {
        normalizedSpan = Math.max(1, Math.min(numColumns, Math.round(span)));
    }
    return normalizedSpan;
}
