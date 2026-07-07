import { FenwickTree } from "@/core/FenwickTree";
import type { LayoutIndexRange, LayoutStore, LayoutStoreSizeEntry } from "@/core/LayoutStore";

const SIZE_UNKNOWN = 0;
const SIZE_CACHED = 1;
const SIZE_MEASURED = 2;

export interface RowLayoutStoreOptions {
    estimatedSize: number;
    length: number;
    numColumns: number;
    spans?: ArrayLike<number | undefined>;
}

export class RowLayoutStore implements LayoutStore {
    private columns: Uint16Array;
    private estimatedSize: number;
    private itemRowIndexes: Uint32Array;
    private knownSizes: Float64Array;
    private measuredCount = 0;
    private measuredSizeTotal = 0;
    private numColumns: number;
    private rowEndIndexes: number[] = [];
    private rowHeights = new Float64Array(0);
    private rowHeightTree = new FenwickTree(0);
    private rowStartIndexes: number[] = [];
    private sizeKinds: Uint8Array;
    private spans: Uint16Array;

    constructor(options: RowLayoutStoreOptions) {
        const length = normalizeLength(options.length);
        this.estimatedSize = normalizeSize(options.estimatedSize);
        this.numColumns = normalizeNumColumns(options.numColumns);
        this.columns = new Uint16Array(length);
        this.itemRowIndexes = new Uint32Array(length);
        this.knownSizes = new Float64Array(length);
        this.sizeKinds = new Uint8Array(length);
        this.spans = new Uint16Array(length);
        this.repack(options.spans);
    }

    get length() {
        return this.knownSizes.length;
    }

    clearKnownSizes() {
        this.knownSizes.fill(0);
        this.sizeKinds.fill(SIZE_UNKNOWN);
        this.rebuildRowsAndTotals();
    }

