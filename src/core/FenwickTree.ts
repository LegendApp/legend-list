export class FenwickTree {
    private tree: Float64Array;
    private values: Float64Array;

    constructor(length: number) {
        const normalizedLength = normalizeLength(length);
        this.tree = new Float64Array(normalizedLength + 1);
        this.values = new Float64Array(normalizedLength);
    }

    get length() {
        return this.values.length;
    }

    add(index: number, delta: number) {
        this.assertIndex(index);
        if (delta !== 0) {
            this.values[index] += delta;

            for (let treeIndex = index + 1; treeIndex <= this.length; treeIndex += treeIndex & -treeIndex) {
                this.tree[treeIndex] += delta;
            }
        }
    }

    clear() {
        this.tree.fill(0);
        this.values.fill(0);
    }

    replaceValues(values: ArrayLike<number>) {
        if (values.length !== this.length) {
            throw new RangeError(`FenwickTree values length ${values.length} does not match length ${this.length}`);
        }

        this.tree.fill(0);
        for (let index = 0; index < this.length; index++) {
            const value = values[index];
            if (!Number.isFinite(value)) {
                throw new RangeError(`FenwickTree value must be finite. Received ${value}`);
            }
            this.values[index] = value;
            this.tree[index + 1] = value;
        }

        for (let treeIndex = 1; treeIndex <= this.length; treeIndex++) {
            const parentIndex = treeIndex + (treeIndex & -treeIndex);
            if (parentIndex <= this.length) {
                this.tree[parentIndex] += this.tree[treeIndex];
            }
        }
    }

    get(index: number) {
        this.assertIndex(index);
        return this.values[index];
    }

    lowerBound(prefixSum: number) {
        let index: number | undefined;
        if (this.length > 0 && Number.isFinite(prefixSum)) {
            if (prefixSum <= 0) {
                index = 0;
            } else if (prefixSum <= this.total()) {
                let treeIndex = 0;
                let remaining = prefixSum;
                let bit = 1;

                while (bit << 1 <= this.length) {
                    bit <<= 1;
                }

                while (bit !== 0) {
                    const nextIndex = treeIndex + bit;
                    if (nextIndex <= this.length && this.tree[nextIndex] < remaining) {
                        treeIndex = nextIndex;
                        remaining -= this.tree[nextIndex];
                    }
                    bit >>= 1;
                }

                index = treeIndex;
            }
        }
        return index;
    }

    resize(length: number) {
        const normalizedLength = normalizeLength(length);
        if (normalizedLength !== this.length) {
            const previousValues = this.values;
            this.tree = new Float64Array(normalizedLength + 1);
            this.values = new Float64Array(normalizedLength);

            const copyLength = Math.min(previousValues.length, normalizedLength);
            for (let index = 0; index < copyLength; index++) {
                const value = previousValues[index];
                if (value !== 0) {
                    this.set(index, value);
                }
            }
        }
    }

    set(index: number, value: number) {
        this.assertIndex(index);
        const previousValue = this.values[index];
        this.add(index, value - previousValue);
    }

    sumBefore(index: number) {
        const clampedIndex = Math.min(Math.max(Math.trunc(index), 0), this.length);
        let sum = 0;

        for (let treeIndex = clampedIndex; treeIndex > 0; treeIndex -= treeIndex & -treeIndex) {
            sum += this.tree[treeIndex];
        }

        return sum;
    }

    sumInclusive(index: number) {
        return this.sumBefore(index + 1);
    }

    total() {
        return this.sumBefore(this.length);
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
