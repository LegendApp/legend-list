import { FenwickTree } from "@/core/FenwickTree";

const SIZE_UNKNOWN = 0;
const SIZE_CACHED = 1;
const SIZE_MEASURED = 2;

export interface PrefixLayoutStoreSizeEntry {
    index: number;
    size: number;
    type: "cached" | "measured";
}

export class PrefixLayoutStore {
    // Prefix mode intentionally uses one scalar estimate for all unmeasured rows.
    // Per-item-type averages stay in the array layout path until rows are measured.
    private estimatedSize: number;
    private knownCountTree: FenwickTree;
    private knownSizes: Float64Array;
    private knownSizeTree: FenwickTree;
    private measuredCount = 0;
    private measuredSizeTotal = 0;
    private sizeKinds: Uint8Array;

    constructor(length: number, estimatedSize: number) {
        const normalizedLength = normalizeLength(length);
        this.estimatedSize = normalizeSize(estimatedSize);
        this.knownCountTree = new FenwickTree(normalizedLength);
        this.knownSizes = new Float64Array(normalizedLength);
        this.knownSizeTree = new FenwickTree(normalizedLength);
        this.sizeKinds = new Uint8Array(normalizedLength);
    }

    get length() {
        return this.knownSizes.length;
    }

    findIndexAtOffset(offset: number) {
        let low = 0;
        let high = this.length;

        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const end = this.getOffset(mid) + this.getSize(mid);
            if (end > offset) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        return low < this.length ? low : undefined;
    }

    findIndexRangeAtOffsets(startOffset: number, endOffset: number): { end: number; start: number } | undefined {
        let range: { end: number; start: number } | undefined;
        if (this.length > 0) {
            const start = this.findIndexAtOffset(startOffset) ?? this.length - 1;
            const end = this.findIndexAtOffset(endOffset) ?? this.length - 1;
            range = {
                end: Math.max(start, end),
                start,
            };
        }
        return range;
    }

    clearMeasurements() {
        this.clearSizeArrays();
        this.knownCountTree.clear();
        this.knownSizeTree.clear();
    }

    flushEstimatedSize(estimatedSize: number) {
        this.estimatedSize = normalizeSize(estimatedSize);
    }

    getEstimatedSize() {
        return this.estimatedSize;
    }

    getMeasuredAverageSize() {
        return this.measuredCount > 0 ? this.measuredSizeTotal / this.measuredCount : undefined;
    }

    getMeasuredCount() {
        return this.measuredCount;
    }

    hasIndex(index: number | undefined): index is number {
        return index !== undefined && Number.isInteger(index) && index >= 0 && index < this.length;
    }

    getOffset(index: number) {
        this.assertIndex(index);
        const knownCountBefore = this.knownCountTree.sumBefore(index);
        const knownSizeBefore = this.knownSizeTree.sumBefore(index);
        const estimatedCountBefore = index - knownCountBefore;
        return knownSizeBefore + estimatedCountBefore * this.estimatedSize;
    }

    getSize(index: number) {
        this.assertIndex(index);
        return this.sizeKinds[index] ? this.knownSizes[index] : this.estimatedSize;
    }

    getTotalSize() {
        const knownCount = this.knownCountTree.total();
        const knownSize = this.knownSizeTree.total();
        return knownSize + (this.length - knownCount) * this.estimatedSize;
    }

    forEachLayout(
        startIndex: number,
        endIndex: number,
        callback: (index: number, offset: number, size: number) => void,
    ) {
        const start = Math.max(0, Math.trunc(startIndex));
        const end = Math.min(this.length - 1, Math.trunc(endIndex));

        if (start <= end) {
            let offset = this.getOffset(start);
            for (let index = start; index <= end; index++) {
                const size = this.getSize(index);
                callback(index, offset, size);
                offset += size;
            }
        }
    }

    rebuildSizes(entries: PrefixLayoutStoreSizeEntry[]) {
        for (const entry of entries) {
            this.assertIndex(entry.index);
            normalizeSize(entry.size);
        }

        this.clearSizeArrays();

        for (const entry of entries) {
            const size = normalizeSize(entry.size);
            if (entry.type === "measured") {
                this.sizeKinds[entry.index] = SIZE_MEASURED;
                this.knownSizes[entry.index] = size;
            } else if (this.sizeKinds[entry.index] !== SIZE_MEASURED) {
                this.sizeKinds[entry.index] = SIZE_CACHED;
                this.knownSizes[entry.index] = size;
            }
        }

        this.syncTreesAndTotalsFromArrays();
    }

    resize(length: number) {
        const normalizedLength = normalizeLength(length);
        if (normalizedLength !== this.length) {
            const previousKinds = this.sizeKinds;
            const previousSizes = this.knownSizes;

            this.knownCountTree = new FenwickTree(normalizedLength);
            this.knownSizes = new Float64Array(normalizedLength);
            this.knownSizeTree = new FenwickTree(normalizedLength);
            this.sizeKinds = new Uint8Array(normalizedLength);

            const copyLength = Math.min(previousSizes.length, normalizedLength);
            this.knownSizes.set(previousSizes.subarray(0, copyLength));
            this.sizeKinds.set(previousKinds.subarray(0, copyLength));
            this.syncTreesAndTotalsFromArrays();
        }
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
            this.knownCountTree.add(index, 1);
        }

        this.sizeKinds[index] = SIZE_MEASURED;
        this.knownSizes[index] = normalizedSize;
        this.knownSizeTree.add(index, normalizedSize - previousSize);
    }

    private clearSizeArrays() {
        this.knownSizes.fill(0);
        this.measuredCount = 0;
        this.measuredSizeTotal = 0;
        this.sizeKinds.fill(SIZE_UNKNOWN);
    }

    private syncTreesAndTotalsFromArrays() {
        this.measuredCount = 0;
        this.measuredSizeTotal = 0;

        const knownCounts = new Uint8Array(this.length);
        for (let index = 0; index < this.length; index++) {
            const sizeKind = this.sizeKinds[index];
            const size = this.knownSizes[index];
            if (sizeKind !== SIZE_UNKNOWN) {
                knownCounts[index] = 1;
                if (sizeKind === SIZE_MEASURED) {
                    this.measuredCount++;
                    this.measuredSizeTotal += size;
                }
            }
        }

        this.knownCountTree.replaceValues(knownCounts);
        this.knownSizeTree.replaceValues(this.knownSizes);
    }

    private assertIndex(index: number) {
        if (!this.hasIndex(index)) {
            throw new RangeError(`PrefixLayoutStore index ${index} is out of bounds for length ${this.length}`);
        }
    }
}

function normalizeLength(length: number) {
    if (!Number.isInteger(length) || length < 0) {
        throw new RangeError(`PrefixLayoutStore length must be a non-negative integer. Received ${length}`);
    }
    return length;
}

function normalizeSize(size: number) {
    if (!Number.isFinite(size) || size < 0) {
        throw new RangeError(`Layout size must be a finite non-negative number. Received ${size}`);
    }
    return size;
}
