import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { syncLayoutStoreStructure } from "../../src/core/layoutStoreLifecycle";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("calculateItemsInView far scroll jumps", () => {
    let ctx: StateContext;

    afterEach(() => {
        ctx?.state.scheduledWork.dispose();
    });

    function setup(count: number, pinned = false) {
        ctx = createMockContext(
            { headerSize: 0, numColumns: 1, numContainers: 40, stylePaddingTop: 0, totalSize: count * 23 },
            {
                otherAxisSize: 900,
                props: {
                    alwaysRenderIndicesArr: pinned ? [200000] : [],
                    alwaysRenderIndicesSet: new Set(pinned ? [200000] : []),
                    dataSource: {
                        getItem: (index) => ({ id: String(index + 1) }),
                        getKey: (index) => String(index + 1),
                        getLength: () => count,
                        getRevision: () => 0,
                        subscribe: () => () => {},
                    },
                    drawDistance: 250,
                    estimatedItemSize: 23,
                    recycleItems: true,
                    stickyHeaderIndicesArr: pinned ? [0, 150000] : [],
                    stickyHeaderIndicesSet: new Set(pinned ? [0, 150000] : []),
                },
                scrollLength: 800,
                scrollTargetPinnedRange: pinned ? { end: 230002, start: 230000 } : undefined,
            },
        );
        return syncLayoutStoreStructure(ctx)!;
    }

    function expectAssigned(index: number) {
        const key = String(index + 1);
        const container = ctx.state.containerItemKeys.get(key);
        expect(container).toBeDefined();
        expect(ctx.values.get(`containerItemIndex${container}`)).toBe(index);
        expect(ctx.values.get(`containerItemData${container}`)).toEqual({ id: key });
    }

    function jump(index: number, offset = index * 23) {
        const store = ctx.state.layoutStoreRuntime!.store;
        const reads = spyOn(store, "getOffset");
        const previous = ctx.state.scroll;
        ctx.state.scroll = offset;
        ctx.state.scrollForNextCalculateItemsInView = undefined;
        try {
            calculateItemsInView(ctx, {
                drawDistanceMode: "visible-first",
                scrollVelocity: offset < previous ? -1000 : 1000,
            });
            // Count operations, not elapsed time: skipped distance must not matter,
            // including when an old container is still mounted far below the viewport.
            expect(reads.mock.calls.length).toBeLessThan(300);
            expect(ctx.state.startNoBuffer).toBe(index);
            for (let i = ctx.state.startBuffered!; i <= ctx.state.endBuffered!; i++) {
                expectAssigned(i);
            }
        } finally {
            reads.mockRestore();
        }
    }

    for (const count of [30000, 273504, 1000000]) {
        it(`bounds repeated upward and downward jumps with ${count} rows`, () => {
            setup(count);
            for (let repeat = 0; repeat < 3; repeat++) {
                for (const index of [1000, count - 100, 1000, Math.floor(count / 2), 0]) {
                    jump(index);
                    expect(ctx.state.endNoBuffer).toBe(index + 34);
                }
            }
        });
    }

    it("preserves variable measured heights and later remeasurement", () => {
        const store = setup(273504);
        const measure = (index: number, size: number) => {
            store.setMeasuredSize(index, size);
            const key = String(index + 1);
            ctx.state.sizes.set(key, size);
            ctx.state.sizesKnown.set(key, size);
            ctx.values.set("totalSize", store.getTotalSize());
        };
        for (const [index, size] of [
            [50, 230],
            [1000, 92],
            [1001, 69],
            [250000, 138],
            [250001, 46],
        ]) {
            measure(index, size);
        }
        for (const index of [250000, 1000, 250000, 0, 1000]) {
            const offset = store.getOffset(index);
            const expectedEnd = store.findIndexRangeAtOffsets(offset, offset + 799).end;
            jump(index, offset);
            expect(ctx.state.endNoBuffer).toBe(expectedEnd);
        }
        measure(1000, 230);
        jump(250000, store.getOffset(250000));
        jump(1000, store.getOffset(1000));
    });

    it("keeps sticky, always-rendered and pinned rows assigned without scanning their gaps", () => {
        setup(273504, true);
        for (const index of [1000, 250000, 1000, 250000, 0]) {
            jump(index);
            const sticky = index >= 150000 ? 150000 : 0;
            expect(ctx.values.get("activeStickyIndex")).toBe(sticky);
            for (const pinned of [sticky, 200000, 230000, 230001, 230002]) {
                expectAssigned(pinned);
            }
        }
    });
});
