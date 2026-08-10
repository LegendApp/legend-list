import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { cancelImperativeScroll } from "../../src/core/cancelImperativeScroll";
import { createContainerItemMetadata } from "../../src/core/containerItemMetadata";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import * as initialScrollLifecycleModule from "../../src/core/initialScrollLifecycle";
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

    const installRafMock = () => {
        const originalRAF = globalThis.requestAnimationFrame;
        const rafCallbacks: FrameRequestCallback[] = [];

        globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length;
        }) as any;

        return {
            flushRaf: () => {
                const callbacks = rafCallbacks.splice(0, rafCallbacks.length);
                callbacks.forEach((cb) => cb(Date.now()));
            },
            restore: () => {
                globalThis.requestAnimationFrame = originalRAF;
            },
        };
    };

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

    it("returns average item sizes by public item type keys", () => {
        const ctx = createMockContext(
            {},
            {
                averageSizes: {
                    "": { avg: 72, num: 5 },
                    header: { avg: 40, num: 2 },
                },
            },
        );

        const state = createImperativeHandle(ctx).getState();

        expect(state.getAverageItemSizes()).toEqual({
            default: { average: 72, count: 5 },
            header: { average: 40, count: 2 },
        });
    });

    it("returns the native scroll ref as the animatable ref when available", () => {
        const nativeScrollRef = { __nativeTag: 7 };
        const scroller = {
            flashScrollIndicators: () => {},
            getNativeScrollRef: () => nativeScrollRef,
            getScrollableNode: () => ({}),
            getScrollResponder: () => ({}),
            scrollTo: () => {},
            scrollToEnd: () => {},
        };
        const ctx = createMockContext(
            {},
            {
                refScroller: { current: scroller },
            },
        );

        expect(createImperativeHandle(ctx).getAnimatableRef()).toBe(nativeScrollRef);
    });

    it("falls back to the scroller as the animatable ref", () => {
        const scroller = {
            flashScrollIndicators: () => {},
            getScrollableNode: () => ({}),
            getScrollResponder: () => ({}),
            scrollTo: () => {},
            scrollToEnd: () => {},
        };
        const ctx = createMockContext(
            {},
            {
                refScroller: { current: scroller },
            },
        );

        expect(createImperativeHandle(ctx).getAnimatableRef()).toBe(scroller);
    });

    it("does not mark synthetic content inset reports as scroll progress", () => {
        const ctx = createMockContext(
            {},
            {
                hasScrolled: false,
                initialScroll: {
                    index: 2,
                },
                props: {
                    data: [1, 2, 3],
                },
                scroll: 120,
                scrollingTo: {
                    index: 2,
                    isInitialScroll: true,
                    offset: 120,
                },
            },
        );

        const handle = createImperativeHandle(ctx);
        handle.reportContentInset({ bottom: 20 });

        expect(ctx.state.contentInsetOverride).toEqual({ bottom: 20 });
        expect(ctx.state.hasScrolled).toBe(false);
    });

    it("retargets active bottom initial scrolls when synthetic content inset changes", () => {
        const retargetSpy = spyOn(initialScrollLifecycleModule, "retargetActiveInitialScrollAtEnd");
        retargetSpy.mockImplementation(() => true);
        const ctx = createMockContext(
            {},
            {
                didFinishInitialScroll: false,
                initialScroll: {
                    index: 2,
                    viewPosition: 1,
                },
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 3,
                },
                props: {
                    data: [1, 2, 3],
                },
            },
        );

        const handle = createImperativeHandle(ctx);
        handle.reportContentInset({ bottom: 20 });
        handle.reportContentInset({ bottom: 20 });

        expect(retargetSpy).toHaveBeenCalledTimes(1);
        expect(retargetSpy).toHaveBeenCalledWith(ctx);

        retargetSpy.mockRestore();
    });

    it("exposes positions and indices through accessors", () => {
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
        expect(state.indexByKey("b")).toBe(1);
        expect(state.indexByKey("missing")).toBeUndefined();
        expect(state.positionAtIndex(0)).toBe(10);
        expect(state.positionByKey("b")).toBe(40);
    });

    it("clearCaches clears size caches and recalculates positions", () => {
        const calls: string[] = [];
        const triggerCalculateItemsInView = mock(() => {
            calls.push("calculate");
        });
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
        const triggerFirstLayout = mock(() => {
            calls.push("layout:0");
        });
        const triggerSecondLayout = mock(() => {
            calls.push("layout:1");
        });
        ctx.containerLayoutTriggers.set(0, triggerFirstLayout);
        ctx.containerLayoutTriggers.set(1, triggerSecondLayout);

        const handle = createImperativeHandle(ctx);
        handle.clearCaches();

        expect(ctx.state.sizes.size).toBe(0);
        expect(ctx.state.sizesKnown.size).toBe(0);
        expect(Object.keys(ctx.state.averageSizes)).toEqual([]);
        expect(ctx.state.minIndexSizeChanged).toBe(0);
        expect(ctx.state.scrollForNextCalculateItemsInView).toBeUndefined();
        expect(ctx.state.totalSize).toBe(0);
        expect(ctx.state.pendingTotalSize).toBeUndefined();
        expect(ctx.values.get("totalSize")).toBe(0);
        expect(triggerFirstLayout).toHaveBeenCalledTimes(0);
        expect(triggerSecondLayout).toHaveBeenCalledTimes(0);
        expect(ctx.values.get("containerLayoutEpoch")).toBe(1);
        expect(calls).toEqual(["calculate"]);
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
    });

    it("clearCaches invalidates fixed sizes without discarding container types", () => {
        const item = { id: "a" };
        const getFixedItemSize = () => 40;
        const ctx = createMockContext(
            {},
            {
                props: {
                    data: [item],
                    getFixedItemSize,
                },
            },
        );
        const metadata = createContainerItemMetadata(ctx.state, 0, item, "row");
        metadata.didResolveFixedItemSize = true;
        metadata.fixedItemSize = 40;
        ctx.state.containerItemMetadata.set(0, metadata);

        createImperativeHandle(ctx).clearCaches();

        expect(ctx.state.containerItemMetadata.get(0)?.itemType).toBe("row");
        expect(ctx.state.containerItemMetadata.get(0)?.fixedItemSize).toBeUndefined();
    });

    it("setItemSize updates item measurement through the public ref", () => {
        const onItemSizeChanged = mock(() => {});
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                endBuffered: 1,
                indexByKey: new Map([["item_0", 0]]),
                props: {
                    data: [{ id: "a" }],
                    onItemSizeChanged,
                },
                sizes: new Map([["item_0", 40]]),
                sizesKnown: new Map([["item_0", 40]]),
                startBuffered: 0,
                totalSize: 40,
            },
        );

        const handle = createImperativeHandle(ctx);
        handle.setItemSize("item_0", { height: 72, width: 320 });

        expect(ctx.state.sizesKnown.get("item_0")).toBe(72);
        expect(ctx.state.totalSize).toBe(72);
        expect(ctx.values.get("totalSize")).toBe(72);
        expect(onItemSizeChanged).toHaveBeenCalledWith({
            index: 0,
            itemData: { id: "a" },
            itemKey: "item_0",
            previous: 40,
            size: 72,
        });
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

    it("supersedes unfinished initial scroll ownership before queuing scrollToEnd", async () => {
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        const canceledFrames: number[] = [];
        globalThis.cancelAnimationFrame = ((frame: number) => {
            canceledFrames.push(frame);
        }) as typeof cancelAnimationFrame;

        try {
            const scheduleCommit = mock(() => {});
            const ctx = createMockContext({}, {
                didFinishInitialScroll: false,
                initialScroll: {
                    index: 2,
                    viewPosition: 1,
                },
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: 42,
                        mountFrameCount: 1,
                        passCount: 1,
                        scroll: 100,
                        seedContentOffset: 0,
                    },
                    kind: "bootstrap",
                    previousDataLength: 3,
                },
                props: {
                    data: [1, 2, 3],
                },
                scrollingTo: {
                    index: 2,
                    isInitialScroll: true,
                    offset: 100,
                },
            } as any);
            const handle = createImperativeHandle(ctx, scheduleCommit);
            const promise = handle.scrollToEnd({ animated: true });

            expect(canceledFrames).toContain(42);
            expect(ctx.state.didFinishInitialScroll).toBe(true);
            expect(ctx.state.initialScroll).toBeUndefined();
            expect(ctx.state.initialScrollSession).toBeUndefined();
            expect(ctx.state.scrollingTo).toBeUndefined();
            expect(ctx.state.pendingScrollToEnd).toBeDefined();
            expect(scheduleCommit).toHaveBeenCalledTimes(1);

            cancelImperativeScroll(ctx.state);
            await promise;
        } finally {
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        }
    });

    it("does not let stale completion work resolve a superseding request", async () => {
        const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        const scheduledFrames: FrameRequestCallback[] = [];
        let nextFrameId = 0;

        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            scheduledFrames.push(callback);
            return nextFrameId++;
        }) as typeof requestAnimationFrame;
        globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
        scrollToIndexSpy.mockImplementation((nextCtx, params) => {
            nextCtx.state.scrollingTo = {
                animated: true,
                index: params.index,
                offset: params.index * 100,
            };
            nextCtx.state.scheduledWork.frame(() => finishScrollTo(nextCtx), "checkFinishedScrollFrame");
        });

        try {
            const ctx = createMockContext({}, { props: { data: [1, 2, 3] } } as any);
            const handle = createImperativeHandle(ctx);
            let firstResolveCount = 0;
            let secondResolveCount = 0;

            const firstPromise = handle.scrollToIndex({ animated: true, index: 1 }).then(() => {
                firstResolveCount++;
            });
            const staleCompletionFrame = scheduledFrames[0]!;
            const secondPromise = handle.scrollToIndex({ animated: true, index: 2 }).then(() => {
                secondResolveCount++;
            });

            await firstPromise;
            expect(firstResolveCount).toBe(1);
            expect(secondResolveCount).toBe(0);
            expect(ctx.state.scrollingTo?.index).toBe(2);

            staleCompletionFrame(0);
            await Promise.resolve();

            expect(secondResolveCount).toBe(0);
            expect(ctx.state.scrollingTo?.index).toBe(2);

            scheduledFrames[1]!(0);
            await secondPromise;

            expect(secondResolveCount).toBe(1);
            expect(ctx.state.scrollingTo).toBeUndefined();
        } finally {
            globalThis.requestAnimationFrame = originalRequestAnimationFrame;
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        }
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
        } as any);

        const handle = createImperativeHandle(ctx);
        const promise = handle.scrollToEnd({ animated: false });

        expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
        await promise;
    });

    it("does not delay imperative scrolls for an active mvcp anchor lock alone", async () => {
        const ctx = createMockContext({}, {
            mvcpAnchorLock: {
                expiresAt: Date.now() + 1000,
                id: "item_1",
                position: 120,
                quietPasses: 0,
            },
            props: {
                data: [1, 2, 3],
            },
        } as any);

        const handle = createImperativeHandle(ctx);
        const promise = handle.scrollToEnd({ animated: false });

        expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
        await promise;
    });

    it("does not wait for measurement when the target index starts in range", async () => {
        const ctx = createMockContext({}, {
            props: {
                data: [1, 2, 3],
            },
        } as any);

        const handle = createImperativeHandle(ctx);
        const promise = handle.scrollToIndex({ animated: false, index: 2 });

        expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
        expect(scrollToIndexSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                animated: false,
                index: 2,
            }),
        );
        await promise;
    });

    it("waits for anchored tail measurement when the target index starts in range", async () => {
        const { flushRaf, restore } = installRafMock();

        try {
            const ctx = createMockContext({}, {
                props: {
                    anchoredEndSpace: { anchorIndex: 2 },
                    data: [1, 2, 3, 4],
                },
            } as any);
            ctx.state.sizesKnown.set("item_2", 64);

            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToIndex({ animated: false, index: 3 });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.sizesKnown.set("item_3", 88);
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
            expect(scrollToIndexSpy).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    animated: false,
                    index: 3,
                }),
            );

            await promise;
        } finally {
            restore();
        }
    });

    it("waits for anchored tail measurement before scrolling to the end", async () => {
        const { flushRaf, restore } = installRafMock();

        try {
            const ctx = createMockContext({}, {
                props: {
                    anchoredEndSpace: { anchorIndex: 2 },
                    data: [1, 2, 3],
                },
            } as any);

            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToEnd({ animated: false });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.sizesKnown.set("item_2", 72);
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
            expect(scrollToIndexSpy).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    animated: false,
                    index: 2,
                    viewPosition: 1,
                }),
            );

            await promise;
        } finally {
            restore();
        }
    });

    it("waits for an out-of-range target index to become valid when the request starts during settling", async () => {
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
                props: {
                    data: [1, 2, 3],
                },
            } as any);

            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToIndex({ animated: false, index: 5 });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.didDataChange = false;
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.props.data = [1, 2, 3, 4, 5, 6];
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
            expect(scrollToIndexSpy).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    animated: false,
                    index: 5,
                }),
            );

            await promise;
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    it("waits for an out-of-range anchored target index to become valid and measured", async () => {
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
                didDataChange: false,
                props: {
                    data: [1, 2, 3],
                },
            } as any);

            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToIndex({ animated: false, index: 3 });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.didDataChange = true;
            ctx.state.props.data = [1, 2, 3, 4, 5];
            ctx.state.props.anchoredEndSpace = { anchorIndex: 3 };
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.didDataChange = false;
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.sizesKnown.set("item_3", 72);
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.sizesKnown.set("item_4", 88);
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
            expect(scrollToIndexSpy).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    animated: false,
                    index: 3,
                }),
            );

            await promise;
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    it("does not wait for tail measurement when anchored target is before the anchor", async () => {
        const { flushRaf, restore } = installRafMock();

        try {
            const ctx = createMockContext({}, {
                props: {
                    data: [1, 2, 3],
                },
            } as any);

            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToIndex({ animated: false, index: 3 });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.props.data = [1, 2, 3, 4, 5];
            ctx.state.props.anchoredEndSpace = { anchorIndex: 4 };
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
            expect(scrollToIndexSpy).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    animated: false,
                    index: 3,
                }),
            );

            await promise;
        } finally {
            restore();
        }
    });

    it("does not wait for tail measurement when anchoredEndSpace has an invalid anchor", async () => {
        const { flushRaf, restore } = installRafMock();

        try {
            const ctx = createMockContext({}, {
                props: {
                    data: [1, 2, 3],
                },
            } as any);

            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToIndex({ animated: false, index: 3 });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.props.data = [1, 2, 3, 4, 5];
            ctx.state.props.anchoredEndSpace = { anchorIndex: -1 };
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
            expect(scrollToIndexSpy).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    animated: false,
                    index: 3,
                }),
            );

            await promise;
        } finally {
            restore();
        }
    });

    it("does not wait for tail measurement when fixed item size is available", async () => {
        const { flushRaf, restore } = installRafMock();

        try {
            const ctx = createMockContext({}, {
                props: {
                    data: [1, 2, 3],
                    getFixedItemSize: () => 48,
                },
            } as any);

            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToIndex({ animated: false, index: 3 });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.props.data = [1, 2, 3, 4, 5];
            ctx.state.props.anchoredEndSpace = { anchorIndex: 3 };
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
            expect(scrollToIndexSpy).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    animated: false,
                    index: 3,
                }),
            );

            await promise;
        } finally {
            restore();
        }
    });

    it("runs a deferred anchored scroll after timeout when the tail never measures", async () => {
        const { flushRaf, restore } = installRafMock();
        const originalDateNow = Date.now;
        let now = 0;

        Date.now = () => now;

        try {
            const ctx = createMockContext({}, {
                props: {
                    data: [1, 2, 3],
                },
            } as any);

            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToIndex({ animated: false, index: 3 });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            ctx.state.props.data = [1, 2, 3, 4, 5];
            ctx.state.props.anchoredEndSpace = { anchorIndex: 3 };
            now = 100;
            flushRaf();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            now = 801;
            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
            expect(scrollToIndexSpy).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    animated: false,
                    index: 3,
                }),
            );

            await promise;
        } finally {
            Date.now = originalDateNow;
            restore();
        }
    });

    it("does not run a deferred out-of-range scroll after a later imperative scroll supersedes it", async () => {
        const { flushRaf, restore } = installRafMock();

        try {
            const ctx = createMockContext({}, {
                props: {
                    data: [1, 2, 3],
                },
            } as any);

            const handle = createImperativeHandle(ctx);
            const firstPromise = handle.scrollToIndex({ animated: false, index: 3 });

            expect(scrollToIndexSpy).not.toHaveBeenCalled();

            const secondPromise = handle.scrollToIndex({ animated: false, index: 1 });

            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
            expect(scrollToIndexSpy).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    animated: false,
                    index: 1,
                }),
            );

            ctx.state.props.data = [1, 2, 3, 4, 5];
            ctx.state.sizesKnown.set("item_4", 88);
            flushRaf();
            flushRaf();
            expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);

            await firstPromise;
            await secondPromise;
        } finally {
            restore();
        }
    });

    it("cancels readiness polling and settles its promise during disposal", async () => {
        const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        const callbacks = new Map<number, FrameRequestCallback>();
        const cancelCalls: number[] = [];
        let lateCallback: FrameRequestCallback | undefined;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            lateCallback = callback;
            callbacks.set(0, callback);
            return 0;
        }) as typeof requestAnimationFrame;
        globalThis.cancelAnimationFrame = ((id: number) => {
            cancelCalls.push(id);
            callbacks.delete(id);
        }) as typeof cancelAnimationFrame;

        try {
            const ctx = createMockContext({}, { didDataChange: true, props: { data: [1, 2, 3] } } as any);
            const handle = createImperativeHandle(ctx);
            const promise = handle.scrollToIndex({ animated: false, index: 2 });
            let resolved = false;
            void promise.then(() => {
                resolved = true;
            });

            cancelImperativeScroll(ctx.state);
            lateCallback?.(0);
            await Promise.resolve();

            expect(cancelCalls).toEqual([0]);
            expect(callbacks.size).toBe(0);
            expect(resolved).toBe(true);
            expect(scrollToIndexSpy).not.toHaveBeenCalled();
        } finally {
            globalThis.requestAnimationFrame = originalRequestAnimationFrame;
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        }
    });

    it("settles a scrollToEnd promise that is pending a layout commit during disposal", async () => {
        const scheduleCommit = mock(() => {});
        const ctx = createMockContext({}, { props: { data: [1, 2, 3] } } as any);
        const handle = createImperativeHandle(ctx, scheduleCommit);
        const promise = handle.scrollToEnd({ animated: false });
        let resolveCount = 0;
        void promise.then(() => {
            resolveCount++;
        });

        expect(scheduleCommit).toHaveBeenCalledTimes(1);
        expect(ctx.state.pendingScrollToEnd).toBeDefined();

        cancelImperativeScroll(ctx.state);
        cancelImperativeScroll(ctx.state);
        await promise;

        expect(resolveCount).toBe(1);
        expect(ctx.state.pendingScrollToEnd).toBeUndefined();
        expect(ctx.state.pendingScrollResolve).toBeUndefined();
        expect(scrollToIndexSpy).not.toHaveBeenCalled();
    });

    it("keeps the deferred scroll runner installed when cleanup replays on a live state", async () => {
        const ctx = createMockContext({}, { props: { data: [1, 2, 3] } } as any);
        const handle = createImperativeHandle(ctx);
        const runner = ctx.state.runPendingScrollToEnd;

        cancelImperativeScroll(ctx.state);
        const promise = handle.scrollToEnd({ animated: true });

        expect(ctx.state.runPendingScrollToEnd).toBe(runner);
        expect(scrollToIndexSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                animated: true,
                index: 2,
                viewPosition: 1,
            }),
        );
        await promise;
    });

    it("settles an active scrollToOffset promise during cancellation", async () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                didFinishInitialScroll: true,
                refScroller: {
                    current: {
                        getScrollableNode: () => ({}),
                        scrollTo: mock(() => {}),
                    },
                } as any,
                scrollLength: 200,
            },
        );
        const handle = createImperativeHandle(ctx);
        const promise = handle.scrollToOffset({ animated: false, offset: 300 });
        let resolveCount = 0;
        void promise.then(() => {
            resolveCount++;
        });

        expect(ctx.state.scrollingTo).toBeDefined();

        cancelImperativeScroll(ctx.state);
        await promise;

        expect(resolveCount).toBe(1);
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.pendingScrollResolve).toBeUndefined();
    });
});
