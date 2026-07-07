import { describe, expect, it } from "bun:test";
import "../setup";

import { RowLayoutStore } from "../../src/core/RowLayoutStore";

describe("RowLayoutStore", () => {
    it("packs fixed-column rows with estimated sizes", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 5, numColumns: 2 });

        expect(store.getOffset(0)).toBe(0);
        expect(store.getOffset(1)).toBe(0);
        expect(store.getOffset(2)).toBe(100);
        expect(store.getOffset(3)).toBe(100);
        expect(store.getOffset(4)).toBe(200);
        expect(store.getTotalSize()).toBe(300);
        expect(store.getColumn(0)).toBe(1);
        expect(store.getColumn(1)).toBe(2);
        expect(store.getSpan(4)).toBe(1);
    });

    it("updates row heights when measured sizes change", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 4, numColumns: 2 });

        store.setMeasuredSize(1, 160);
        expect(store.getOffset(2)).toBe(160);
        expect(store.getTotalSize()).toBe(260);

        store.setMeasuredSize(0, 40);
        expect(store.getOffset(2)).toBe(160);
        expect(store.getTotalSize()).toBe(260);

        store.setMeasuredSize(1, 80);
        expect(store.getOffset(2)).toBe(80);
        expect(store.getTotalSize()).toBe(180);
        expect(store.getMeasuredCount()).toBe(2);
        expect(store.getMeasuredAverageSize()).toBe(60);
    });

    it("packs spans using the next-row overflow rule", () => {
        const store = new RowLayoutStore({
            estimatedSize: 50,
            length: 5,
            numColumns: 4,
            spans: [2, 3, 1, 4, 1],
        });

        expect(Array.from({ length: 5 }, (_, index) => store.getColumn(index))).toEqual([1, 1, 4, 1, 1]);
        expect(Array.from({ length: 5 }, (_, index) => store.getSpan(index))).toEqual([2, 3, 1, 4, 1]);
        expect(Array.from({ length: 5 }, (_, index) => store.getOffset(index))).toEqual([0, 50, 50, 100, 150]);
        expect(store.getTotalSize()).toBe(200);
    });

    it("finds item ranges by full rows", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 6, numColumns: 3 });

        store.setMeasuredSize(0, 40);
        store.setMeasuredSize(1, 120);
        store.setMeasuredSize(4, 150);

        expect(store.findIndexRangeAtOffsets(0, 119)).toEqual({ end: 2, start: 0 });
        expect(store.findIndexRangeAtOffsets(120, 269)).toEqual({ end: 5, start: 3 });
        expect(store.findIndexRangeAtOffsets(270, 500)).toEqual({ end: 5, start: 3 });
        expect(
            new RowLayoutStore({ estimatedSize: 100, length: 0, numColumns: 2 }).findIndexRangeAtOffsets(0, 10),
        ).toBeUndefined();
    });

    it("walks only the requested item range with row offsets", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 5, numColumns: 2 });
        const layouts: Array<{ index: number; offset: number; size: number }> = [];

        store.setMeasuredSize(1, 150);
        store.setMeasuredSize(2, 40);
        store.forEachLayout(1, 3, (index, offset, size) => {
            layouts.push({ index, offset, size });
        });

        expect(layouts).toEqual([
            { index: 1, offset: 0, size: 150 },
            { index: 2, offset: 150, size: 40 },
            { index: 3, offset: 150, size: 100 },
        ]);
    });

    it("preserves measured rows while resizing and repacking", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 4, numColumns: 2 });

        store.replaceKnownSizeEntries([
            { index: 0, size: 50, type: "measured" },
            { index: 1, size: 60, type: "cached" },
            { index: 2, size: 175, type: "measured" },
        ]);
        store.resize(5, [2, 1, 1, 1, 1]);

        expect(store.getColumn(0)).toBe(1);
        expect(store.getColumn(1)).toBe(1);
        expect(store.getOffset(1)).toBe(50);
        expect(store.getOffset(3)).toBe(225);
        expect(store.getSize(4)).toBe(100);
        expect(store.getMeasuredCount()).toBe(2);
        expect(store.getMeasuredAverageSize()).toBe(112.5);

        store.resize(2);
        expect(store.getTotalSize()).toBe(60);
    });

    it("throws for invalid sizes, spans, indexes, and column counts", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 1, numColumns: 1 });

        expect(() => new RowLayoutStore({ estimatedSize: 100, length: -1, numColumns: 1 })).toThrow(RangeError);
        expect(() => new RowLayoutStore({ estimatedSize: 100, length: 1, numColumns: 0 })).toThrow(RangeError);
        expect(() => new RowLayoutStore({ estimatedSize: Number.NaN, length: 1, numColumns: 1 })).toThrow(RangeError);
        expect(() => store.getOffset(1)).toThrow(RangeError);
        expect(() => store.replaceKnownSizeEntries([{ index: 0, size: -1, type: "cached" }])).toThrow(RangeError);
        expect(() => store.setMeasuredSize(0, -1)).toThrow(RangeError);

        const spanStore = new RowLayoutStore({
            estimatedSize: 100,
            length: 3,
            numColumns: 2,
            spans: [0, Number.NaN, 100],
        });
        expect([spanStore.getSpan(0), spanStore.getSpan(1), spanStore.getSpan(2)]).toEqual([1, 1, 2]);
    });
});
