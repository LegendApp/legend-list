import { describe, expect, it } from "bun:test";
import "../setup";

import type { MutableLayoutStore } from "../../src/core/LayoutStore";
import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import { RowLayoutStore } from "../../src/core/RowLayoutStore";

type TestStore = MutableLayoutStore & {
    getMeasuredAverageSize(): number | undefined;
    getMeasuredCount(): number;
    getPositiveMeasuredAverageSize(): number | undefined;
    setEstimatedSize(size: number): void;
    setMeasuredSize(index: number, size: number): boolean;
};

interface NaiveLayout {
    estimatedSize: number;
    knownSizes: Array<number | undefined>;
    numColumns: number;
}

function nextRandom(seed: number) {
    return (seed * 1664525 + 1013904223) >>> 0;
}

function moveArray<T>(values: T[], from: number, to: number, count: number) {
    const moved = values.splice(from, count);
    values.splice(to, 0, ...moved);
}

function getNaiveOffsets(model: NaiveLayout) {
    const itemSizes = model.knownSizes.map((size) => size ?? model.estimatedSize);
    const offsets = new Array<number>(itemSizes.length);
    let totalSize = 0;
    if (model.numColumns === 1) {
        for (let index = 0; index < itemSizes.length; index++) {
            offsets[index] = totalSize;
            totalSize += itemSizes[index]!;
        }
    } else {
        for (let start = 0; start < itemSizes.length; start += model.numColumns) {
            const end = Math.min(itemSizes.length, start + model.numColumns);
            const rowSize = Math.max(...itemSizes.slice(start, end));
            for (let index = start; index < end; index++) {
                offsets[index] = totalSize;
            }
            totalSize += rowSize;
        }
    }
    return { itemSizes, offsets, totalSize };
}

function findExpectedRange(model: NaiveLayout, offset: number) {
    const { itemSizes, offsets } = getNaiveOffsets(model);
    let itemIndex = itemSizes.length - 1;
    for (let index = 0; index < itemSizes.length; index += model.numColumns) {
        const rowEnd = Math.min(itemSizes.length, index + model.numColumns);
        const rowSize = Math.max(...itemSizes.slice(index, rowEnd));
        if (offsets[index]! + rowSize > offset) {
            itemIndex = index;
            break;
        }
    }
    const start = Math.floor(itemIndex / model.numColumns) * model.numColumns;
    return { end: Math.min(itemSizes.length - 1, start + model.numColumns - 1), start };
}

function verifyStore(store: TestStore, model: NaiveLayout) {
    const { itemSizes, offsets, totalSize } = getNaiveOffsets(model);
    expect(store.length).toBe(model.knownSizes.length);
    expect(store.getTotalSize()).toBeCloseTo(totalSize, 10);
    for (let index = 0; index < model.knownSizes.length; index++) {
        expect(store.getOffset(index)).toBeCloseTo(offsets[index]!, 10);
        expect(store.getSize(index)).toBeCloseTo(itemSizes[index]!, 10);
    }

    const measured = model.knownSizes.filter((size) => size !== undefined) as number[];
    expect(store.getMeasuredCount()).toBe(measured.length);
    const measuredAverage = store.getMeasuredAverageSize();
    if (measured.length > 0) {
        expect(measuredAverage).toBeCloseTo(measured.reduce((sum, size) => sum + size, 0) / measured.length, 10);
    } else {
        expect(measuredAverage).toBeUndefined();
    }

    const positive = measured.filter((size) => size > 0);
    if (positive.length > 0) {
        expect(store.getPositiveMeasuredAverageSize()).toBeCloseTo(
            positive.reduce((sum, size) => sum + size, 0) / positive.length,
            10,
        );
    } else {
        expect(store.getPositiveMeasuredAverageSize()).toBeUndefined();
    }

    if (model.knownSizes.length > 0) {
        for (const offset of [-1, 0.001, totalSize * 0.371 + 0.001, totalSize, totalSize + 1]) {
            expect(store.findIndexRangeAtOffsets(offset, offset)).toEqual(findExpectedRange(model, offset));
        }
    } else {
        expect(store.findIndexRangeAtOffsets(0, 0)).toBeUndefined();
    }
}

