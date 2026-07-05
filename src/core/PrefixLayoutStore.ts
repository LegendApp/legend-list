import { FenwickTree } from "@/core/FenwickTree";

export interface MaterializedLayout {
    end: number;
    index: number;
    offset: number;
    size: number;
}

export interface PrefixLayoutStoreSizeEntry {
    index: number;
    key: string;
    size: number;
    type: "cached" | "measured";
}

export class PrefixLayoutStore {
    private cachedCountTree: FenwickTree;
    private cachedFlags: Uint8Array;
    private cachedKeys: Array<string | undefined>;
    private cachedSizes: Float64Array;
    private cachedSizeTree: FenwickTree;
    private estimatedSize: number;
    private measuredCountTree: FenwickTree;
    private measuredFlags: Uint8Array;
    private measuredKeys: Array<string | undefined>;
    private measuredSizes: Float64Array;
    private measuredSizeTree: FenwickTree;

    constructor(length: number, estimatedSize: number) {
        const normalizedLength = normalizeLength(length);
        this.cachedCountTree = new FenwickTree(normalizedLength);
        this.cachedFlags = new Uint8Array(normalizedLength);
        this.cachedKeys = new Array<string | undefined>(normalizedLength);
        this.cachedSizes = new Float64Array(normalizedLength);
        this.cachedSizeTree = new FenwickTree(normalizedLength);
        this.estimatedSize = normalizeSize(estimatedSize);
        this.measuredCountTree = new FenwickTree(normalizedLength);
        this.measuredFlags = new Uint8Array(normalizedLength);
        this.measuredKeys = new Array<string | undefined>(normalizedLength);
        this.measuredSizes = new Float64Array(normalizedLength);
        this.measuredSizeTree = new FenwickTree(normalizedLength);
    }

    get length() {
        return this.measuredSizes.length;
    }

