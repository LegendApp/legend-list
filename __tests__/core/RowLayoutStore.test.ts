import { describe, expect, it } from "bun:test";
import "../setup";

import { RowLayoutStore } from "../../src/core/RowLayoutStore";

function findFirstRowEndGreaterThan(rowHeights: number[], offset: number) {
    let rowIndex: number | undefined;
    if (!Number.isNaN(offset)) {
        let end = 0;
        for (let index = 0; index < rowHeights.length; index++) {
            end += rowHeights[index]!;
            if (end > offset) {
                rowIndex = index;
                break;
            }
        }
    }
    return rowIndex;
}

function nextRandom(seed: number) {
    return (seed * 1664525 + 1013904223) >>> 0;
}

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

    it("returns a partially known row to its implicit estimate when its maximum shrinks", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 4, numColumns: 2 });

        store.setMeasuredSize(0, 150);
        expect(store.getOffset(2)).toBe(150);

        store.setMeasuredSize(0, 50);
        expect(store.getOffset(2)).toBe(100);
        expect(store.getTotalSize()).toBe(200);
        expect(store.getMeasuredCount()).toBe(1);
        expect(store.getMeasuredAverageSize()).toBe(50);
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

    it("finds row ranges through zero-height and measured row heights", () => {
        const store = new RowLayoutStore({ estimatedSize: 0, length: 6, numColumns: 2 });
        const rowHeights = [0, 75, 25];
        const rowRanges = [
            { end: 1, start: 0 },
            { end: 3, start: 2 },
            { end: 5, start: 4 },
        ];

        store.setMeasuredSize(2, 75);
        store.setMeasuredSize(3, 0);
        store.setMeasuredSize(4, 25);

        for (const offset of [
            Number.NEGATIVE_INFINITY,
            -1,
            0,
            74.999,
            75,
            99.999,
            100,
            Number.POSITIVE_INFINITY,
            Number.NaN,
        ]) {
            const rowIndex = findFirstRowEndGreaterThan(rowHeights, offset) ?? rowRanges.length - 1;
            expect(store.findIndexRangeAtOffsets(offset, offset)).toEqual(rowRanges[rowIndex]);
        }
    });

    it("matches naive lower-bound row lookup across deterministic random layouts", () => {
        let seed = 998877;

        for (let length = 0; length < 64; length++) {
            seed = nextRandom(seed);
            const numColumns = (seed % 4) + 1;
            seed = nextRandom(seed);
            const estimatedSize = seed % 5 === 0 ? 0 : (seed % 20000) / 100;
            const store = new RowLayoutStore({ estimatedSize, length, numColumns });
            const itemSizes = Array.from({ length }, () => estimatedSize);

            for (let index = 0; index < length; index++) {
                seed = nextRandom(seed);
                if (seed % 3 === 0) {
                    seed = nextRandom(seed);
                    const size = seed % 7 === 0 ? 0 : (seed % 20000) / 100;
                    itemSizes[index] = size;
                    store.setMeasuredSize(index, size);
                }
            }

            const rowStarts: number[] = [];
            const rowEnds: number[] = [];
            const rowHeights: number[] = [];
            for (let start = 0; start < length; start += numColumns) {
                const end = Math.min(length - 1, start + numColumns - 1);
                rowStarts.push(start);
                rowEnds.push(end);
                rowHeights.push(Math.max(...itemSizes.slice(start, end + 1)));
            }
            const total = rowHeights.reduce((sum, height) => sum + height, 0);
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
                const rowIndex = findFirstRowEndGreaterThan(rowHeights, offset) ?? rowHeights.length - 1;
                const expected =
                    length > 0
                        ? {
                              end: rowEnds[rowIndex],
                              start: rowStarts[rowIndex],
                          }
                        : undefined;
                expect(store.findIndexRangeAtOffsets(offset, offset)).toEqual(expected);
            }
        }
    });

    it("matches naive packing across deterministic random span layouts", () => {
        let seed = 445566;

        for (let length = 0; length < 48; length++) {
            seed = nextRandom(seed);
            const numColumns = (seed % 4) + 2;
            const spans: number[] = [];
            const sizes: number[] = [];
            const columns: number[] = [];
            const rowIndexes: number[] = [];
            const rowStarts: number[] = [];
            const rowEnds: number[] = [];
            let column = 1;
            let rowIndex = -1;

            for (let index = 0; index < length; index++) {
                seed = nextRandom(seed);
                const span = (seed % numColumns) + 1;
                spans[index] = span;
                sizes[index] = 100;
                if (column + span - 1 > numColumns) {
                    column = 1;
                }
                if (column === 1) {
                    rowIndex++;
                    rowStarts[rowIndex] = index;
                }
                columns[index] = column;
                rowIndexes[index] = rowIndex;
                rowEnds[rowIndex] = index;
                column += span;
                if (column > numColumns) {
                    column = 1;
                }
            }

            const store = new RowLayoutStore({ estimatedSize: 100, length, numColumns, spans });
            for (let index = 0; index < length; index++) {
                seed = nextRandom(seed);
                if (seed % 3 === 0) {
                    seed = nextRandom(seed);
                    sizes[index] = seed % 7 === 0 ? 0 : seed % 250;
                    store.setMeasuredSize(index, sizes[index]!);
                }
            }

            const rowHeights = rowStarts.map((start, row) => Math.max(...sizes.slice(start, rowEnds[row]! + 1)));
            const rowOffsets: number[] = [];
            let offset = 0;
            for (let row = 0; row < rowHeights.length; row++) {
                rowOffsets[row] = offset;
                offset += rowHeights[row]!;
            }

            for (let index = 0; index < length; index++) {
                expect(store.getColumn(index)).toBe(columns[index]);
                expect(store.getSpan(index)).toBe(spans[index]);
                expect(store.getOffset(index)).toBe(rowOffsets[rowIndexes[index]!]!);
                expect(store.getSize(index)).toBe(sizes[index]);
            }
            expect(store.getTotalSize()).toBe(offset);
        }
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

    it("keeps million-item regular grids implicit and sparse", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 1_000_000, numColumns: 2 });
        const internals = store as unknown as {
            knownSizes: Map<number, unknown>;
            rowLayout: { length: number };
            spanTopology?: unknown;
        };

        expect(internals.spanTopology).toBeUndefined();
        expect(internals.knownSizes.size).toBe(0);
        expect(internals.rowLayout.length).toBe(500_000);
        expect(store.getColumn(999_999)).toBe(2);
        expect(store.getOffset(999_999)).toBe(49_999_900);
        expect(store.getTotalSize()).toBe(50_000_000);
    });

    it("keeps million-item regular-grid mutations proportional to sparse measurements", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 1_000_000, numColumns: 3 });
        const internals = store as unknown as {
            knownSizes: Map<number, unknown>;
            spanTopology?: unknown;
        };
        store.replaceKnownSizeEntries([
            { index: 10, size: 110, type: "measured" },
            { index: 500_000, size: 120, type: "measured" },
            { index: 999_999, size: 130, type: "measured" },
        ]);

        store.splice(0, 0, 3);
        store.move(500_003, 30, 1);
        store.invalidateRange(13, 1);

        expect(store.length).toBe(1_000_003);
        expect(internals.spanTopology).toBeUndefined();
        expect(internals.knownSizes.size).toBe(2);
        expect(store.getSize(30)).toBe(120);
        expect(store.getSize(1_000_002)).toBe(130);
        expect(store.getColumn(1_000_002)).toBe(1);
    });

    it("stores distant regular-grid measurements without materializing skipped rows", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 1_000_000, numColumns: 2 });
        const internals = store as unknown as { knownSizes: Map<number, unknown> };

        expect(store.setMeasuredSize(900_000, 150)).toBe(true);

        expect(store.getOffset(900_000)).toBe(45_000_000);
        expect(store.getOffset(900_002)).toBe(45_000_150);
        expect(store.getTotalSize()).toBe(50_000_050);
        expect(internals.knownSizes.size).toBe(1);
    });

    it("recomputes only sparse regular rows when the estimate changes", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 1_000_000, numColumns: 2 });
        store.setMeasuredSize(900_000, 150);

        store.setEstimatedSize(80);

        expect(store.getOffset(900_000)).toBe(36_000_000);
        expect(store.getOffset(900_002)).toBe(36_000_150);
        expect(store.getTotalSize()).toBe(40_000_070);
    });

    it("keeps fully known regular rows exact across estimate changes", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 4, numColumns: 2 });
        store.setMeasuredSize(0, 40);
        store.setMeasuredSize(1, 60);

        store.setEstimatedSize(200);
        expect(store.getOffset(2)).toBe(60);
        expect(store.getTotalSize()).toBe(260);

        store.setEstimatedSize(20);
        expect(store.getOffset(2)).toBe(60);
        expect(store.getTotalSize()).toBe(80);
    });

    it("switches between implicit regular rows and explicit span topology", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 4, numColumns: 2 });
        store.setMeasuredSize(0, 50);
        store.setMeasuredSize(1, 60);

        store.resize(4, [2, 1, 1, 1], 2);
        expect(store.getOffset(1)).toBe(50);
        expect(store.getColumn(1)).toBe(1);

        store.resize(4, undefined, 2);
        expect(store.getOffset(1)).toBe(0);
        expect(store.getColumn(1)).toBe(2);
        expect(store.getOffset(2)).toBe(60);
    });

    it("recomputes sparse partial rows when regular grid length changes", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 3, numColumns: 2 });
        store.setMeasuredSize(2, 40);
        expect(store.getTotalSize()).toBe(140);

        store.resize(4);
        expect(store.getTotalSize()).toBe(200);

        store.resize(3);
        expect(store.getTotalSize()).toBe(140);
    });

    it("does not rebuild row geometry when structural inputs are unchanged", () => {
        const store = new RowLayoutStore({ estimatedSize: 100, length: 1_000_000, numColumns: 2 });
        const rowLayout = (store as unknown as { rowLayout: unknown }).rowLayout;

        store.resize(1_000_000, undefined, 2);
        store.setEstimatedSize(100);

        expect((store as unknown as { rowLayout: unknown }).rowLayout).toBe(rowLayout);
    });

    it("rebuilds row geometry when the span topology identity changes", () => {
        const spans = [1, 1, 1, 1];
        const store = new RowLayoutStore({ estimatedSize: 100, length: 4, numColumns: 2, spans });
        const rowLayout = (store as unknown as { rowLayout: unknown }).rowLayout;

        store.resize(4, spans, 2);
        expect((store as unknown as { rowLayout: unknown }).rowLayout).toBe(rowLayout);

        store.resize(4, [...spans], 2);
        expect((store as unknown as { rowLayout: unknown }).rowLayout).not.toBe(rowLayout);
    });

    it("repacks a same-length variable-span topology in place from the affected row", () => {
        const spans = new Array<number | undefined>(100_000).fill(1);
        const store = new RowLayoutStore({ estimatedSize: 10, length: spans.length, numColumns: 4, spans });
        const internals = store as unknown as { spanTopology: unknown };
        const topology = internals.spanTopology;
        spans[90_000] = 4;

        store.resize(spans.length, spans, 4, 90_000);

        expect(internals.spanTopology).toBe(topology);
        expect(store.getSpan(89_999)).toBe(1);
        expect(store.getSpan(90_000)).toBe(4);
        expect(store.getColumn(90_001)).toBe(1);
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