function runRandomizedContract(createStore: () => TestStore, numColumns: number, initialSeed = 918273, steps = 300) {
    const store = createStore();
    const model: NaiveLayout = {
        estimatedSize: 10.5,
        knownSizes: new Array<number | undefined>(12).fill(undefined),
        numColumns,
    };
    let seed = initialSeed;

    for (let step = 0; step < steps; step++) {
        seed = nextRandom(seed);
        const action = seed % 5;
        if (action === 0 && model.knownSizes.length > 0) {
            seed = nextRandom(seed);
            const index = seed % model.knownSizes.length;
            seed = nextRandom(seed);
            const size = seed % 3 === 0 ? 0 : (seed % 5000) / 100;
            model.knownSizes[index] = size;
            store.setMeasuredSize(index, size);
        } else if (action === 1) {
            seed = nextRandom(seed);
            const index = seed % (model.knownSizes.length + 1);
            seed = nextRandom(seed);
            const deleteCount = Math.min(seed % 4, model.knownSizes.length - index);
            seed = nextRandom(seed);
            const insertCount = seed % 4;
            model.knownSizes.splice(index, deleteCount, ...new Array<number | undefined>(insertCount).fill(undefined));
            store.splice(index, deleteCount, insertCount);
        } else if (action === 2 && model.knownSizes.length > 0) {
            seed = nextRandom(seed);
            const from = seed % model.knownSizes.length;
            seed = nextRandom(seed);
            const count = Math.min((seed % 4) + 1, model.knownSizes.length - from);
            seed = nextRandom(seed);
            const to = seed % (model.knownSizes.length - count + 1);
            moveArray(model.knownSizes, from, to, count);
            store.move(from, to, count);
        } else if (action === 3 && model.knownSizes.length > 0) {
            seed = nextRandom(seed);
            const index = seed % model.knownSizes.length;
            seed = nextRandom(seed);
            const count = Math.min((seed % 4) + 1, model.knownSizes.length - index);
            model.knownSizes.fill(undefined, index, index + count);
            store.invalidateRange(index, count);
        } else {
            seed = nextRandom(seed);
            model.estimatedSize = (seed % 3000) / 100;
            store.setEstimatedSize(model.estimatedSize);
        }
        verifyStore(store, model);
    }
}

