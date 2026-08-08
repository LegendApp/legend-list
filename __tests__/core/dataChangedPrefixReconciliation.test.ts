import { calculateItemsInView } from "@/core/calculateItemsInView";
import { checkResetContainers } from "@/core/checkResetContainers";
import { reconcileLayoutStoreDataChange, syncLayoutStoreStructure } from "@/core/layoutStoreLifecycle";
import { RowLayoutStore } from "@/core/RowLayoutStore";
import { peek$, type StateContext, set$ } from "@/state/state";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { describe, expect, it, mock, spyOn } from "bun:test";
import { createMockContext } from "../__mocks__/createMockContext";
import { clearLayoutValues, countLayoutValues, setLayoutValue } from "../helpers/layoutStore";

interface TestItem {
    fixed?: number;
    id: string;
}

class CountingMap<K, V> extends Map<K, V> {
    getCount = 0;

    get(key: K) {
        this.getCount++;
        return super.get(key);
    }
}

function createDataChangeContext(
    data: TestItem[],
    options?: {
        cachedSizes?: Record<string, number>;
        estimatedItemSize?: number;
        fixedSizes?: boolean;
        hasReliableKeyExtractor?: boolean;
        knownSizes?: Record<string, number>;
        numColumns?: number;
        overrideItemLayout?: NonNullable<StateContext["state"]["props"]["overrideItemLayout"]>;
    },
) {
    const numColumns = options?.numColumns ?? 1;
    const ctx = createMockContext(
        {
            headerSize: 0,
            numColumns,
            numContainers: Math.max(1, Math.min(10, data.length)),
            readyToRender: true,
            stylePaddingTop: 0,
            totalSize: 0,
        },
        {
            didContainersLayout: true,
            isFirst: false,
            positions: [],
            props: {
                data,
                drawDistance: 0,
                estimatedItemSize: options?.estimatedItemSize ?? 100,
                getFixedItemSize: options?.fixedSizes ? (item: TestItem) => item.fixed : undefined,
                hasReliableKeyExtractor: options?.hasReliableKeyExtractor ?? true,
                keyExtractor: (item: TestItem) => item.id,
                numColumns,
                overrideItemLayout: options?.overrideItemLayout,
            },
            scroll: 0,
            scrollLength: 300,
            totalSize: 0,
        },
    );

    for (const [key, size] of Object.entries(options?.knownSizes ?? {})) {
        ctx.state.sizesKnown.set(key, size);
    }
    for (const [key, size] of Object.entries(options?.cachedSizes ?? {})) {
        ctx.state.sizes.set(key, size);
    }

    syncLayoutStoreStructure(ctx);
    return ctx;
}

function runDataChange(ctx: StateContext) {
    calculateItemsInView(ctx, { dataChanged: true });
    return ctx.state.totalSize;
}

function seedPreviousLayout(ctx: StateContext, data: TestItem[], itemSize: number) {
    const state = ctx.state;
    state.idCache.length = 0;
    state.indexByKey.clear();
    clearLayoutValues(state, "positions");
    for (let index = 0; index < data.length; index++) {
        const key = data[index].id;
        state.idCache[index] = key;
        state.indexByKey.set(key, index);
        setLayoutValue(state, "positions", index, index * itemSize);
        state.sizes.set(key, itemSize);
        state.sizesKnown.set(key, itemSize);
    }
}

function seedPreviousPrefixLayout(ctx: StateContext, data: TestItem[], sizesByKey: Record<string, number>) {
    const state = ctx.state;
    const store = state.layoutStoreRuntime?.store;
    state.idCache.length = 0;
    state.indexByKey.clear();
    store?.clearKnownSizes();
    for (let index = 0; index < data.length; index++) {
        const key = data[index].id;
        const size = sizesByKey[key];
        state.idCache[index] = key;
        state.indexByKey.set(key, index);
        state.sizes.set(key, size);
        state.sizesKnown.set(key, size);
        store?.setMeasuredSize(index, size);
    }
}

