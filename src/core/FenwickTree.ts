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
        this.assertIndex(index);
        if (!Number.isFinite(delta)) {
            throw new RangeError(`FenwickTree delta must be finite. Received ${delta}`);
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

    private assertIndex(index: number) {
        if (!Number.isInteger(index) || index < 0 || index >= this.length) {
            throw new RangeError(`FenwickTree index ${index} is out of bounds for length ${this.length}`);
        }
    }
}

function normalizeLength(length: number) {
    if (!Number.isInteger(length) || length < 0) {
        throw new RangeError(`FenwickTree length must be a non-negative integer. Received ${length}`);
    }
    return length;
}