describe("MutableLayoutStore contract", () => {
    it("matches a randomized single-column sequence model", () => {
        runRandomizedContract(() => new PrefixLayoutStore(12, 10.5), 1);
    });

    it("matches a randomized regular-grid sequence model", () => {
        runRandomizedContract(() => new RowLayoutStore({ estimatedSize: 10.5, length: 12, numColumns: 3 }), 3);
    });

    it("moves span topology with retained items and gives inserted items the default span", () => {
        const store = new RowLayoutStore({ estimatedSize: 10, length: 5, numColumns: 4, spans: [2, 1, 3, 4, 2] });

        store.move(1, 3, 2);
        expect(Array.from({ length: 5 }, (_, index) => store.getSpan(index))).toEqual([2, 4, 2, 1, 3]);

        store.splice(2, 1, 2);
        expect(Array.from({ length: 6 }, (_, index) => store.getSpan(index))).toEqual([2, 4, 1, 1, 1, 3]);
    });

    it("preserves fractional exact-boundary lookup after structural edits", () => {
        const prefix = new PrefixLayoutStore(3, 10.25);
        prefix.setMeasuredSize(1, 5.5);
        prefix.splice(0, 0, 1);
        expect(prefix.findIndexRangeAtOffsets(20.5, 20.5)).toEqual({ end: 2, start: 2 });
        prefix.move(2, 0, 1);
        expect(prefix.findIndexRangeAtOffsets(5.5, 5.5)).toEqual({ end: 1, start: 1 });

        const rows = new RowLayoutStore({ estimatedSize: 10.25, length: 4, numColumns: 2 });
        rows.setMeasuredSize(0, 5.5);
        rows.setMeasuredSize(1, 7.75);
        rows.splice(0, 0, 2);
        expect(rows.findIndexRangeAtOffsets(10.25, 10.25)).toEqual({ end: 3, start: 2 });
    });

    it("keeps million-item structural edits proportional to sparse known state", () => {
        const store = new PrefixLayoutStore(1_000_000, 10);
        store.replaceKnownSizeEntries([
            { index: 10, size: 11, type: "measured" },
            { index: 500_000, size: 12, type: "measured" },
            { index: 999_999, size: 13, type: "measured" },
        ]);

        store.splice(0, 0, 5);
        store.move(500_005, 20, 1);
        store.invalidateRange(15, 1);

        expect(store.length).toBe(1_000_005);
        expect(store.getSize(20)).toBe(12);
        expect(store.getSize(1_000_004)).toBe(13);
        expect(store.getMeasuredCount()).toBe(2);
    });

    it("rejects invalid structural ranges", () => {
        for (const store of [
            new PrefixLayoutStore(4, 10),
            new RowLayoutStore({ estimatedSize: 10, length: 4, numColumns: 2 }),
        ]) {
            expect(() => store.splice(-1, 0, 1)).toThrow(RangeError);
            expect(() => store.splice(3, 2, 0)).toThrow(RangeError);
            expect(() => store.move(0, 4, 1)).toThrow(RangeError);
            expect(() => store.invalidateRange(4, 1)).toThrow(RangeError);
        }
    });
});

for (const columns of [1, 3]) {
    it(`keeps positive sample counts through cached promotion and clearing (${columns} columns)`, () => {
        const store =
            columns === 1
                ? new PrefixLayoutStore(300, 100)
                : new RowLayoutStore({ estimatedSize: 100, length: 300, numColumns: columns });
        store.replaceKnownSizeEntries(
            Array.from({ length: 260 }, (_, index) => ({
                index,
                size: index % 2 ? 0 : 120,
                type: index % 3 ? "measured" : "cached",
            })),
        );
        for (let index = 0; index < 260; index++) store.setMeasuredSize(index, index % 2 ? 0 : 120);
        expect(store.getMeasuredAverageSize()).toBe(60);
        expect(store.getPositiveMeasuredAverageSize()).toBe(120);
        store.move(0, 40, 130);
        store.splice(10, 125, 2);
        store.invalidateRange(0, 20);
        expect(store.getPositiveMeasuredAverageSize()).toBe(120);
        for (let index = 0; index < store.length; index++) store.setMeasuredSize(index, 0);
        expect(store.getMeasuredCount()).toBe(store.length);
        expect(store.getMeasuredAverageSize()).toBe(0);
        expect(store.getPositiveMeasuredAverageSize()).toBeUndefined();
        store.setMeasuredSize(0, 80);
        expect(store.getPositiveMeasuredAverageSize()).toBe(80);
        store.clearKnownSizes();
        expect(store.getMeasuredCount()).toBe(0);
        expect(store.getPositiveMeasuredAverageSize()).toBeUndefined();
    });
}

// Vary operation ordering as well as values; failures identify a reproducible seed.
for (const columns of [1, 3]) {
    for (const seed of [104729, 209458, 314187, 418916, 523645, 628374, 733103, 837832, 942561, 1047290]) {
        it(`matches the sequence model for ${columns} columns, seed ${seed}`, () => {
            runRandomizedContract(
                () =>
                    columns === 1
                        ? new PrefixLayoutStore(12, 10.5)
                        : new RowLayoutStore({ estimatedSize: 10.5, length: 12, numColumns: columns }),
                columns,
                seed,
                1000,
            );
        });
    }
}