describe("dataChanged prefix reconciliation", () => {
    describe("total size matrix", () => {
        it("uses the current estimate when every size is unknown", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }], {
                estimatedItemSize: 80,
            });

            expect(runDataChange(ctx)).toBe(240);
        });

        it("leaves unmaterialized known sizes estimate-backed instead of globally placing them", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }], {
                estimatedItemSize: 25,
                knownSizes: {
                    a: 40,
                    b: 80,
                    c: 60,
                },
            });

            expect(runDataChange(ctx)).toBe(75);
            expect(ctx.state.indexByKey.size).toBe(3);
        });

        it("preserves materialized known sizes and estimates appended items from the configured fallback", () => {
            const previousData = [{ id: "a" }, { id: "b" }];
            const nextData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const ctx = createDataChangeContext(nextData, {
                estimatedItemSize: 25,
                knownSizes: {
                    a: 40,
                    b: 80,
                    c: 60,
                },
            });
            seedPreviousPrefixLayout(ctx, previousData, {
                a: 40,
                b: 80,
            });

            expect(runDataChange(ctx)).toBe(145);
            expect(ctx.state.indexByKey.get("a")).toBe(0);
            expect(ctx.state.indexByKey.get("b")).toBe(1);
            expect(ctx.state.indexByKey.get("c")).toBe(2);
        });

        it("combines known sizes with estimates for unknown rows", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], {
                estimatedItemSize: 50,
                knownSizes: {
                    a: 25,
                    c: 75,
                },
            });

            expect(runDataChange(ctx)).toBe(200);
        });

        it("uses cached committed sizes without counting them as measured prefix samples", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }], {
                cachedSizes: {
                    a: 30,
                    b: 70,
                },
                estimatedItemSize: 100,
            });

            expect(runDataChange(ctx)).toBe(200);
            expect(ctx.state.layoutStoreRuntime?.store.getMeasuredCount()).toBe(0);
        });

        it("uses fixed sizes for rows materialized by the viewport", () => {
            const ctx = createDataChangeContext([{ fixed: 10, id: "a" }, { id: "b" }, { fixed: 30, id: "c" }], {
                estimatedItemSize: 50,
                fixedSizes: true,
            });

            expect(runDataChange(ctx)).toBe(90);
            expect(ctx.state.layoutStoreRuntime?.store.getEstimatedSize()).toBe(50);
            expect(ctx.state.sizesKnown.get("a")).toBeUndefined();
            expect(ctx.state.sizesKnown.get("c")).toBeUndefined();
        });

        it("does not let unmaterialized removed known keys contribute to total size", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "c" }], {
                estimatedItemSize: 100,
                knownSizes: {
                    a: 40,
                    b: 80,
                    c: 60,
                },
            });

            expect(runDataChange(ctx)).toBe(200);
        });

        it("moves materialized known sizes with keys after reorder", () => {
            const previousData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const nextData = [{ id: "c" }, { id: "a" }, { id: "b" }];
            const ctx = createDataChangeContext(nextData, {
                estimatedItemSize: 100,
                knownSizes: {
                    a: 40,
                    b: 80,
                    c: 60,
                },
            });
            seedPreviousPrefixLayout(ctx, previousData, {
                a: 40,
                b: 80,
                c: 60,
            });

            runDataChange(ctx);

            expect(ctx.state.totalSize).toBe(180);
            expect(ctx.state.indexByKey.get("c")).toBe(0);
            expect(ctx.state.indexByKey.get("a")).toBe(1);
            expect(ctx.state.indexByKey.get("b")).toBe(2);
            expect(ctx.state.sizesKnown.get("c")).toBe(60);
            expect(ctx.state.sizesKnown.get("a")).toBe(40);
            expect(ctx.state.sizesKnown.get("b")).toBe(80);
        });

        it("combines materialized fixed sizes with estimates for dynamic rows", () => {
            const ctx = createDataChangeContext([{ fixed: 15, id: "x" }, { id: "a" }, { id: "b" }, { id: "y" }], {
                estimatedItemSize: 25,
                fixedSizes: true,
                knownSizes: {
                    a: 40,
                    b: 80,
                },
            });

            expect(runDataChange(ctx)).toBe(90);
            expect(ctx.state.layoutStoreRuntime?.store.getEstimatedSize()).toBe(25);
        });

        it("uses the updated estimate for unknown rows without double-counting known rows", () => {
            const ctx = createDataChangeContext([{ id: "a" }], {
                estimatedItemSize: 40,
                knownSizes: {
                    a: 10,
                },
            });
            ctx.state.props.data = [{ id: "a" }, { id: "b" }, { id: "c" }];
            ctx.state.props.estimatedItemSize = 70;
            syncLayoutStoreStructure(ctx);

            expect(runDataChange(ctx)).toBe(210);
        });
    });

    describe("current keyed data-change behavior", () => {
        it("adjusts MVCP from the old keyed anchor position to the rebuilt keyed position", () => {
            const previousData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const nextData = [{ id: "x" }, { id: "a" }, { id: "b" }, { id: "c" }];
            const ctx = createDataChangeContext(nextData, {
                estimatedItemSize: 100,
                knownSizes: {
                    a: 100,
                    b: 100,
                    c: 100,
                    x: 100,
                },
            });
            seedPreviousLayout(ctx, previousData, 100);
            ctx.state.didContainersLayout = true;
            ctx.state.idsInView = ["b"];
            ctx.state.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

            try {
                calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

                expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 100, true);
                expect(ctx.state.indexByKey.get("b")).toBe(2);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("adjusts MVCP from old prefix offsets to rebuilt prefix offsets after prepend", () => {
            const previousData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const nextData = [{ id: "x" }, { id: "a" }, { id: "b" }, { id: "c" }];
            const sizesByKey = {
                a: 40,
                b: 70,
                c: 30,
                x: 25,
            };
            const ctx = createDataChangeContext(nextData, {
                estimatedItemSize: 100,
                knownSizes: sizesByKey,
            });
            seedPreviousPrefixLayout(ctx, previousData, sizesByKey);
            ctx.state.didContainersLayout = true;
            ctx.state.idsInView = ["b"];
            ctx.state.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

            try {
                calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

                expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 25, true);
                expect(ctx.state.indexByKey.get("b")).toBe(2);
                expect(ctx.state.layoutStoreRuntime?.store.getOffset(2)).toBe(65);
                expect(countLayoutValues(ctx.state, "positions")).toBe(0);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("uses the next surviving visible anchor when the first MVCP anchor was removed", () => {
            const previousData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const nextData = [{ id: "a" }, { id: "c" }, { id: "d" }];
            const sizesByKey = {
                a: 40,
                b: 70,
                c: 30,
                d: 50,
            };
            const ctx = createDataChangeContext(nextData, {
                estimatedItemSize: 100,
                knownSizes: sizesByKey,
            });
            seedPreviousPrefixLayout(ctx, previousData, sizesByKey);
            ctx.state.didContainersLayout = true;
            ctx.state.idsInView = ["b", "c"];
            ctx.state.scrollLength = 50;
            set$(ctx, "totalSize", 140);
            ctx.state.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

            try {
                calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

                expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, -70, true);
                expect(ctx.state.indexByKey.get("b")).toBeUndefined();
                expect(ctx.state.indexByKey.get("c")).toBe(1);
                expect(ctx.state.layoutStoreRuntime?.store.getOffset(1)).toBe(40);
                expect(countLayoutValues(ctx.state, "positions")).toBe(0);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("removes disappeared mounted keys while preserving still-mounted keyed containers", () => {
            const previousData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const nextData = [{ id: "a" }, { id: "c" }, { id: "d" }];
            const ctx = createDataChangeContext(nextData, {
                estimatedItemSize: 100,
                knownSizes: {
                    a: 100,
                    b: 100,
                    c: 100,
                    d: 100,
                },
            });
            seedPreviousLayout(ctx, previousData, 100);
            ctx.values.set("numContainers", 3);
            for (let index = 0; index < previousData.length; index++) {
                const key = previousData[index].id;
                ctx.state.containerItemKeys.set(key, index);
                set$(ctx, `containerItemKey${index}`, key);
                set$(ctx, `containerItemData${index}`, previousData[index]);
            }

            calculateItemsInView(ctx, { dataChanged: true });

            expect(ctx.state.containerItemKeys.get("b")).toBeUndefined();
            expect(ctx.state.containerItemKeys.get("c")).toBe(2);
            expect(peek$(ctx, "containerItemKey2")).toBe("c");
            expect(peek$(ctx, "containerItemKey1")).not.toBe("b");
        });

        it("preserves same-key known and cached size entries across a keyed replacement", () => {
            const ctx = createDataChangeContext([{ id: "a" }], {
                cachedSizes: {
                    a: 111,
                },
                estimatedItemSize: 100,
                knownSizes: {
                    a: 123,
                },
            });
            ctx.state.idCache[0] = "a";

            runDataChange(ctx);

            expect(ctx.state.totalSize).toBe(123);
            expect(ctx.state.sizesKnown.get("a")).toBe(123);
            expect(ctx.state.sizes.get("a")).toBe(111);
            expect(ctx.state.layoutStoreRuntime?.store.getSize(0)).toBe(123);
        });
    });

    describe("store reconciliation boundaries", () => {
        it("keeps prefix layout active for single-column data changes without a reliable key extractor", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }], {
                estimatedItemSize: 100,
                hasReliableKeyExtractor: false,
            });
            ctx.state.props.keyExtractor = (_item: TestItem, index: number) => String(index);
            ctx.state.sizesKnown.set("0", 25);
            ctx.state.sizes.set("0", 25);

            runDataChange(ctx);

            expect(ctx.state.layoutStoreRuntime?.store).toBeDefined();
            expect(ctx.state.layoutStoreRuntime?.store.getTotalSize()).toBe(300);
            expect(ctx.state.layoutStoreRuntime?.store.getMeasuredCount()).toBe(0);
            expect(ctx.state.sizesKnown.size).toBe(0);
            expect(ctx.state.sizes.size).toBe(0);
            expect(countLayoutValues(ctx.state, "positions")).toBe(0);
        });

        it("keeps row layout active for multi-column data changes", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], {
                estimatedItemSize: 50,
                numColumns: 2,
            });

            runDataChange(ctx);

            const store = ctx.state.layoutStoreRuntime?.store;
            expect(store).toBeInstanceOf(RowLayoutStore);
            expect(store?.getTotalSize()).toBe(100);
            expect(countLayoutValues(ctx.state, "positions")).toBe(0);
            expect(Array.from({ length: 4 }, (_, index) => (store as RowLayoutStore).getColumn(index))).toEqual([
                1, 2, 1, 2,
            ]);
        });

        it("keeps row layout active for overrideItemLayout data changes", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }], {
                estimatedItemSize: 60,
                numColumns: 2,
                overrideItemLayout: (layout, _item, index) => {
                    layout.span = index === 0 ? 2 : 1;
                },
            });

            runDataChange(ctx);

            const store = ctx.state.layoutStoreRuntime?.store;
            expect(store).toBeInstanceOf(RowLayoutStore);
            expect(store?.getTotalSize()).toBe(120);
            expect(countLayoutValues(ctx.state, "positions")).toBe(0);
            expect(Array.from({ length: 3 }, (_, index) => (store as RowLayoutStore).getSpan(index))).toEqual([
                2, 1, 1,
            ]);
        });
    });

    describe("dense position regression coverage", () => {
        it("preserves appended known sizes without relearning the configured fallback", () => {
            const previousData = [{ id: "a" }, { id: "b" }];
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }], {
                estimatedItemSize: 25,
                knownSizes: {
                    a: 40,
                    b: 80,
                    c: 60,
                },
            });
            seedPreviousPrefixLayout(ctx, previousData, {
                a: 40,
                b: 80,
            });

            try {
                expect(runDataChange(ctx)).toBe(145);

                expect(countLayoutValues(ctx.state, "positions")).toBe(0);
            } finally {
            }
        });

        it("preserves a prepended MVCP anchor through store reconciliation", () => {
            const previousData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const nextData = [{ id: "x" }, { id: "a" }, { id: "b" }, { id: "c" }];
            const sizesByKey = {
                a: 40,
                b: 70,
                c: 30,
                x: 25,
            };
            const ctx = createDataChangeContext(nextData, {
                estimatedItemSize: 100,
                knownSizes: sizesByKey,
            });
            seedPreviousPrefixLayout(ctx, previousData, sizesByKey);
            ctx.state.didContainersLayout = true;
            ctx.state.idsInView = ["b"];
            ctx.state.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

            try {
                calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

                expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 25, true);
                expect(countLayoutValues(ctx.state, "positions")).toBe(0);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("syncs snap offsets from prefix offsets after data changes", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }], {
                knownSizes: {
                    a: 40,
                    b: 60,
                    c: 80,
                },
            });
            ctx.state.props.snapToIndices = [0, 2];

            try {
                runDataChange(ctx);

                expect(peek$(ctx, "snapToOffsets")).toEqual([0, 200]);
                expect(countLayoutValues(ctx.state, "positions")).toBe(0);
            } finally {
            }
        });

        it("resets duplicate-key data changes to fresh prefix estimates", () => {
            const previousData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const ctx = createDataChangeContext([{ id: "a" }, { id: "a" }, { id: "b" }], {
                estimatedItemSize: 50,
                knownSizes: {
                    a: 25,
                    b: 75,
                },
            });
            seedPreviousPrefixLayout(ctx, previousData, {
                a: 25,
                b: 75,
                c: 50,
            });

            try {
                runDataChange(ctx);

                expect(ctx.state.layoutStoreRuntime?.store).toBeDefined();
                expect(ctx.state.layoutStoreRuntime?.store.getMeasuredCount()).toBe(0);
                expect(ctx.state.layoutStoreRuntime?.store.getTotalSize()).toBe(150);
                expect(ctx.state.sizesKnown.size).toBe(0);
                expect(countLayoutValues(ctx.state, "positions")).toBe(0);
            } finally {
            }
        });

        it("keeps maintainScrollAtEnd on the prefix data-change path with preserved known sizes", async () => {
            const previousData = [{ id: "a" }, { id: "b" }];
            const nextData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const ctx = createDataChangeContext(nextData, {
                knownSizes: {
                    a: 40,
                    b: 60,
                    c: 120,
                },
            });
            seedPreviousPrefixLayout(ctx, previousData, {
                a: 40,
                b: 60,
                c: 120,
            });
            const scrollToEnd = mock(() => {});
            ctx.state.previousData = previousData;
            ctx.state.didContainersLayout = true;
            ctx.state.props.maintainScrollAtEnd = { animated: false, on: { dataChange: true } };
            ctx.state.refScroller = {
                current: {
                    scrollToEnd,
                },
            } as StateContext["state"]["refScroller"];
            ctx.values.set("isWithinMaintainScrollAtEndThreshold", true);

            try {
                checkResetContainers(ctx, nextData);
                await new Promise((resolve) => setTimeout(resolve, 0));

                expect(countLayoutValues(ctx.state, "positions")).toBe(0);
                expect(ctx.state.totalSize).toBe(200);
                expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
                expect(ctx.state.isEndReached).not.toBe(false);
            } finally {
            }
        });

        it("reuses previous same-index keys proved during structural comparison", () => {
            const itemA = { id: "a" };
            const itemBOld = { id: "b", version: 1 };
            const itemBNew = { id: "b", version: 2 };
            const itemC = { id: "c" };
            const itemD = { id: "d" };
            const previousData = [itemA, itemBOld, itemC];
            const nextData = [itemA, itemBNew, itemC, itemD];
            const ctx = createDataChangeContext(nextData, {
                knownSizes: {
                    a: 40,
                    b: 60,
                    c: 80,
                    d: 100,
                },
            });
            seedPreviousPrefixLayout(ctx, previousData, {
                a: 40,
                b: 60,
                c: 80,
                d: 100,
            });
            ctx.state.previousData = previousData;
            ctx.state.pendingDataComparison = {
                byIndex: [undefined, 2],
                nextData,
                previousData,
            };
            let keyExtractorCalls = 0;
            ctx.state.props.keyExtractor = (item: TestItem) => {
                keyExtractorCalls++;
                return item.id;
            };

            calculateItemsInView(ctx, { dataChanged: true });

            expect(keyExtractorCalls).toBe(1);
            expect(ctx.state.indexByKey).toEqual(
                new Map([
                    ["a", 0],
                    ["b", 1],
                    ["c", 2],
                    ["d", 3],
                ]),
            );
            expect(countLayoutValues(ctx.state, "positions")).toBe(0);
        });

        it("recomputes same-index keys when the key extractor changed during data reconciliation", () => {
            const itemA = { id: "a" };
            const itemBOld = { id: "b", version: 1 };
            const itemBNew = { id: "b", version: 2 };
            const itemC = { id: "c" };
            const previousData = [itemA, itemBOld, itemC];
            const nextData = [itemA, itemBNew, itemC];
            const ctx = createDataChangeContext(nextData, {
                estimatedItemSize: 50,
            });
            const store = ctx.state.layoutStoreRuntime?.store;

            ctx.state.idCache.length = 0;
            ctx.state.indexByKey.clear();
            for (let index = 0; index < previousData.length; index++) {
                const key = `old-${previousData[index].id}`;
                const size = (index + 1) * 20;
                ctx.state.idCache[index] = key;
                ctx.state.indexByKey.set(key, index);
                ctx.state.sizes.set(key, size);
                ctx.state.sizesKnown.set(key, size);
                store?.setMeasuredSize(index, size);
            }
            ctx.state.previousData = previousData;
            ctx.state.pendingDataComparison = {
                byIndex: [undefined, 2],
                nextData,
                previousData,
            };
            ctx.state.dataChangeKeyExtractorChanged = true;
            ctx.state.props.keyExtractor = (item: TestItem) => `new-${item.id}`;

            calculateItemsInView(ctx, { dataChanged: true });

            expect(ctx.state.idCache.slice(0, 3)).toEqual(["new-a", "new-b", "new-c"]);
            expect(ctx.state.indexByKey.get("new-a")).toBe(0);
            expect(ctx.state.indexByKey.get("new-b")).toBe(1);
            expect(ctx.state.indexByKey.get("new-c")).toBe(2);
            expect(ctx.state.indexByKey.get("old-a")).toBeUndefined();
            expect(ctx.state.indexByKey.get("old-b")).toBeUndefined();
            expect(ctx.state.indexByKey.get("old-c")).toBeUndefined();
            expect(countLayoutValues(ctx.state, "positions")).toBe(0);
        });
    });

    describe("prefix reconciliation helper", () => {
        it("rebuilds sparse materialized identity and seeds known and cached sizes without probing fixed sizes", () => {
            const ctx = createDataChangeContext(
                [{ fixed: 20, id: "a" }, { id: "b" }, { fixed: 30, id: "c" }, { id: "d" }],
                {
                    cachedSizes: {
                        d: 90,
                    },
                    estimatedItemSize: 50,
                    fixedSizes: true,
                    knownSizes: {
                        b: 80,
                    },
                },
            );
            const getFixedItemSize = mock((item: TestItem) => item.fixed);
            ctx.state.props.getFixedItemSize = getFixedItemSize;
            ctx.state.idCache[1] = "b";
            ctx.state.idCache[3] = "d";

            const didReconcile = reconcileLayoutStoreDataChange(ctx);

            expect(didReconcile).toBe(true);
            expect(ctx.state.indexByKey).toEqual(
                new Map([
                    ["b", 1],
                    ["d", 3],
                ]),
            );
            expect(ctx.state.layoutStoreRuntime?.store.getTotalSize()).toBe(270);
            expect(ctx.state.layoutStoreRuntime?.store.getMeasuredCount()).toBe(1);
            expect(ctx.state.sizesKnown.get("a")).toBeUndefined();
            expect(ctx.state.sizesKnown.get("b")).toBe(80);
            expect(ctx.state.sizesKnown.get("c")).toBeUndefined();
            expect(ctx.state.sizes.get("d")).toBe(90);
            expect(getFixedItemSize).not.toHaveBeenCalled();
            expect(countLayoutValues(ctx.state, "positions")).toBe(0);
        });

        it("keeps the configured estimate while restoring measured sizes after a data change", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], {
                estimatedItemSize: 100,
                knownSizes: {
                    a: 20,
                    b: 40,
                },
            });
            ctx.state.idCache[0] = "a";
            ctx.state.idCache[1] = "b";

            const didReconcile = reconcileLayoutStoreDataChange(ctx);

            expect(didReconcile).toBe(true);
            expect(ctx.state.layoutStoreRuntime?.store.getEstimatedSize()).toBe(100);
            expect(ctx.state.layoutStoreRuntime?.store.getTotalSize()).toBe(260);
        });

        it("preserves shifted materialized keys after front deletion without duplicate reset", () => {
            const previousData = [{ id: "a" }, { id: "b" }, { id: "c" }];
            const ctx = createDataChangeContext([{ id: "b" }, { id: "c" }], {
                estimatedItemSize: 50,
                knownSizes: {
                    a: 30,
                    b: 70,
                    c: 90,
                },
            });
            ctx.state.previousData = previousData;
            ctx.state.idCache[0] = "a";
            ctx.state.idCache[1] = "b";
            ctx.state.idCache[2] = "c";

            const didReconcile = reconcileLayoutStoreDataChange(ctx);

            expect(didReconcile).toBe(true);
            expect(ctx.state.indexByKey).toEqual(
                new Map([
                    ["b", 0],
                    ["c", 1],
                ]),
            );
            expect(ctx.state.layoutStoreRuntime?.store.getMeasuredCount()).toBe(2);
            expect(ctx.state.layoutStoreRuntime?.store.getTotalSize()).toBe(160);
        });

        it("returns false for duplicate keys so callers can reset prefix preservation", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "a" }], {
                estimatedItemSize: 50,
            });
            ctx.state.idCache[0] = "old-a";
            ctx.state.idCache[1] = "old-b";

            const didReconcile = reconcileLayoutStoreDataChange(ctx);

            expect(didReconcile).toBe(false);
            expect(ctx.state.indexByKey.get("a")).toBe(0);
        });

        it("skips size-cache probes when no size knowledge can be reused", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }], {
                estimatedItemSize: 40,
            });
            const sizes = new CountingMap<string, number>();
            const sizesKnown = new CountingMap<string, number>();
            ctx.state.sizes = sizes;
            ctx.state.sizesKnown = sizesKnown;

            const didReconcile = reconcileLayoutStoreDataChange(ctx);

            expect(didReconcile).toBe(true);
            expect(sizes.getCount).toBe(0);
            expect(sizesKnown.getCount).toBe(0);
            expect(ctx.state.layoutStoreRuntime?.store.getTotalSize()).toBe(120);
        });

        it("reconciles million-item data from sparse materialized identities", () => {
            const data = Array.from({ length: 1_000_000 }, (_, index) => ({ id: `item-${index}` }));
            const ctx = createDataChangeContext(data, {
                estimatedItemSize: 10,
                knownSizes: {
                    "item-999999": 20,
                },
            });
            let keyExtractorCalls = 0;
            ctx.state.props.keyExtractor = (item: TestItem) => {
                keyExtractorCalls++;
                return item.id;
            };
            ctx.state.idCache[999_999] = "item-999999";

            const didReconcile = reconcileLayoutStoreDataChange(ctx);

            expect(didReconcile).toBe(true);
            expect(keyExtractorCalls).toBe(1);
            expect(ctx.state.indexByKey.get("item-999999")).toBe(999_999);
            expect(ctx.state.indexByKey.size).toBe(1);
            expect(ctx.state.layoutStoreRuntime?.store.getTotalSize()).toBe(10_000_010);
        });
    });
});
