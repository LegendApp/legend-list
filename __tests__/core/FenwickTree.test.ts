import { describe, expect, it } from "bun:test";
import "../setup";

import { FenwickTree } from "../../src/core/FenwickTree";

function naiveSumBefore(values: number[], index: number) {
    let sum = 0;
    const end = Math.min(Math.max(Math.trunc(index), 0), values.length);
    for (let i = 0; i < end; i++) {
        sum += values[i];
    }
    return sum;
}

function nextRandom(seed: number) {
    return (seed * 1664525 + 1013904223) >>> 0;
}

describe("FenwickTree", () => {
    it("computes prefix sums and totals", () => {
        const tree = new FenwickTree(5);

        tree.set(0, 10);
        tree.set(1, 20.5);
        tree.set(3, 4.25);

        expect(tree.sumBefore(0)).toBe(0);
        expect(tree.sumBefore(1)).toBe(10);
        expect(tree.sumBefore(2)).toBe(30.5);
        expect(tree.sumBefore(4)).toBeCloseTo(34.75);
        expect(tree.total()).toBeCloseTo(34.75);
    });

    it("updates values by replacement and delta", () => {
        const tree = new FenwickTree(3);

        tree.set(1, 10);
        tree.set(1, 15);
        tree.add(2, 5);

        expect(tree.get(0)).toBe(0);
        expect(tree.get(1)).toBe(15);
        expect(tree.get(2)).toBe(5);
        expect(tree.total()).toBe(20);
    });

    it("replaces all values with a linear tree rebuild", () => {
        const tree = new FenwickTree(5);

        tree.set(0, 100);
        tree.set(4, 200);
        tree.replaceValues([10, 0, 30, 40, 5]);

        expect(tree.get(0)).toBe(10);
        expect(tree.get(4)).toBe(5);
        expect(tree.sumBefore(3)).toBe(40);
        expect(tree.sumBefore(4)).toBe(80);
        expect(tree.total()).toBe(85);
    });

    it("matches a naive array across deterministic random updates", () => {
        const values = Array.from({ length: 32 }, () => 0);
        const tree = new FenwickTree(values.length);
        let seed = 12345;

        for (let step = 0; step < 200; step++) {
            seed = nextRandom(seed);
            const index = seed % values.length;
            seed = nextRandom(seed);
            const value = (seed % 10000) / 100;

            values[index] = value;
            tree.set(index, value);

            seed = nextRandom(seed);
            const sumIndex = seed % (values.length + 1);
            expect(tree.sumBefore(sumIndex)).toBeCloseTo(naiveSumBefore(values, sumIndex));

            expect(tree.total()).toBeCloseTo(naiveSumBefore(values, values.length));
        }
    });

    it("throws for invalid lengths and indexes", () => {
        expect(() => new FenwickTree(-1)).toThrow(RangeError);

        const tree = new FenwickTree(1);
        expect(() => tree.get(1)).toThrow(RangeError);
        expect(() => tree.set(-1, 1)).toThrow(RangeError);
        expect(() => tree.replaceValues([1, 2])).toThrow(RangeError);
        expect(() => tree.replaceValues([Number.NaN])).toThrow(RangeError);
    });
});