    findIndexRangeAtOffsets(startOffset: number, endOffset: number): LayoutIndexRange | undefined {
        let range: LayoutIndexRange | undefined;
        if (this.length > 0) {
            const startRow = this.findRowIndexAtOffset(startOffset) ?? this.rowStartIndexes.length - 1;
            const endRow = this.findRowIndexAtOffset(endOffset) ?? this.rowStartIndexes.length - 1;
            const clampedStartRow = Math.min(startRow, endRow);
            const clampedEndRow = Math.max(startRow, endRow);
            range = {
                end: this.rowEndIndexes[clampedEndRow]!,
                start: this.rowStartIndexes[clampedStartRow]!,
            };
        }
        return range;
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
                const rowIndex = this.itemRowIndexes[index]!;
                if (rowIndex !== previousRowIndex) {
                    offset = this.rowHeightTree.sumBefore(rowIndex);
                    previousRowIndex = rowIndex;
                }
                callback(index, offset, this.getSize(index));
            }
        }
    }

    getColumn(index: number) {
        this.assertIndex(index);
        return this.columns[index] || 1;
    }

    getOffset(index: number) {
        this.assertIndex(index);
        return this.rowHeightTree.sumBefore(this.itemRowIndexes[index]!);
    }

    getSize(index: number) {
        this.assertIndex(index);
        return this.getItemSize(index);
    }

    getSpan(index: number) {
        this.assertIndex(index);
        return this.spans[index] || 1;
    }

    getTotalSize() {
        return this.rowHeightTree.total();
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

        this.knownSizes.fill(0);
        this.sizeKinds.fill(SIZE_UNKNOWN);

        for (const entry of entries) {
            if (entry.type === "measured") {
                this.sizeKinds[entry.index] = SIZE_MEASURED;
                this.knownSizes[entry.index] = entry.size;
            } else if (this.sizeKinds[entry.index] !== SIZE_MEASURED) {
                this.sizeKinds[entry.index] = SIZE_CACHED;
                this.knownSizes[entry.index] = entry.size;
            }
        }

        this.rebuildRowsAndTotals();
    }

    resize(length: number, spans?: ArrayLike<number | undefined>, numColumns = this.numColumns) {
        const normalizedLength = normalizeLength(length);
        const normalizedNumColumns = normalizeNumColumns(numColumns);
        if (normalizedLength !== this.length) {
            const previousKinds = this.sizeKinds;
            const previousSizes = this.knownSizes;

            this.columns = new Uint16Array(normalizedLength);
            this.itemRowIndexes = new Uint32Array(normalizedLength);
            this.knownSizes = new Float64Array(normalizedLength);
            this.sizeKinds = new Uint8Array(normalizedLength);
            this.spans = new Uint16Array(normalizedLength);

            const copyLength = Math.min(previousSizes.length, normalizedLength);
            this.knownSizes.set(previousSizes.subarray(0, copyLength));
            this.sizeKinds.set(previousKinds.subarray(0, copyLength));
        }
        this.numColumns = normalizedNumColumns;
        this.repack(spans);
    }

    setEstimatedSize(estimatedSize: number) {
        this.estimatedSize = normalizeSize(estimatedSize);
        this.rebuildRowsAndTotals();
    }

    setMeasuredSize(index: number, size: number) {
        this.assertIndex(index);
        const normalizedSize = normalizeSize(size);
        const previousKind = this.sizeKinds[index];
        const previousSize = this.knownSizes[index];

        if (previousKind === SIZE_CACHED) {
            this.measuredCount++;
            this.measuredSizeTotal += normalizedSize;
        } else if (previousKind === SIZE_MEASURED) {
            this.measuredSizeTotal += normalizedSize - previousSize;
        } else {
            this.measuredCount++;
            this.measuredSizeTotal += normalizedSize;
        }

        this.sizeKinds[index] = SIZE_MEASURED;
        this.knownSizes[index] = normalizedSize;
        this.updateRowHeight(this.itemRowIndexes[index]!);
    }

    private findRowIndexAtOffset(offset: number) {
        let rowIndex: number | undefined;
        let low = 0;
        let high = this.rowStartIndexes.length;

        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const end = this.rowHeightTree.sumBefore(mid + 1);
            if (end > offset) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        if (low < this.rowStartIndexes.length) {
            rowIndex = low;
        }
        return rowIndex;
    }

    private getItemSize(index: number) {
        return this.sizeKinds[index] ? this.knownSizes[index]! : this.estimatedSize;
    }

    private getRowHeight(rowIndex: number) {
        let height = 0;
        const start = this.rowStartIndexes[rowIndex]!;
        const end = this.rowEndIndexes[rowIndex]!;

        for (let index = start; index <= end; index++) {
            const size = this.getItemSize(index);
            if (size > height) {
                height = size;
            }
        }
        return height;
    }

    private rebuildRowsAndTotals() {
        this.measuredCount = 0;
        this.measuredSizeTotal = 0;
        this.rowHeights = new Float64Array(this.rowStartIndexes.length);

        for (let rowIndex = 0; rowIndex < this.rowStartIndexes.length; rowIndex++) {
            this.rowHeights[rowIndex] = this.getRowHeight(rowIndex);
        }
        for (let index = 0; index < this.length; index++) {
            if (this.sizeKinds[index] === SIZE_MEASURED) {
                this.measuredCount++;
                this.measuredSizeTotal += this.knownSizes[index]!;
            }
        }

        this.rowHeightTree = new FenwickTree(this.rowHeights.length);
        this.rowHeightTree.replaceValues(this.rowHeights);
    }

    private repack(inputSpans?: ArrayLike<number | undefined>) {
        this.rowStartIndexes = [];
        this.rowEndIndexes = [];
        this.columns.fill(1);
        this.spans.fill(1);

        let column = 1;
        let rowIndex = -1;

        for (let index = 0; index < this.length; index++) {
            const span = normalizeSpan(inputSpans?.[index], this.numColumns);
            if (column + span - 1 > this.numColumns) {
                column = 1;
            }
            if (column === 1) {
                rowIndex++;
                this.rowStartIndexes[rowIndex] = index;
            }

            this.columns[index] = column;
            this.itemRowIndexes[index] = rowIndex;
            this.rowEndIndexes[rowIndex] = index;
            this.spans[index] = span;

            column += span;
            if (column > this.numColumns) {
                column = 1;
            }
        }

        this.rebuildRowsAndTotals();
    }

    private updateRowHeight(rowIndex: number) {
        const previousHeight = this.rowHeights[rowIndex]!;
        const nextHeight = this.getRowHeight(rowIndex);
        if (previousHeight !== nextHeight) {
            this.rowHeights[rowIndex] = nextHeight;
            this.rowHeightTree.add(rowIndex, nextHeight - previousHeight);
        }
    }

    private assertIndex(index: number) {
        if (!this.hasIndex(index)) {
            throw new RangeError(`RowLayoutStore index ${index} is out of bounds for length ${this.length}`);
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
