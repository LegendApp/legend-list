import { FenwickTree } from "@/core/FenwickTree";

export interface MaterializedLayout {
    end: number;
    index: number;
    offset: number;
    size: number;
}

export class PrefixLayoutStore {
    private estimatedSize: number;
    private measuredCountTree: FenwickTree;
    private measuredFlags: Uint8Array;
    private measuredKeys: Array<string | undefined>;
    private measuredSizes: Float64Array;
    private measuredSizeTree: FenwickTree;

    constructor(length: number, estimatedSize: number) {
        const normalizedLength = normalizeLength(length);
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

    flushEstimatedSize(estimatedSize: number) {
        this.estimatedSize = normalizeSize(estimatedSize);
    }

    getEnd(index: number) {
        return this.getOffset(index) + this.getSize(index);
    }

    getEstimatedSize() {
        return this.estimatedSize;
    }

    getOffset(index: number) {
        this.assertIndex(index);
        const measuredCountBefore = this.measuredCountTree.sumBefore(index);
        const measuredSizeBefore = this.measuredSizeTree.sumBefore(index);
        const unmeasuredCountBefore = index - measuredCountBefore;
        return measuredSizeBefore + unmeasuredCountBefore * this.estimatedSize;
    }

    getSize(index: number) {
        this.assertIndex(index);
        return this.measuredFlags[index] ? this.measuredSizes[index] : this.estimatedSize;
    }

    getTotalSize() {
        const measuredCount = this.measuredCountTree.total();
        const measuredSize = this.measuredSizeTree.total();
        return measuredSize + (this.length - measuredCount) * this.estimatedSize;
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

    resize(length: number) {
        const normalizedLength = normalizeLength(length);
        if (normalizedLength !== this.length) {
            const previousFlags = this.measuredFlags;
            const previousKeys = this.measuredKeys;
            const previousSizes = this.measuredSizes;

            this.measuredCountTree = new FenwickTree(normalizedLength);
            this.measuredFlags = new Uint8Array(normalizedLength);
            this.measuredKeys = new Array<string | undefined>(normalizedLength);
            this.measuredSizes = new Float64Array(normalizedLength);
            this.measuredSizeTree = new FenwickTree(normalizedLength);

            const copyLength = Math.min(previousSizes.length, normalizedLength);
            for (let index = 0; index < copyLength; index++) {
                if (previousFlags[index]) {
                    this.setMeasuredSize(index, previousKeys[index] ?? "", previousSizes[index]);
                }
            }
        }
    }

    setMeasuredSize(index: number, key: string, size: number) {
        this.assertIndex(index);
        const normalizedSize = normalizeSize(size);
        if (!this.measuredFlags[index]) {
            this.measuredFlags[index] = 1;
            this.measuredCountTree.set(index, 1);
        }

        this.measuredKeys[index] = key;
        this.measuredSizes[index] = normalizedSize;
        this.measuredSizeTree.set(index, normalizedSize);
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
