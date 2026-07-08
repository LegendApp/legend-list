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

function naiveFindFirstPrefixGreaterThan(values: number[], offset: number) {
    let index: number | undefined;
    if (!Number.isNaN(offset)) {
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
            sum += values[i]!;
            if (sum > offset) {
                index = i;
                break;
            }
        }
    }
    return index;
}

function nextRandom(seed: number) {
    return (seed * 1664525 + 1013904223) >>> 0;
}

describe("FenwickTree", () => {
    it("computes prefix sums and totals", () => {
        const tree = new FenwickTree(5);

        tree.add(0, 10);
        tree.add(1, 20.5);
        tree.add(3, 4.25);

        expect(tree.sumBefore(0)).toBe(0);
        expect(tree.sumBefore(1)).toBe(10);
        expect(tree.sumBefore(2)).toBe(30.5);
        expect(tree.sumBefore(4)).toBeCloseTo(34.75);
        expect(tree.total()).toBeCloseTo(34.75);
    });

    it("updates values by delta", () => {
        const tree = new FenwickTree(3);

        tree.add(1, 10);
        tree.add(1, 5);
        tree.add(2, 5);

        expect(tree.sumBefore(1)).toBe(0);
        expect(tree.sumBefore(2)).toBe(15);
        expect(tree.sumBefore(3)).toBe(20);
        expect(tree.total()).toBe(20);
    });

    it("replaces all values with a linear tree rebuild", () => {
        const tree = new FenwickTree(5);

        tree.add(0, 100);
        tree.add(4, 200);
        tree.replaceValues([10, 0, 30, 40, 5]);

        expect(tree.sumBefore(1)).toBe(10);
        expect(tree.sumBefore(5)).toBe(85);
        expect(tree.sumBefore(3)).toBe(40);
        expect(tree.sumBefore(4)).toBe(80);
        expect(tree.total()).toBe(85);
    });

    it("finds the first prefix greater than an offset", () => {
        const values = [10, 0, 30, 40, 5];
        const tree = new FenwickTree(values.length);
        tree.replaceValues(values);

        expect(tree.findFirstPrefixGreaterThan(Number.NEGATIVE_INFINITY)).toBe(0);
        expect(tree.findFirstPrefixGreaterThan(-1)).toBe(0);
        expect(tree.findFirstPrefixGreaterThan(0)).toBe(0);
        expect(tree.findFirstPrefixGreaterThan(9.999)).toBe(0);
        expect(tree.findFirstPrefixGreaterThan(10)).toBe(2);
        expect(tree.findFirstPrefixGreaterThan(39.999)).toBe(2);
        expect(tree.findFirstPrefixGreaterThan(40)).toBe(3);
        expect(tree.findFirstPrefixGreaterThan(79.999)).toBe(3);
        expect(tree.findFirstPrefixGreaterThan(80)).toBe(4);
        expect(tree.findFirstPrefixGreaterThan(84.999)).toBe(4);
        expect(tree.findFirstPrefixGreaterThan(85)).toBeUndefined();
        expect(tree.findFirstPrefixGreaterThan(Number.POSITIVE_INFINITY)).toBeUndefined();
        expect(tree.findFirstPrefixGreaterThan(Number.NaN)).toBeUndefined();
    });

    it("skips zero-size prefixes while preserving negative offset behavior", () => {
        const values = [0, 0, 10, 0, 5, 0];
        const tree = new FenwickTree(values.length);
        tree.replaceValues(values);

        expect(tree.findFirstPrefixGreaterThan(-1)).toBe(0);
        expect(tree.findFirstPrefixGreaterThan(0)).toBe(2);
        expect(tree.findFirstPrefixGreaterThan(9.999)).toBe(2);
        expect(tree.findFirstPrefixGreaterThan(10)).toBe(4);
        expect(tree.findFirstPrefixGreaterThan(14.999)).toBe(4);
        expect(tree.findFirstPrefixGreaterThan(15)).toBeUndefined();
    });

    it("matches a naive lower-bound search across deterministic random values", () => {
        let seed = 24680;

        for (let length = 0; length < 64; length++) {
            const values = Array.from({ length }, () => {
                seed = nextRandom(seed);
                return seed % 7 === 0 ? 0 : (seed % 10000) / 100;
            });
            const tree = new FenwickTree(values.length);
            tree.replaceValues(values);
            const total = naiveSumBefore(values, values.length);
            const offsets = [
                Number.NEGATIVE_INFINITY,
                -1,
                0,
                0.001,
                total / 2,
                total - 0.001,
                total,
                total + 1,
                Number.POSITIVE_INFINITY,
                Number.NaN,
            ];

            for (const offset of offsets) {
                expect(tree.findFirstPrefixGreaterThan(offset)).toBe(naiveFindFirstPrefixGreaterThan(values, offset));
            }
            for (let index = 0; index < values.length; index++) {
                const end = naiveSumBefore(values, index + 1);
                expect(tree.findFirstPrefixGreaterThan(end - 0.001)).toBe(
                    naiveFindFirstPrefixGreaterThan(values, end - 0.001),
                );
                expect(tree.findFirstPrefixGreaterThan(end)).toBe(naiveFindFirstPrefixGreaterThan(values, end));
            }
        }
    });

    it("finds composite prefixes from known-size and known-count trees", () => {
        const knownCounts = new FenwickTree(5);
        const knownSizes = new FenwickTree(5);
        knownCounts.replaceValues([0, 1, 0, 1, 0]);
        knownSizes.replaceValues([0, 50, 0, 150, 0]);

        expect(FenwickTree.findFirstCompositePrefixGreaterThan(-1, knownCounts, knownSizes, 100)).toBe(0);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(99.999, knownCounts, knownSizes, 100)).toBe(0);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(100, knownCounts, knownSizes, 100)).toBe(1);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(149.999, knownCounts, knownSizes, 100)).toBe(1);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(150, knownCounts, knownSizes, 100)).toBe(2);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(249.999, knownCounts, knownSizes, 100)).toBe(2);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(250, knownCounts, knownSizes, 100)).toBe(3);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(399.999, knownCounts, knownSizes, 100)).toBe(3);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(400, knownCounts, knownSizes, 100)).toBe(4);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(499.999, knownCounts, knownSizes, 100)).toBe(4);
        expect(FenwickTree.findFirstCompositePrefixGreaterThan(500, knownCounts, knownSizes, 100)).toBeUndefined();
        expect(
            FenwickTree.findFirstCompositePrefixGreaterThan(Number.NaN, knownCounts, knownSizes, 100),
        ).toBeUndefined();
    });

    it("throws when composite prefix trees have different lengths", () => {
        expect(() =>
            FenwickTree.findFirstCompositePrefixGreaterThan(0, new FenwickTree(1), new FenwickTree(2), 100),
        ).toThrow(RangeError);
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

            const previousValue = values[index]!;
            values[index] = value;
            tree.add(index, value - previousValue);

            seed = nextRandom(seed);
            const sumIndex = seed % (values.length + 1);
            expect(tree.sumBefore(sumIndex)).toBeCloseTo(naiveSumBefore(values, sumIndex));

            expect(tree.total()).toBeCloseTo(naiveSumBefore(values, values.length));
        }
    });

    it("throws for invalid lengths and indexes", () => {
        expect(() => new FenwickTree(-1)).toThrow(RangeError);

        const tree = new FenwickTree(1);
        expect(() => tree.add(-1, 1)).toThrow(RangeError);
        expect(() => tree.add(0, Number.NaN)).toThrow(RangeError);
        expect(() => tree.replaceValues([1, 2])).toThrow(RangeError);
        expect(() => tree.replaceValues([Number.NaN])).toThrow(RangeError);
    });

    it("ignores invalid point updates in production", () => {
        const script = `
            process.env.NODE_ENV = "production";
            const { FenwickTree } = await import(${JSON.stringify(new URL("../../src/core/FenwickTree.ts", import.meta.url).href)});
            const tree = new FenwickTree(2);
            tree.add(0, 5);
            tree.add(-1, 10);
            tree.add(undefined, 10);
            tree.add(2, 10);
            tree.add(1, Number.NaN);
            console.log(JSON.stringify({
                sum: tree.sumBefore(2),
                total: tree.total(),
            }));
        `;
        const result = Bun.spawnSync({
            cmd: [process.execPath, "--eval", script],
            env: {
                ...process.env,
                NODE_ENV: "production",
            },
            stderr: "pipe",
            stdout: "pipe",
        });

        expect(result.exitCode).toBe(0);
        expect(JSON.parse(result.stdout.toString())).toEqual({
            sum: 5,
            total: 5,
        });
    });
});
