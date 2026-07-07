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
