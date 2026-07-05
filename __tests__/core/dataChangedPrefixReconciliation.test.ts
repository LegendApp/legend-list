import { calculateItemsInView } from "@/core/calculateItemsInView";
import { syncPrefixLayoutStore } from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import { describe, expect, it } from "bun:test";
import { createMockContext } from "../__mocks__/createMockContext";

interface TestItem {
    fixed?: number;
    id: string;
}

function createDataChangeContext(
    data: TestItem[],
    options?: {
        cachedSizes?: Record<string, number>;
        estimatedItemSize?: number;
        fixedSizes?: boolean;
        knownSizes?: Record<string, number>;
    },
) {
    const ctx = createMockContext(
        {
            headerSize: 0,
            numColumns: 1,
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
                keyExtractor: (item: TestItem) => item.id,
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

    syncPrefixLayoutStore(ctx);
    return ctx;
}

function runDataChange(ctx: StateContext) {
    calculateItemsInView(ctx, { dataChanged: true });
    return ctx.state.totalSize;
}

describe("dataChanged prefix reconciliation", () => {
    describe("total size matrix", () => {
        it("uses the current estimate when every size is unknown", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "b" }, { id: "c" }], {
                estimatedItemSize: 80,
            });

            expect(runDataChange(ctx)).toBe(240);
        });

        it("preserves all known sizes across append, prepend, remove, and reorder shapes", () => {
            const cases = [
                {
                    data: [{ id: "a" }, { id: "b" }, { id: "c" }],
                    expected: 180,
                    name: "append",
                },
                {
                    data: [{ id: "c" }, { id: "a" }, { id: "b" }],
                    expected: 180,
                    name: "prepend/reorder",
                },
                {
                    data: [{ id: "a" }, { id: "c" }],
                    expected: 100,
                    name: "remove",
                },
                {
                    data: [{ id: "c" }, { id: "a" }],
                    expected: 100,
                    name: "remove/reorder",
                },
            ];

            for (const testCase of cases) {
                const ctx = createDataChangeContext(testCase.data, {
                    estimatedItemSize: 25,
                    knownSizes: {
                        a: 40,
                        b: 80,
                        c: 60,
                    },
                });

                expect(runDataChange(ctx), testCase.name).toBe(testCase.expected);
            }
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

            expect(runDataChange(ctx)).toBe(100);
            expect(ctx.state.layoutStore?.getMeasuredCount()).toBe(0);
        });

        it("seeds fixed item sizes and estimates only rows without a fixed size", () => {
            const ctx = createDataChangeContext([{ fixed: 10, id: "a" }, { id: "b" }, { fixed: 30, id: "c" }], {
                estimatedItemSize: 50,
                fixedSizes: true,
            });

            expect(runDataChange(ctx)).toBe(90);
            expect(ctx.state.sizesKnown.get("a")).toBe(10);
            expect(ctx.state.sizesKnown.get("c")).toBe(30);
        });

        it("does not let removed known keys contribute to total size", () => {
            const ctx = createDataChangeContext([{ id: "a" }, { id: "c" }], {
                estimatedItemSize: 100,
                knownSizes: {
                    a: 40,
                    b: 80,
                    c: 60,
                },
            });

            expect(runDataChange(ctx)).toBe(100);
        });

        it("moves known sizes with keys after reorder", () => {
            const ctx = createDataChangeContext([{ id: "c" }, { id: "a" }, { id: "b" }], {
                estimatedItemSize: 100,
                knownSizes: {
                    a: 40,
                    b: 80,
                    c: 60,
                },
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

        it("uses estimates or fixed sizes for inserted and prepended new keys", () => {
            const ctx = createDataChangeContext([{ fixed: 15, id: "x" }, { id: "a" }, { id: "b" }, { id: "y" }], {
                estimatedItemSize: 25,
                fixedSizes: true,
                knownSizes: {
                    a: 40,
                    b: 80,
                },
            });

            expect(runDataChange(ctx)).toBe(160);
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
            syncPrefixLayoutStore(ctx);

            expect(runDataChange(ctx)).toBe(150);
        });
    });
});
