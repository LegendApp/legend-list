import { describe, expect, it, mock } from "bun:test";
import "../setup";

import {
    applyDeferredResizeDelta,
    flushDeferredPositions,
    flushDeferredPositionsWithCompensation,
    maybeCompleteDeferredInitialScroll,
    shouldFlushDeferredPositionsForScroll,
} from "../../src/core/deferredPositions";
import { createMockContext } from "../__mocks__/createMockContext";

describe("deferredPositions", () => {
    it("rebases settled initial scroll with a final native scroll instead of a scroll adjust", () => {
        const requestAdjust = mock();
        const scrollToNative = mock();
        const data = Array.from({ length: 20 }, (_, index) => ({ id: index }));
        const idCache = data.map((_, index) => `item_${index}`);
        const indexByKey = new Map(idCache.map((id, index) => [id, index]));

        const ctx = createMockContext(
            { totalSize: 8000 },
            {
                deferredPositions: {
                    anchorKey: "item_10",
                    anchorRenderPosition: 4000,
                    desiredScrollOffset: 4000,
                    drift: -198,
                    kind: "initial_scroll",
                    minInvalidatedIndex: 9,
                },
                didContainersLayout: true,
                endBuffered: 10,
                idCache,
                indexByKey,
                positions: Array.from({ length: 20 }, (_, index) => index * 400),
                props: {
                    data,
                },
                refScroller: {
                    current: {
                        getScrollableNode: () => ({}),
                        scrollTo: scrollToNative,
                    },
                } as any,
                scroll: 4000,
                scrollAdjustHandler: {
                    getAdjust: () => 0,
                    requestAdjust,
                    setMounted: () => {},
                } as any,
                startBuffered: 10,
                totalSizeExact: 8000,
            },
        );

        for (const id of idCache) {
            ctx.state.sizes.set(id, 400);
            ctx.state.sizesKnown.set(id, 400);
        }

        const result = maybeCompleteDeferredInitialScroll(ctx);

        expect(result).toBe(true);
        expect(requestAdjust).not.toHaveBeenCalled();
        expect(ctx.state.scrollingTo?.targetOffset).toBe(3802);
        expect(ctx.state.scrollingTo?.offset).toBe(3802);
        expect(ctx.state.scroll).toBe(3802);
        expect(scrollToNative).toHaveBeenCalledWith({
            animated: false,
            x: 0,
            y: 3802,
        });
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });

    it("finishes settled initial scroll without a native scroll when the exact target is already satisfied", () => {
        const requestAdjust = mock();
        const scrollToNative = mock();
        const data = Array.from({ length: 20 }, (_, index) => ({ id: index }));
        const idCache = data.map((_, index) => `item_${index}`);
        const indexByKey = new Map(idCache.map((id, index) => [id, index]));

        const ctx = createMockContext(
            { totalSize: 8200 },
            {
                deferredPositions: {
                    anchorKey: "item_10",
                    anchorRenderPosition: 4000,
                    desiredScrollOffset: 4000,
                    drift: 0,
                    kind: "initial_scroll",
                    minInvalidatedIndex: 10,
                    publishedSizeFloor: 8200,
                },
                didContainersLayout: true,
                idCache,
                indexByKey,
                initialScroll: {
                    contentOffset: 4000,
                    index: 10,
                    pendingContentOffset: 4000,
                    viewOffset: 0,
                    viewPosition: 0,
                },
                initialScrollLastTarget: {
                    contentOffset: 4000,
                    index: 10,
                    pendingContentOffset: 4000,
                    viewOffset: 0,
                    viewPosition: 0,
                },
                positions: Array.from({ length: 20 }, (_, index) => index * 400),
                props: {
                    data,
                },
                refScroller: {
                    current: {
                        getScrollableNode: () => ({}),
                        scrollTo: scrollToNative,
                    },
                } as any,
                scroll: 4000,
                scrollAdjustHandler: {
                    getAdjust: () => 0,
                    requestAdjust,
                    setMounted: () => {},
                } as any,
                totalSizeExact: 8000,
            },
        );

        for (const id of idCache) {
            ctx.state.sizes.set(id, 400);
            ctx.state.sizesKnown.set(id, 400);
        }

        const result = maybeCompleteDeferredInitialScroll(ctx);

        expect(result).toBe(true);
        expect(requestAdjust).not.toHaveBeenCalled();
        expect(scrollToNative).not.toHaveBeenCalled();
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.deferredPositions).toBeUndefined();
        expect(ctx.state.initialScroll).toBeUndefined();
        expect(ctx.state.initialScrollLastTarget).toBeUndefined();
        expect(ctx.state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("totalSize")).toBe(8000);
    });

    it("compensates visible-interaction flushes with a matching scroll adjust", () => {
        const requestAdjust = mock();
        const triggerCalculateItemsInView = mock();
        const data = Array.from({ length: 5 }, (_, index) => ({ id: index }));
        const idCache = data.map((_, index) => `item_${index}`);
        const indexByKey = new Map(idCache.map((id, index) => [id, index]));
        const ctx = createMockContext(
            { readyToRender: true },
            {
                deferredPositions: {
                    anchorKey: "item_3",
                    anchorRenderPosition: 300,
                    drift: 120,
                    kind: "runtime",
                    minInvalidatedIndex: 2,
                },
                firstFullyOnScreenIndex: 3,
                idCache,
                indexByKey,
                positions: [0, 100, 200, 300, 400],
                props: {
                    data,
                },
                scroll: 500,
                scrollAdjustHandler: {
                    getAdjust: () => 0,
                    requestAdjust,
                    setMounted: () => {},
                } as any,
                sizes: new Map([
                    ["item_0", 100],
                    ["item_1", 220],
                    ["item_2", 100],
                    ["item_3", 100],
                    ["item_4", 100],
                ]),
                sizesKnown: new Map([
                    ["item_0", 100],
                    ["item_1", 220],
                    ["item_2", 100],
                    ["item_3", 100],
                    ["item_4", 100],
                ]),
                startNoBuffer: 3,
                triggerCalculateItemsInView,
            },
        );

        const result = flushDeferredPositions(ctx, "visibleInteraction");

        expect(result).toBe(true);
        expect(ctx.state.deferredPositions).toBeUndefined();
        expect(ctx.state.positions[2]).toBe(320);
        expect(ctx.state.positions[3]).toBe(420);
        expect(ctx.state.positions[4]).toBe(520);
        expect(requestAdjust).toHaveBeenCalledWith(120);
        expect(ctx.state.scroll).toBe(620);
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ doMVCP: false });
    });

    it("uses visible-interaction compensation overrides instead of raw drift", () => {
        const requestAdjust = mock();
        const triggerCalculateItemsInView = mock();
        const data = Array.from({ length: 5 }, (_, index) => ({ id: index }));
        const idCache = data.map((_, index) => `item_${index}`);
        const indexByKey = new Map(idCache.map((id, index) => [id, index]));
        const ctx = createMockContext(
            { readyToRender: true },
            {
                deferredPositions: {
                    anchorKey: "item_3",
                    anchorRenderPosition: 300,
                    drift: 120,
                    kind: "runtime",
                    minInvalidatedIndex: 2,
                },
                firstFullyOnScreenIndex: 3,
                idCache,
                indexByKey,
                positions: [0, 100, 200, 300, 400],
                props: {
                    data,
                },
                scroll: 500,
                scrollAdjustHandler: {
                    getAdjust: () => 0,
                    requestAdjust,
                    setMounted: () => {},
                } as any,
                sizes: new Map([
                    ["item_0", 100],
                    ["item_1", 220],
                    ["item_2", 100],
                    ["item_3", 100],
                    ["item_4", 100],
                ]),
                sizesKnown: new Map([
                    ["item_0", 100],
                    ["item_1", 220],
                    ["item_2", 100],
                    ["item_3", 100],
                    ["item_4", 100],
                ]),
                startNoBuffer: 3,
                triggerCalculateItemsInView,
            },
        );

        const result = flushDeferredPositionsWithCompensation(ctx, "visibleInteraction", -80);

        expect(result).toBe(true);
        expect(ctx.state.deferredPositions).toBeUndefined();
        expect(ctx.state.positions[2]).toBe(320);
        expect(ctx.state.positions[3]).toBe(420);
        expect(ctx.state.positions[4]).toBe(520);
        expect(requestAdjust).toHaveBeenCalledWith(-80);
        expect(ctx.state.scroll).toBe(420);
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ doMVCP: false });
    });

    it("tracks first-item render metadata incrementally as deferred drift changes", () => {
        const ctx = createMockContext(
            {},
            {
                deferredPositions: {
                    anchorKey: "item_3",
                    anchorRenderPosition: 300,
                    drift: 0,
                    firstItemRenderPosition: 0,
                    kind: "runtime",
                    minInvalidatedIndex: 2,
                },
                idCache: ["item_0", "item_1", "item_2", "item_3"],
                indexByKey: new Map([
                    ["item_0", 0],
                    ["item_1", 1],
                    ["item_2", 2],
                    ["item_3", 3],
                ]),
                positions: [0, 100, 200, 300],
                props: {
                    data: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }],
                },
            },
        );

        const didApply = applyDeferredResizeDelta(ctx, "item_1", 120);

        expect(didApply).toBe(true);
        expect(ctx.state.deferredPositions).toEqual({
            anchorKey: "item_3",
            anchorRenderPosition: 300,
            drift: 120,
            firstItemRenderPosition: -120,
            kind: "runtime",
            minInvalidatedIndex: 2,
        });
    });

    it("uses stored first-item render metadata for scroll-unsafe flush checks", () => {
        const ctx = createMockContext(
            {},
            {
                deferredPositions: {
                    anchorKey: "item_3",
                    anchorRenderPosition: 300,
                    drift: -40,
                    firstItemRenderPosition: 40,
                    kind: "runtime",
                    minInvalidatedIndex: 2,
                },
                indexByKey: new Map([["item_3", 3]]),
            },
        );

        expect(shouldFlushDeferredPositionsForScroll(ctx, 20)).toBe("scrollUnsafe");
    });

    it("flushes when upward scrolling re-enters the deferred gap above the top boundary", () => {
        const ctx = createMockContext(
            {},
            {
                deferredPositions: {
                    anchorKey: "item_3",
                    anchorRenderPosition: 300,
                    drift: 80,
                    firstItemRenderPosition: -80,
                    kind: "runtime",
                    minInvalidatedIndex: 2,
                },
                indexByKey: new Map([["item_3", 3]]),
                lastScrollDelta: -12,
            },
        );

        expect(shouldFlushDeferredPositionsForScroll(ctx, 60)).toBe("scrollUnsafe");
    });
});
