import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { finishScrollTo } from "../../src/core/finishScrollTo";
import * as scrollToIndexModule from "../../src/core/scrollToIndex";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";
import { countLayoutValues } from "../helpers/layoutArrays";

describe("createImperativeHandle.scrollToEnd", () => {
    let scrollToIndexSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        scrollToIndexSpy = spyOn(scrollToIndexModule, "scrollToIndex");
        scrollToIndexSpy.mockImplementation(() => undefined);
    });

    afterEach(() => {
        scrollToIndexSpy.mockRestore();
    });

    it("includes padding, footer, and custom viewOffset when scrolling to the end", () => {
        const ctx = createMockContext(
            { footerSize: 10 },
            {
                props: {
                    contentInset: { bottom: 14, left: 0, right: 0, top: 0 },
                    data: [1, 2, 3],
                    stylePaddingBottom: 6,
                },
            },
        );

        const handle = createImperativeHandle(ctx);
        handle.scrollToEnd({ animated: false, viewOffset: 5 });

        expect(scrollToIndexSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                animated: false,
                index: 2,
                viewOffset: -(6 + 10) + 5,
                viewPosition: 1,
            }),
        );
    });

    it("returns full content size in getState().contentLength", () => {
        const ctx = createMockContext(
            {
                footerSize: 12,
                headerSize: 24,
                stylePaddingTop: 8,
                totalSize: 200,
            },
            {
                props: {
                    contentInset: { bottom: 10, left: 0, right: 0, top: 0 },
                    stylePaddingBottom: 16,
                },
            },
        );

        const handle = createImperativeHandle(ctx);
        const state = handle.getState();

        expect(state.contentLength).toBe(24 + 12 + 8 + 16 + 200 + 10);
    });

    it("does not expose positions from getState and uses accessors instead", () => {
        const ctx = createMockContext(
            {},
            {
                idCache: ["a", "b"],
                indexByKey: new Map([
                    ["a", 0],
                    ["b", 1],
                ]),
                positions: [10, 40],
                props: {
                    data: [{ id: "a" }, { id: "b" }],
                },
            },
        );

        const state = createImperativeHandle(ctx).getState();

        expect((state as Record<string, unknown>).positions).toBeUndefined();
        expect(state.positionAtIndex(0)).toBe(10);
        expect(state.positionByKey("b")).toBe(40);
    });

    it("flushes deferred positions before exact position accessors read canonical offsets", () => {
        const ctx = createMockContext(
            {},
            {
                deferredPositions: {
                    anchorKey: "b",
                    anchorRenderPosition: 40,
                    drift: 20,
                    minInvalidatedIndex: 1,
                } as any,
                idCache: ["a", "b"],
                indexByKey: new Map([
                    ["a", 0],
                    ["b", 1],
                ]),
                positions: [10, 40],
                props: {
                    data: [{ id: "a" }, { id: "b" }],
                },
            },
        );

        const state = createImperativeHandle(ctx).getState();

        expect(state.positionAtIndex(1)).toBe(60);
        expect(state.positionByKey("b")).toBe(60);
        expect(ctx.state.deferredPositions).toBeUndefined();
    });

    it("clearCaches clears size caches and recalculates positions", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        const ctx = createMockContext(
            { totalSize: 420 },
            {
                averageSizes: { "": { avg: 50, num: 4 }, header: { avg: 20, num: 2 } },
                minIndexSizeChanged: 5,
                props: {
                    data: [{ id: "a" }, { id: "b" }],
                },
                scrollForNextCalculateItemsInView: { bottom: 300, top: 100 },
                sizes: new Map([
                    ["a", 42],
                    ["b", 63],
                ]),
                sizesKnown: new Map([
                    ["a", 45],
                    ["b", 64],
                ]),
                totalSize: 420,
                triggerCalculateItemsInView,
            },
        );

        const handle = createImperativeHandle(ctx);
        handle.clearCaches();

        expect(ctx.state.sizes.size).toBe(0);
        expect(ctx.state.sizesKnown.size).toBe(0);
        expect(Object.keys(ctx.state.averageSizes)).toEqual([]);
        expect(ctx.state.minIndexSizeChanged).toBe(0);
        expect(ctx.state.scrollForNextCalculateItemsInView).toBeUndefined();
        expect(ctx.state.totalSizeExact).toBe(0);
        expect(ctx.values.get("totalSize")).toBe(0);
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
    });

    it("clearCaches full mode also clears key and position caches", () => {
        const ctx = createMockContext(
            {},
            {
                columnSpans: [1],
                columns: [1],
                idCache: ["a", "b"],
                indexByKey: new Map([
                    ["a", 0],
                    ["b", 1],
                ]),
                positions: [0, 50],
                props: {
                    data: [{ id: "a" }, { id: "b" }],
                },
            },
        );

        const handle = createImperativeHandle(ctx);
        handle.clearCaches({ mode: "full" });

        expect(ctx.state.indexByKey.size).toBe(0);
        expect(ctx.state.idCache.length).toBe(0);
        expect(countLayoutValues(ctx.state.positions)).toBe(0);
        expect(countLayoutValues(ctx.state.columns)).toBe(0);
        expect(countLayoutValues(ctx.state.columnSpans)).toBe(0);
    });

    it("returns a promise that resolves when finishScrollTo runs", async () => {
        scrollToIndexSpy.mockImplementation((nextCtx) => {
            nextCtx.state.scrollingTo = { offset: 100 };
        });
        const ctx = createMockContext(
            {},
            {
                props: {
                    data: [1, 2, 3],
                },
            },
        );

        const handle = createImperativeHandle(ctx);
        const scrollPromise = handle.scrollToEnd({ animated: false });

        let resolved = false;
        void scrollPromise.then(() => {
            resolved = true;
        });
        await Promise.resolve();
        expect(resolved).toBe(false);

        finishScrollTo(ctx);
        await scrollPromise;
        expect(resolved).toBe(true);
    });

    it("resolves previous pending promise when a new imperative scroll starts", async () => {
        scrollToIndexSpy.mockImplementation((nextCtx) => {
            nextCtx.state.scrollingTo = { offset: 100 };
        });
        const ctx = createMockContext(
            {},
            {
                props: {
                    data: [1, 2, 3],
                },
            },
        );

        const handle = createImperativeHandle(ctx);
        const firstPromise = handle.scrollToEnd({ animated: true });
        const secondPromise = handle.scrollToEnd({ animated: true });

        await firstPromise;
        finishScrollTo(ctx);
        await secondPromise;
    });

    it("waits for data and MVCP settling before starting imperative scroll", async () => {
        const originalRAF = globalThis.requestAnimationFrame;
        const rafCallbacks: FrameRequestCallback[] = [];

        globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length;
        }) as any;

        const flushRaf = () => {
            const callbacks = rafCallbacks.splice(0, rafCallbacks.length);
            callbacks.forEach((cb) => cb(Date.now()));
        };

        try {
            const ctx = createMockContext({}, {
                didDataChange: true,
                ignoreScrollFromMVCP: { lt: 10 },
                props: {
                    data: [1, 2, 3],
                },
            } as any);

            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToEnd({ animated: false });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.didDataChange = false;
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.ignoreScrollFromMVCP = undefined;
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);

            await promise;
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    it("does not wait when only dataChangeNeedsScrollUpdate is true", async () => {
        const ctx = createMockContext({}, {
            dataChangeNeedsScrollUpdate: true,
            didColumnsChange: false,
            didDataChange: false,
            ignoreScrollFromMVCP: undefined,
            props: {
                data: [1, 2, 3],
            },
            queuedMVCPRecalculate: undefined,
        } as any);

        const handle = createImperativeHandle(ctx);
        const promise = handle.scrollToEnd({ animated: false });

        expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
        await promise;
    });
});