    findIndexAtOffset(offset: number) {
        let match: number | undefined;
        if (this.length > 0) {
            let low = 0;
            let high = this.length - 1;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const end = this.getEnd(mid);
                if (end > offset) {
                    match = mid;
                    high = mid - 1;
                } else {
                    low = mid + 1;
                }
            }
        }
        return match;
    }

    clearMeasurements() {
        this.clearSizeArrays();
        this.syncTreesFromArrays();
    }

    flushEstimatedSize(estimatedSize: number) {
        this.estimatedSize = normalizeSize(estimatedSize);
    }

    getEnd(index: number) {
        return this.getOffset(index) + this.getSize(index);
    }

    getEstimatedSize() {
        return this.estimatedSize;
    }

    getMeasuredAverageSize() {
        const measuredCount = this.getMeasuredCount();
        return measuredCount > 0 ? this.getMeasuredSizeTotal() / measuredCount : undefined;
    }

    getMeasuredCount() {
        return this.measuredCountTree.total();
    }

    getMeasuredSizeTotal() {
        return this.measuredSizeTree.total();
    }

    getOffset(index: number) {
        this.assertIndex(index);
        const measuredCountBefore = this.measuredCountTree.sumBefore(index);
        const measuredSizeBefore = this.measuredSizeTree.sumBefore(index);
        const cachedCountBefore = this.cachedCountTree.sumBefore(index);
        const cachedSizeBefore = this.cachedSizeTree.sumBefore(index);
        const estimatedCountBefore = index - measuredCountBefore - cachedCountBefore;
        return measuredSizeBefore + cachedSizeBefore + estimatedCountBefore * this.estimatedSize;
    }

    getSize(index: number) {
        this.assertIndex(index);
        return this.measuredFlags[index]
            ? this.measuredSizes[index]
            : this.cachedFlags[index]
              ? this.cachedSizes[index]
              : this.estimatedSize;
    }

    getTotalSize() {
        const measuredCount = this.getMeasuredCount();
        const measuredSize = this.getMeasuredSizeTotal();
        const cachedCount = this.getCachedCount();
        const cachedSize = this.getCachedSizeTotal();
        return measuredSize + cachedSize + (this.length - measuredCount - cachedCount) * this.estimatedSize;
    }

    materializeRange(startIndex: number, endIndex: number) {
        const layouts: MaterializedLayout[] = [];
        const start = Math.max(0, Math.trunc(startIndex));
        const end = Math.min(this.length - 1, Math.trunc(endIndex));

        if (start <= end) {
            let offset = this.getOffset(start);
            for (let index = start; index <= end; index++) {
                const size = this.getSize(index);
                const nextOffset = offset + size;
                layouts.push({ end: nextOffset, index, offset, size });
                offset = nextOffset;
            }
        }

        return layouts;
    }

    rebuildSizes(entries: PrefixLayoutStoreSizeEntry[]) {
        const normalizedEntries = entries.map((entry) => {
            this.assertIndex(entry.index);
            return {
                ...entry,
                size: normalizeSize(entry.size),
            };
        });

        this.clearSizeArrays();

        for (const entry of normalizedEntries) {
            if (entry.type === "measured") {
                this.cachedFlags[entry.index] = 0;
                this.cachedKeys[entry.index] = undefined;
                this.cachedSizes[entry.index] = 0;
                this.measuredFlags[entry.index] = 1;
                this.measuredKeys[entry.index] = entry.key;
                this.measuredSizes[entry.index] = entry.size;
            } else if (!this.measuredFlags[entry.index]) {
                this.cachedFlags[entry.index] = 1;
                this.cachedKeys[entry.index] = entry.key;
                this.cachedSizes[entry.index] = entry.size;
            }
        }

        this.syncTreesFromArrays();
    }

    resize(length: number) {
        const normalizedLength = normalizeLength(length);
        if (normalizedLength !== this.length) {
            const previousCachedFlags = this.cachedFlags;
            const previousCachedKeys = this.cachedKeys;
            const previousCachedSizes = this.cachedSizes;
            const previousFlags = this.measuredFlags;
            const previousKeys = this.measuredKeys;
            const previousSizes = this.measuredSizes;

            this.cachedCountTree = new FenwickTree(normalizedLength);
            this.cachedFlags = new Uint8Array(normalizedLength);
            this.cachedKeys = new Array<string | undefined>(normalizedLength);
            this.cachedSizes = new Float64Array(normalizedLength);
            this.cachedSizeTree = new FenwickTree(normalizedLength);
            this.measuredCountTree = new FenwickTree(normalizedLength);
            this.measuredFlags = new Uint8Array(normalizedLength);
            this.measuredKeys = new Array<string | undefined>(normalizedLength);
            this.measuredSizes = new Float64Array(normalizedLength);
            this.measuredSizeTree = new FenwickTree(normalizedLength);

            const copyLength = Math.min(previousSizes.length, normalizedLength);
            for (let index = 0; index < copyLength; index++) {
                if (previousCachedFlags[index]) {
                    this.setCachedSize(index, previousCachedKeys[index] ?? "", previousCachedSizes[index]);
                }
                if (previousFlags[index]) {
                    this.setMeasuredSize(index, previousKeys[index] ?? "", previousSizes[index]);
                }
            }
        }
    }

    getCachedCount() {
        return this.cachedCountTree.total();
    }

    getCachedSizeTotal() {
        return this.cachedSizeTree.total();
    }

    setCachedSize(index: number, key: string, size: number) {
        this.assertIndex(index);
        if (!this.measuredFlags[index]) {
            const normalizedSize = normalizeSize(size);
            if (!this.cachedFlags[index]) {
                this.cachedFlags[index] = 1;
                this.cachedCountTree.set(index, 1);
            }

            this.cachedKeys[index] = key;
            this.cachedSizes[index] = normalizedSize;
            this.cachedSizeTree.set(index, normalizedSize);
        }
    }

    setMeasuredSize(index: number, key: string, size: number) {
        this.assertIndex(index);
        const normalizedSize = normalizeSize(size);
        if (this.cachedFlags[index]) {
            this.cachedFlags[index] = 0;
            this.cachedKeys[index] = undefined;
            this.cachedSizes[index] = 0;
            this.cachedCountTree.set(index, 0);
            this.cachedSizeTree.set(index, 0);
        }
        if (!this.measuredFlags[index]) {
            this.measuredFlags[index] = 1;
            this.measuredCountTree.set(index, 1);
        }

        this.measuredKeys[index] = key;
        this.measuredSizes[index] = normalizedSize;
        this.measuredSizeTree.set(index, normalizedSize);
    }

    private clearSizeArrays() {
        this.cachedFlags.fill(0);
        this.cachedKeys.fill(undefined);
        this.cachedSizes.fill(0);
        this.measuredFlags.fill(0);
        this.measuredKeys.fill(undefined);
        this.measuredSizes.fill(0);
    }

    private syncTreesFromArrays() {
        this.cachedCountTree.replaceValues(this.cachedFlags);
        this.cachedSizeTree.replaceValues(this.cachedSizes);
        this.measuredCountTree.replaceValues(this.measuredFlags);
        this.measuredSizeTree.replaceValues(this.measuredSizes);
    }

    private assertIndex(index: number) {
        if (!Number.isInteger(index) || index < 0 || index >= this.length) {
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