// Mixed span edits exercise topology reuse together with retained measurements.
// Repack the independent model from scratch after every operation.
for (const initialSeed of [830271, 194910, 712311, 988712, 12987]) {
    it(`matches a variable-span mutation model, seed ${initialSeed}`, () => {
        let seed = initialSeed;
        const random = (limit: number) => {
            seed = nextRandom(seed);
            return seed % limit;
        };
        let numColumns = 1 + random(6);
        let estimatedSize = 10.25;
        let spans = Array.from({ length: 40 }, () => 1 + random(numColumns));
        const sizes: Array<number | undefined> = Array(40).fill(undefined);
        const store = new RowLayoutStore({ estimatedSize, length: spans.length, numColumns, spans });
        for (let step = 0; step < 500; step++) {
            const length = spans.length;
            const action = random(7);
            if (action === 0 && length > 0) {
                const index = random(length);
                sizes[index] = random(200) / 4;
                store.setMeasuredSize(index, sizes[index]!);
            } else if (action === 1) {
                const index = random(length + 1);
                const deleted = Math.min(random(4), length - index);
                const inserted = length < 100 ? random(4) : 0;
                spans.splice(index, deleted, ...Array(inserted).fill(1));
                sizes.splice(index, deleted, ...Array(inserted).fill(undefined));
                store.splice(index, deleted, inserted);
            } else if (action === 2 && length > 0) {
                const from = random(length);
                const count = 1 + random(Math.min(length - from, 5));
                const to = random(length - count + 1);
                moveArray(spans, from, to, count);
                moveArray(sizes, from, to, count);
                store.move(from, to, count);
            } else if (action === 3 && length > 0) {
                const index = random(length);
                const count = random(length - index + 1);
                sizes.fill(undefined, index, index + count);
                store.invalidateRange(index, count);
            } else if (action === 4) {
                estimatedSize = random(200) / 4;
                store.setEstimatedSize(estimatedSize);
            } else if (action === 5 && length > 0) {
                const index = random(length);
                spans[index] = 1 + random(numColumns);
                store.resize(length, spans, numColumns, index);
            } else if (action === 6) {
                numColumns = 1 + random(6);
                spans = spans.map((span) => Math.min(span, numColumns));
                store.resize(length, spans, numColumns);
            }

            const rows: Array<{ bottom: number; start: number; end: number }> = [];
            let totalSize = 0;
            for (let start = 0; start < spans.length; ) {
                let end = start;
                let column = 0;
                let height = 0;
                while (end < spans.length && column + spans[end] <= numColumns) {
                    const size = sizes[end] ?? estimatedSize;
                    expect(store.getColumn(end)).toBe(column + 1);
                    expect(store.getSpan(end)).toBe(spans[end]);
                    expect(store.getSize(end)).toBe(size);
                    expect(store.getOffset(end)).toBe(totalSize);
                    column += spans[end];
                    height = Math.max(height, size);
                    end++;
                }
                totalSize += height;
                rows.push({ bottom: totalSize, end: end - 1, start });
                start = end;
            }
            expect(store.length).toBe(spans.length);
            expect(store.getTotalSize()).toBe(totalSize);
            expect(store.getMeasuredCount()).toBe(sizes.filter((size) => size !== undefined).length);
            if (rows.length > 0) {
                for (const offset of [0, random(Math.ceil(totalSize) + 2), totalSize]) {
                    const row = rows.find((entry) => entry.bottom > offset) ?? rows[rows.length - 1];
                    expect(store.findIndexRangeAtOffsets(offset, offset)).toEqual({ end: row.end, start: row.start });
                }
            } else {
                expect(store.findIndexRangeAtOffsets(0, 0)).toBeUndefined();
            }
        }
    });
}
