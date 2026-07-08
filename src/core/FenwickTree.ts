import { IS_DEV } from "@/utils/devEnvironment";

export class FenwickTree {
    private lengthValue: number;
    private tree: Float64Array;
    private totalValue = 0;

    constructor(length: number) {
        const normalizedLength = normalizeLength(length);
        this.lengthValue = normalizedLength;
        this.tree = new Float64Array(normalizedLength + 1);
    }

    get length() {
        return this.lengthValue;
    }

    add(index: number, delta: number) {
        const indexError = this.getIndexError(index);
        if (indexError || !Number.isFinite(delta)) {
            if (IS_DEV) {
                throw new RangeError(indexError ?? `FenwickTree delta must be finite. Received ${delta}`);
            }
            return;
        }
        if (delta !== 0) {
            this.totalValue += delta;
            for (let treeIndex = index + 1; treeIndex <= this.length; treeIndex += treeIndex & -treeIndex) {
                this.tree[treeIndex] += delta;
            }
        }
    }

    replaceValues(values: ArrayLike<number>) {
        if (values.length !== this.length) {
            throw new RangeError(`FenwickTree values length ${values.length} does not match length ${this.length}`);
        }

        this.tree.fill(0);
        this.totalValue = 0;
        for (let index = 0; index < this.length; index++) {
            const value = values[index];
            if (!Number.isFinite(value)) {
                throw new RangeError(`FenwickTree value must be finite. Received ${value}`);
            }
            this.totalValue += value;
            this.tree[index + 1] = value;
        }

        for (let treeIndex = 1; treeIndex <= this.length; treeIndex++) {
            const parentIndex = treeIndex + (treeIndex & -treeIndex);
            if (parentIndex <= this.length) {
                this.tree[parentIndex] += this.tree[treeIndex];
            }
        }
    }

    clear() {
        this.tree.fill(0);
        this.totalValue = 0;
    }

    sumBefore(index: number) {
        const clampedIndex = Math.min(Math.max(Math.trunc(index), 0), this.length);
        let sum = 0;

        for (let treeIndex = clampedIndex; treeIndex > 0; treeIndex -= treeIndex & -treeIndex) {
            sum += this.tree[treeIndex];
        }

        return sum;
    }

    total() {
        return this.totalValue;
    }

    findFirstPrefixGreaterThan(offset: number) {
        let index: number | undefined;
        if (!Number.isNaN(offset)) {
            index = FenwickTree.findFirstPrefixGreaterThanFromTrees(offset, this);
        }
        return index;
    }

    static findFirstCompositePrefixGreaterThan(
        offset: number,
        countTree: FenwickTree,
        sizeTree: FenwickTree,
        estimatedSize: number,
    ) {
        let index: number | undefined;
        if (countTree.length !== sizeTree.length) {
            throw new RangeError(
                `FenwickTree composite lengths must match. Received ${countTree.length} and ${sizeTree.length}`,
            );
        }
        if (!Number.isNaN(offset)) {
            index = FenwickTree.findFirstPrefixGreaterThanFromTrees(offset, sizeTree, countTree, estimatedSize);
        }
        return index;
    }

    private static findFirstPrefixGreaterThanFromTrees(
        offset: number,
        sizeTree: FenwickTree,
        countTree?: FenwickTree,
        estimatedSize = 0,
    ) {
        let index = 0;
        let knownCount = 0;
        let knownSize = 0;
        let bit = 1;

        while (bit * 2 <= sizeTree.length) {
            bit *= 2;
        }

        while (bit > 0) {
            const nextIndex = index + bit;
            if (nextIndex <= sizeTree.length) {
                const nextKnownSize = knownSize + sizeTree.tree[nextIndex]!;
                const nextKnownCount = knownCount + (countTree?.tree[nextIndex] ?? nextIndex - index);
                const nextPrefixSize =
                    countTree === undefined
                        ? nextKnownSize
                        : nextKnownSize + (nextIndex - nextKnownCount) * estimatedSize;
                if (isLessThanOrEqualOffset(nextPrefixSize, offset)) {
                    index = nextIndex;
                    knownCount = nextKnownCount;
                    knownSize = nextKnownSize;
                }
            }
            bit >>= 1;
        }

        return index < sizeTree.length ? index : undefined;
    }

    private getIndexError(index: number) {
        let error: string | undefined;
        if (!Number.isInteger(index) || index < 0 || index >= this.length) {
            error = `FenwickTree index ${index} is out of bounds for length ${this.length}`;
        }
        return error;
    }
}

function normalizeLength(length: number) {
    if (!Number.isInteger(length) || length < 0) {
        throw new RangeError(`FenwickTree length must be a non-negative integer. Received ${length}`);
    }
    return length;
}

function isLessThanOrEqualOffset(prefixSize: number, offset: number) {
    return (
        prefixSize <= offset ||
        (Number.isFinite(prefixSize) &&
            Number.isFinite(offset) &&
            Math.abs(prefixSize - offset) <= Number.EPSILON * Math.max(1, Math.abs(prefixSize), Math.abs(offset)) * 16)
    );
}
