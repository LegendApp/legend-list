import { describe, expect, it } from "bun:test";
import "../setup";

import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";

function findFirstItemEndGreaterThan(sizes: number[], offset: number) {
    let index: number | undefined;
    if (!Number.isNaN(offset)) {
        let end = 0;
        for (let i = 0; i < sizes.length; i++) {
            end += sizes[i]!;
            if (end > offset) {
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

describe("PrefixLayoutStore", () => {
    it("uses aggregate estimates for initially unmeasured items", () => {
        const store = new PrefixLayoutStore(5, 80);

        expect(store.getOffset(0)).toBe(0);
        expect(store.getOffset(3)).toBe(240);
        expect(store.getSize(4)).toBe(80);
        expect(store.getTotalSize()).toBe(400);
    });

    it("finds the first item whose end offset is greater than the target offset", () => {
        const store = new PrefixLayoutStore(3, 100);

        store.setMeasuredSize(0, 50);
        store.setMeasuredSize(1, 75);
        store.setMeasuredSize(2, 25);

        expect(store.findIndexAtOffset(0)).toBe(0);
        expect(store.findIndexAtOffset(49.999)).toBe(0);
        expect(store.findIndexAtOffset(50)).toBe(1);
        expect(store.findIndexAtOffset(124.999)).toBe(1);
        expect(store.findIndexAtOffset(125)).toBe(2);
        expect(store.findIndexAtOffset(149.999)).toBe(2);
        expect(store.findIndexAtOffset(150)).toBeUndefined();
    });

    it("finds offsets through mixed cached, measured, and estimated rows", () => {
        const store = new PrefixLayoutStore(6, 100);
        const sizes = [100, 40, 100, 0, 150, 100];

        store.replaceKnownSizeEntries([
            { index: 1, size: 40, type: "cached" },
            { index: 3, size: 0, type: "measured" },
            { index: 4, size: 150, type: "measured" },
        ]);

        for (const offset of [
            Number.NEGATIVE_INFINITY,
            -1,
            0,
            99.999,
            100,
            139.999,
            140,
            239.999,
            240,
            389.999,
            390,
            489.999,
            490,
            Number.POSITIVE_INFINITY,
            Number.NaN,
        ]) {
            expect(store.findIndexAtOffset(offset)).toBe(findFirstItemEndGreaterThan(sizes, offset));
        }
    });

    it("updates lower-bound offset lookup when the estimate changes", () => {
        const store = new PrefixLayoutStore(5, 100);

        store.replaceKnownSizeEntries([
            { index: 1, size: 50, type: "cached" },
            { index: 3, size: 150, type: "measured" },
        ]);
        store.setEstimatedSize(80);

        const sizes = [80, 50, 80, 150, 80];
        for (const offset of [-1, 0, 79.999, 80, 129.999, 130, 209.999, 210, 359.999, 360, 439.999, 440]) {
            expect(store.findIndexAtOffset(offset)).toBe(findFirstItemEndGreaterThan(sizes, offset));
        }
    });

    it("matches naive lower-bound lookup across deterministic random layouts", () => {
        let seed = 112233;

        for (let length = 0; length < 64; length++) {
            seed = nextRandom(seed);
            const estimate = seed % 5 === 0 ? 0 : (seed % 20000) / 100;
            const store = new PrefixLayoutStore(length, estimate);
            const sizes = Array.from({ length }, () => estimate);
            const entries: Array<{ index: number; size: number; type: "cached" | "measured" }> = [];

            for (let index = 0; index < length; index++) {
                seed = nextRandom(seed);
                if (seed % 3 === 0) {
                    seed = nextRandom(seed);
                    const size = seed % 7 === 0 ? 0 : (seed % 20000) / 100;
                    const type = seed % 2 === 0 ? "cached" : "measured";
                    sizes[index] = size;
                    entries.push({ index, size, type });
                }
            }

            store.replaceKnownSizeEntries(entries);
            const total = sizes.reduce((sum, size) => sum + size, 0);
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
                expect(store.findIndexAtOffset(offset)).toBe(findFirstItemEndGreaterThan(sizes, offset));
            }
            let end = 0;
            for (const size of sizes) {
                end += size;
                expect(store.findIndexAtOffset(end - 0.001)).toBe(findFirstItemEndGreaterThan(sizes, end - 0.001));
                expect(store.findIndexAtOffset(end)).toBe(findFirstItemEndGreaterThan(sizes, end));
            }
        }
    });

    it("finds the item range intersecting an offset range", () => {
        const store = new PrefixLayoutStore(4, 100);

        store.setMeasuredSize(0, 50);
        store.setMeasuredSize(1, 75);
        store.setMeasuredSize(2, 25);

        expect(store.findIndexRangeAtOffsets(50, 125)).toEqual({ end: 2, start: 1 });
        expect(store.findIndexRangeAtOffsets(150, 300)).toEqual({ end: 3, start: 3 });
        expect(new PrefixLayoutStore(0, 100).findIndexRangeAtOffsets(0, 100)).toBeUndefined();
    });

    it("reports valid store indexes", () => {
        const store = new PrefixLayoutStore(2, 100);

        expect(store.hasIndex(0)).toBe(true);
        expect(store.hasIndex(1)).toBe(true);
        expect(store.hasIndex(2)).toBe(false);
        expect(store.hasIndex(-1)).toBe(false);
        expect(store.hasIndex(undefined)).toBe(false);
    });

    it("updates the estimated size without rebasing measured rows", () => {
        const store = new PrefixLayoutStore(5, 100);

        store.setMeasuredSize(1, 50);
        store.setMeasuredSize(3, 150);
        store.setEstimatedSize(80);

        expect(store.getOffset(0)).toBe(0);
        expect(store.getOffset(1)).toBe(80);
        expect(store.getOffset(2)).toBe(130);
        expect(store.getOffset(3)).toBe(210);
        expect(store.getOffset(4)).toBe(360);
        expect(store.getTotalSize()).toBe(440);
    });

    it("tracks measured aggregate size separately from estimated rows", () => {
        const store = new PrefixLayoutStore(5, 100);

        expect(store.getMeasuredCount()).toBe(0);
        expect(store.getMeasuredAverageSize()).toBeUndefined();

        store.setMeasuredSize(1, 50);
        store.setMeasuredSize(3, 150);

        expect(store.getMeasuredCount()).toBe(2);
        expect(store.getMeasuredAverageSize()).toBe(100);

        store.setMeasuredSize(3, 90);

        expect(store.getMeasuredCount()).toBe(2);
        expect(store.getMeasuredAverageSize()).toBe(70);
    });

    it("uses cached committed sizes for layout without counting them as measured samples", () => {
        const store = new PrefixLayoutStore(5, 100);

        store.replaceKnownSizeEntries([
            { index: 1, size: 50, type: "cached" },
            { index: 3, size: 150, type: "cached" },
        ]);

        expect(store.getOffset(0)).toBe(0);
        expect(store.getOffset(1)).toBe(100);
        expect(store.getOffset(2)).toBe(150);
        expect(store.getOffset(3)).toBe(250);
        expect(store.getOffset(4)).toBe(400);
        expect(store.getTotalSize()).toBe(500);
        expect(store.getMeasuredCount()).toBe(0);
        expect(store.getMeasuredAverageSize()).toBeUndefined();
    });

    it("lets measured sizes replace cached committed sizes", () => {
        const store = new PrefixLayoutStore(3, 100);

        store.replaceKnownSizeEntries([{ index: 1, size: 50, type: "cached" }]);
        store.setMeasuredSize(1, 80);

        expect(store.getSize(1)).toBe(80);
        expect(store.getTotalSize()).toBe(280);
        expect(store.getMeasuredCount()).toBe(1);
        expect(store.getMeasuredAverageSize()).toBe(80);
    });

    it("rebuilds cached and measured sizes in bulk", () => {
        const store = new PrefixLayoutStore(5, 100);

        store.replaceKnownSizeEntries([{ index: 4, size: 600, type: "cached" }]);
        store.setMeasuredSize(0, 500);
        store.replaceKnownSizeEntries([
            { index: 1, size: 50, type: "cached" },
            { index: 2, size: 80, type: "measured" },
            { index: 3, size: 120, type: "cached" },
            { index: 3, size: 90, type: "measured" },
        ]);

        expect(store.getSize(0)).toBe(100);
        expect(store.getSize(1)).toBe(50);
        expect(store.getSize(2)).toBe(80);
        expect(store.getSize(3)).toBe(90);
        expect(store.getSize(4)).toBe(100);
        expect(store.getOffset(4)).toBe(320);
        expect(store.getTotalSize()).toBe(420);
        expect(store.getMeasuredCount()).toBe(2);
        expect(store.getMeasuredAverageSize()).toBe(85);
    });

    it("throws when bulk rebuilding with invalid sizes or indexes", () => {
        const store = new PrefixLayoutStore(1, 100);

        store.setMeasuredSize(0, 50);
        expect(() => store.replaceKnownSizeEntries([{ index: 1, size: 10, type: "cached" }])).toThrow(RangeError);
        expect(() => store.replaceKnownSizeEntries([{ index: 0, size: Number.NaN, type: "measured" }])).toThrow(
            RangeError,
        );
        expect(store.getSize(0)).toBe(50);
        expect(store.getTotalSize()).toBe(50);
    });

    it("walks only the requested range", () => {
        const store = new PrefixLayoutStore(5, 100);
        const layouts: Array<{ end: number; index: number; offset: number; size: number }> = [];

        store.setMeasuredSize(1, 50);
        store.setMeasuredSize(3, 150);
        store.forEachLayout(1, 3, (index, offset, size) => {
            layouts.push({ end: offset + size, index, offset, size });
        });

        expect(layouts).toEqual([
            { end: 150, index: 1, offset: 100, size: 50 },
            { end: 250, index: 2, offset: 150, size: 100 },
            { end: 400, index: 3, offset: 250, size: 150 },
        ]);
    });

    it("preserves measured rows while resizing", () => {
        const store = new PrefixLayoutStore(3, 100);

        store.replaceKnownSizeEntries([
            { index: 0, size: 50, type: "measured" },
            { index: 1, size: 60, type: "cached" },
            { index: 2, size: 75, type: "measured" },
        ]);
        store.resize(5);

        expect(store.getSize(0)).toBe(50);
        expect(store.getSize(1)).toBe(60);
        expect(store.getSize(2)).toBe(75);
        expect(store.getSize(4)).toBe(100);
        expect(store.getTotalSize()).toBe(385);

        store.resize(2);
        expect(store.getSize(0)).toBe(50);
        expect(store.getSize(1)).toBe(60);
        expect(store.getTotalSize()).toBe(110);
    });

    it("keeps million-row layouts estimate-backed with sparse known sizes", () => {
        const store = new PrefixLayoutStore(1_000_000, 10);

        store.replaceKnownSizeEntries([
            { index: 10, size: 20, type: "measured" },
            { index: 500_000, size: 5, type: "cached" },
            { index: 999_999, size: 30, type: "measured" },
        ]);

        expect(store.length).toBe(1_000_000);
        expect(store.getMeasuredCount()).toBe(2);
        expect(store.getMeasuredAverageSize()).toBe(25);
        expect(store.getOffset(10)).toBe(100);
        expect(store.getOffset(11)).toBe(120);
        expect(store.getOffset(500_000)).toBe(5_000_010);
        expect(store.getOffset(500_001)).toBe(5_000_015);
        expect(store.getOffset(999_999)).toBe(9_999_995);
        expect(store.getTotalSize()).toBe(10_000_025);
        expect(store.findIndexAtOffset(5_000_009)).toBe(499_999);
        expect(store.findIndexAtOffset(5_000_010)).toBe(500_000);
        expect(store.findIndexAtOffset(10_000_024)).toBe(999_999);
        expect(store.findIndexAtOffset(10_000_025)).toBeUndefined();
    });

    it("finds offsets directly through large sparse gaps", () => {
        const store = new PrefixLayoutStore(1_000_000, 10);

        store.replaceKnownSizeEntries([
            { index: 10, size: 20, type: "measured" },
            { index: 500_000, size: 5, type: "cached" },
            { index: 999_999, size: 30, type: "measured" },
        ]);

        expect(store.findIndexAtOffset(-1)).toBe(0);
        expect(store.findIndexAtOffset(5_000_009)).toBe(499_999);
        expect(store.findIndexAtOffset(5_000_010)).toBe(500_000);
        expect(store.findIndexAtOffset(5_000_014)).toBe(500_000);
        expect(store.findIndexAtOffset(5_000_015)).toBe(500_001);
        expect(store.findIndexAtOffset(10_000_025)).toBeUndefined();
    });

    it("does not probe per-index offsets during sparse inverse lookup", () => {
        const store = new PrefixLayoutStore(1_000_000, 10);
        store.replaceKnownSizeEntries([
            { index: 10, size: 20, type: "measured" },
            { index: 500_000, size: 5, type: "cached" },
            { index: 999_999, size: 30, type: "measured" },
        ]);
        store.getOffset = () => {
            throw new Error("findIndexAtOffset should traverse aggregates directly");
        };

        expect(store.findIndexAtOffset(5_000_010)).toBe(500_000);
    });

    it("drops only out-of-range sparse sizes when a huge layout is truncated", () => {
        const store = new PrefixLayoutStore(1_000_000, 10);

        store.replaceKnownSizeEntries([
            { index: 1, size: 20, type: "measured" },
            { index: 999_999, size: 30, type: "measured" },
        ]);
        store.resize(3);

        expect(store.length).toBe(3);
        expect(store.getSize(1)).toBe(20);
        expect(store.getMeasuredCount()).toBe(1);
        expect(store.getTotalSize()).toBe(40);
        expect(store.findIndexAtOffset(39)).toBe(2);
        expect(store.findIndexAtOffset(40)).toBeUndefined();
    });

    it("clears known sizes without changing length or estimate", () => {
        const store = new PrefixLayoutStore(3, 100);

        store.replaceKnownSizeEntries([
            { index: 0, size: 50, type: "measured" },
            { index: 1, size: 60, type: "cached" },
            { index: 2, size: 75, type: "measured" },
        ]);
        store.clearKnownSizes();

        expect(store.length).toBe(3);
        expect(store.getEstimatedSize()).toBe(100);
        expect(store.getSize(0)).toBe(100);
        expect(store.getSize(1)).toBe(100);
        expect(store.getSize(2)).toBe(100);
        expect(store.getTotalSize()).toBe(300);
        expect(store.getMeasuredCount()).toBe(0);
    });

    it("clears one sparse known size back to the estimate", () => {
        const store = new PrefixLayoutStore(1_000_000, 100);
        store.setMeasuredSize(10, 150);
        store.setMeasuredSize(900_000, 250);
        store.setMeasuredSize(999_999, 50);

        expect(store.clearKnownSize(900_000)).toBe(true);
        expect(store.getSize(900_000)).toBe(100);
        expect(store.getOffset(900_001)).toBe(90_000_150);
        expect(store.getMeasuredCount()).toBe(2);
        expect(store.clearKnownSize(900_000)).toBe(false);
    });

    it("throws for invalid sizes and indexes", () => {
        const store = new PrefixLayoutStore(1, 100);

        expect(() => new PrefixLayoutStore(-1, 100)).toThrow(RangeError);
        expect(() => new PrefixLayoutStore(1, Number.NaN)).toThrow(RangeError);
        expect(() => store.getOffset(1)).toThrow(RangeError);
        expect(() => store.replaceKnownSizeEntries([{ index: 0, size: -1, type: "cached" }])).toThrow(RangeError);
        expect(() => store.setMeasuredSize(0, -1)).toThrow(RangeError);
    });
});
