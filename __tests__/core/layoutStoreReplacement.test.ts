import { describe, expect, it } from "bun:test";
import type { LayoutStoreSizeEntry } from "../../src/core/LayoutStore";
import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import { RowLayoutStore } from "../../src/core/RowLayoutStore";

type Store = PrefixLayoutStore | RowLayoutStore;

function readLayout(store: Store) {
    return {
        average: store.getMeasuredAverageSize(),
        estimate: store.getEstimatedSize(),
        items: Array.from({ length: store.length }, (_, index) => [store.getOffset(index), store.getSize(index)]),
        measuredCount: store.getMeasuredCount(),
        positiveAverage: store.getPositiveMeasuredAverageSize(),
        total: store.getTotalSize(),
    };
}

for (const kind of ["prefix", "rows", "spans"] as const) {
    describe(`${kind} size replacement`, () => {
        const createStore = () => {
            const store =
                kind === "prefix"
                    ? new PrefixLayoutStore(6, 100)
                    : new RowLayoutStore({
                          estimatedSize: 100,
                          length: 6,
                          numColumns: 2,
                          spans: kind === "spans" ? [2, 1, 1, 2, 1, 1] : undefined,
                      });
            store.replaceKnownSizeEntries([
                { index: 0, size: 200, type: "measured" },
                { index: 2, size: 150, type: "cached" },
            ]);
            return store;
        };

        it("matches separate estimate and size updates", () => {
            const entries: LayoutStoreSizeEntry[] = [
                { index: 0, size: 0, type: "measured" },
                { index: 1, size: 40.25, type: "measured" },
                { index: 1, size: 200, type: "cached" },
                { index: 3, size: 75.5, type: "cached" },
            ];
            for (const estimate of [0, 25.5, 100, 200]) {
                const separate = createStore();
                separate.setEstimatedSize(estimate);
                separate.replaceKnownSizeEntries(entries);
                const combined = createStore();
                combined.replaceKnownSizeEntries(entries, estimate);
                expect(readLayout(combined)).toEqual(readLayout(separate));
                for (const offset of [0, 40, 100, separate.getTotalSize()]) {
                    expect(combined.findIndexRangeAtOffsets(offset, offset + 100)).toEqual(
                        separate.findIndexRangeAtOffsets(offset, offset + 100),
                    );
                }
            }
        });

        it("clears old measurements while replacing the estimate", () => {
            const store = createStore();
            store.replaceKnownSizeEntries([], 25.5);
            expect(store.getEstimatedSize()).toBe(25.5);
            expect(store.getMeasuredCount()).toBe(0);
            expect(store.getTotalSize()).toBe((kind === "prefix" ? 6 : kind === "rows" ? 3 : 4) * 25.5);
        });

        it("retains the estimate when it is omitted", () => {
            const store = createStore();
            store.replaceKnownSizeEntries([]);
            expect(store.getEstimatedSize()).toBe(100);
        });

        it("preserves sizes and estimate when validation fails", () => {
            const store = createStore();
            const before = readLayout(store);
            for (const estimate of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
                expect(() => store.replaceKnownSizeEntries([], estimate)).toThrow(RangeError);
                expect(readLayout(store)).toEqual(before);
            }
            for (const entry of [
                { index: 6, size: 30 },
                { index: 1, size: -1 },
                { index: 1, size: Number.NaN },
                { index: 1, size: Number.POSITIVE_INFINITY },
            ]) {
                expect(() =>
                    store.replaceKnownSizeEntries(
                        [
                            { index: 0, size: 500, type: "measured" },
                            { ...entry, type: "cached" },
                        ],
                        25.5,
                    ),
                ).toThrow(RangeError);
                expect(readLayout(store)).toEqual(before);
            }
        });
    });
}
