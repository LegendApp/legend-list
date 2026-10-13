import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { checkResetContainers } from "../../src/core/checkResetContainers";
import * as follow from "../../src/core/doMaintainScrollAtEnd";
import { finishInitialScroll } from "../../src/core/finishInitialScroll";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import { handleInitialScrollDataChange } from "../../src/core/initialScrollLifecycle";
import { resetLayoutCachesForDataChange } from "../../src/core/resetLayoutCachesForDataChange";
import { getScrollRequestTracker } from "../../src/core/scrollRequestTracker";
import * as scrollModule from "../../src/core/scrollTo";
import { scrollToEnd } from "../../src/core/scrollToEnd";
import { setFooterSize, setHeaderSize } from "../../src/core/updateContentMetrics";
import { updateItemPositions } from "../../src/core/updateItemPositions";
import { updateItemSizes } from "../../src/core/updateItemSizes";
import { updateScroll } from "../../src/core/updateScroll";
import { Platform } from "../../src/platform/Platform";
import { checkAtBottom } from "../../src/utils/checkAtBottom";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";

const originalRAF = globalThis.requestAnimationFrame;
const originalCancelRAF = globalThis.cancelAnimationFrame;
const originalPlatform = Platform.OS;
afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCancelRAF;
    Platform.OS = originalPlatform;
    mock.restore();
});

describe("end follow intent", () => {
    it("keeps settled follow intent when a later measurement moves the end outside the threshold", async () => {
        let frame: FrameRequestCallback | undefined;
        globalThis.requestAnimationFrame = (cb) => {
            frame = cb;
            return 1;
        };
        const ctx = createMockContext(
            { isWithinMaintainScrollAtEndThreshold: true, totalSize: 1000 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                props: { data: ["row"], maintainScrollAtEnd: true },
                queuedInitialLayout: true,
                scroll: 800,
                scrollLength: 200,
            },
        );
        ctx.scrollToEnd = mock(() => true);
        follow.doMaintainScrollAtEnd(ctx);
        frame?.(0);
        await Promise.resolve();
        ctx.values.set("totalSize", 5000);
        checkAtBottom(ctx);
        expect(follow.doMaintainScrollAtEnd(ctx)).toBe(true);
        expect(createImperativeHandle(ctx).getState().isFollowingEnd).toBe(true);
    });

    it("follows ordinary composer inset grow and shrink without rearming an interrupted reader", () => {
        const ctx = createMockContext(
            { isFollowingEnd: true, isWithinMaintainScrollAtEndThreshold: true },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                props: { data: ["row"], maintainScrollAtEnd: true },
                queuedInitialLayout: true,
                scroll: 800,
                scrollLength: 200,
                totalSize: 1000,
            },
        );
        const maintain = spyOn(follow, "doMaintainScrollAtEnd").mockReturnValue(true);
        const handle = createImperativeHandle(ctx);
        handle.reportContentInset({ bottom: 180 });
        handle.reportContentInset({ bottom: 0 });
        expect(maintain).toHaveBeenCalledTimes(2);
        follow.interruptMaintainScrollAtEnd(ctx);
        handle.reportContentInset({ bottom: 200 });
        expect(handle.getState().isFollowingEnd).toBe(false);
    });

    it("follows every measured animation step, including changes smaller than five pixels", () => {
        const ctx = createMockContext(
            { isWithinMaintainScrollAtEndThreshold: true },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                indexByKey: new Map([["row", 0]]),
                positions: [0],
                props: { data: ["row"], maintainScrollAtEnd: true },
                sizes: new Map([["row", 100]]),
                sizesKnown: new Map([["row", 100]]),
                totalSize: 100,
            },
        );
        const maintain = spyOn(follow, "doMaintainScrollAtEnd").mockReturnValue(true);
        updateItemSizes(ctx, { itemKey: "row", size: { height: 102, width: 200 } });
        expect(maintain).toHaveBeenCalledTimes(1);
    });

    it("cancels queued targets immediately and synchronizes the actual observed offset", async () => {
        const scrollTo = mock(() => {});
        const ctx = createMockContext(
            {},
            {
                didDataChange: true,
                props: { data: ["row"] },
                refScroller: {
                    current: { getCurrentScrollOffset: () => 73, getScrollableNode: () => null, scrollTo },
                } as any,
                scroll: 900,
            },
        );
        const handle = createImperativeHandle(ctx);
        const promise = handle.scrollToIndex({ animated: true, index: 0 });
        const token = ctx.state.pendingScrollToEnd?.token;
        handle.cancelScroll();
        await promise;
        expect(ctx.state.scheduledWork.has("imperativeScrollReady")).toBe(false);
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.pendingScrollResolve).toBeUndefined();
        expect(handle.getState().scroll).toBe(73);
        expect(scrollTo).not.toHaveBeenCalled();
        if (token !== undefined) expect(ctx.scrollRequestTracker?.isCurrent(token)).toBe(false);
    });
});

describe("canonical scroll geometry", () => {
    it("captures the observed keyed reading position while the rendered range is stale", () => {
        const ctx = createMockContext(
            { headerSize: 20, stylePaddingTop: 10 },
            {
                didFinishInitialScroll: true,
                positions: [0, 100, 200],
                props: { data: ["a", "b", "c"], keyExtractor: (item) => item },
                refScroller: { current: { getCurrentScrollOffset: () => 250 } } as any,
                scroll: 0,
                startNoBuffer: 0,
            },
        );
        expect(createImperativeHandle(ctx).getScrollAnchor()).toEqual({ key: "c", offset: 20 });
    });

    for (const hasSynchronousGetter of [true, false]) {
        it(`reports observed end distance even when a managed target optimistically reaches the end (getter: ${hasSynchronousGetter})`, () => {
            const metrics = mock(() => {});
            const ctx = createMockContext(
                { totalSize: 1000 },
                {
                    lastNativeScroll: 100,
                    props: { data: ["row"], onMetricsChange: metrics },
                    queuedInitialLayout: true,
                    refScroller: {
                        current: hasSynchronousGetter ? { getCurrentScrollOffset: () => 300 } : null,
                    } as any,
                    scroll: 800,
                    scrollLength: 200,
                },
            );
            const expectedDistance = hasSynchronousGetter ? 500 : 700;
            updateScroll(ctx, 800, true, { markHasScrolled: false });
            expect(createImperativeHandle(ctx).getState().distanceFromEnd).toBe(expectedDistance);
            expect(metrics).toHaveBeenLastCalledWith(expect.objectContaining({ distanceFromEnd: expectedDistance }));
        });
    }

    it("updates metrics after an observed scroll and independently reports physical and useful end", () => {
        const metrics = mock(() => {});
        const ctx = createMockContext(
            { totalSize: 500 },
            {
                props: {
                    contentInset: { bottom: 100, left: 0, right: 0, top: 0 },
                    data: ["a"],
                    onMetricsChange: metrics,
                },
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 200,
            },
        );
        updateScroll(ctx, 300, true);
        expect(metrics).toHaveBeenLastCalledWith(
            expect.objectContaining({ contentLength: 600, distanceFromEnd: 100, isAtEnd: true, scroll: 300 }),
        );
    });

    it("follows strict keyed appends without following a replacement", () => {
        const ctx = createMockContext(
            { isWithinMaintainScrollAtEndThreshold: true },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                indexByKey: new Map([
                    ["a", 0],
                    ["b", 1],
                ]),
                previousData: ["a"],
                props: {
                    data: ["a", "b"],
                    keyExtractor: (item) => item,
                    maintainScrollAtEnd: { on: { dataChange: "append" } },
                },
            },
        );
        const maintain = spyOn(follow, "doMaintainScrollAtEnd").mockReturnValue(true);
        checkResetContainers(ctx, ctx.state.props.data);
        expect(maintain).toHaveBeenCalledTimes(1);
        ctx.state.previousData = ["x"];
        checkResetContainers(ctx, ctx.state.props.data);
        expect(maintain).toHaveBeenCalledTimes(1);
    });

    it("recognizes appends with the default index keys", () => {
        const ctx = createMockContext(
            { isFollowingEnd: true },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                previousData: ["a"],
                props: {
                    data: ["a", "b"],
                    keyExtractor: undefined,
                    maintainScrollAtEnd: { on: { dataChange: "append", itemLayout: false } },
                },
            },
        );
        checkResetContainers(ctx, ctx.state.props.data);
        expect(ctx.state.pendingEndMeasurements).toEqual(new Set([1]));
    });

    it("retains overlapping appends until their late measurements finish with item-layout following off", () => {
        const ctx = createMockContext(
            { isFollowingEnd: true },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                positions: [0, 100],
                previousData: ["a"],
                props: {
                    data: ["a", "b"],
                    keyExtractor: (item) => item,
                    maintainScrollAtEnd: { on: { dataChange: "append", itemLayout: false } },
                },
                sizesKnown: new Map([["a", 100]]),
            },
        );
        checkResetContainers(ctx, ctx.state.props.data);
        ctx.state.previousData = ["a", "b"];
        ctx.state.props.data = ["a", "b", "c"];
        checkResetContainers(ctx, ctx.state.props.data);
        expect(ctx.state.pendingEndMeasurements).toEqual(new Set(["b", "c"]));
        follow.finishMaintainScrollAtEnd(ctx);
        updateItemSizes(ctx, { itemKey: "b", size: { height: 4000, width: 200 } });
        expect(ctx.state.pendingEndMeasurements).toEqual(new Set(["c"]));
        expect(ctx.state.maintainingScrollAtEnd).toBe("pending-instant");
    });
});

describe("measured DOM navigation", () => {
    it("aligns an already visible citation at the requested viewport position", async () => {
        const node = { getBoundingClientRect: () => ({ bottom: 500, top: 100 }) };
        const element = { getBoundingClientRect: () => ({ bottom: 220, height: 20, top: 200 }), isConnected: true };
        const ctx = createMockContext(
            {},
            {
                props: { data: ["row"] },
                refScroller: { current: { getScrollableNode: () => node } } as any,
                scroll: 100,
            },
        );
        const scroll = spyOn(scrollModule, "scrollTo").mockImplementation(() => {});
        await createImperativeHandle(ctx).scrollElementIntoView({
            element: element as any,
            viewPosition: 0,
            viewportMargin: { top: 40 },
        });
        expect(scroll).toHaveBeenCalledWith(ctx, { animated: false, offset: 160 });
    });
});

describe("scroll ownership boundaries", () => {
    it("stops an active animation but avoids writing idle or native drag offsets", () => {
        const scrollTo = mock(() => {});
        const ctx = createMockContext(
            {},
            {
                refScroller: { current: { getCurrentScrollOffset: () => 73, scrollTo } } as any,
                scroll: 900,
                scrollingTo: { animated: true, offset: 900 },
            },
        );
        createImperativeHandle(ctx).cancelScroll();
        expect(scrollTo).toHaveBeenCalledWith({ animated: false, x: 0, y: 73 });
    });

    it("does not turn bottom alignment of a middle initial row into end intent", () => {
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                initialScroll: { index: 5, viewPosition: 1 },
                props: { data: Array.from({ length: 100 }, (_, i) => i), maintainScrollAtEnd: true },
            },
        );
        finishInitialScroll(ctx);
        expect(createImperativeHandle(ctx).getState().isFollowingEnd).toBe(false);
    });

    it("reports header, footer and out-of-range row size changes without scrolling", () => {
        const metrics = mock(() => {});
        const ctx = createMockContext(
            { totalSize: 100 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                endBuffered: 2,
                indexByKey: new Map([["a", 0]]),
                positions: [0],
                props: { data: ["a"], keyExtractor: (item) => item, onMetricsChange: metrics },
                queuedInitialLayout: true,
                scrollLength: 200,
                sizes: new Map([["a", 100]]),
                sizesKnown: new Map([["a", 100]]),
                startBuffered: 2,
            },
        );
        setHeaderSize(ctx, 20);
        expect(metrics).toHaveBeenLastCalledWith(expect.objectContaining({ contentLength: 120, headerSize: 20 }));
        setFooterSize(ctx, 30);
        expect(metrics).toHaveBeenLastCalledWith(expect.objectContaining({ contentLength: 150, footerSize: 30 }));
        updateItemSizes(ctx, { itemKey: "a", size: { height: 170, width: 200 } });
        expect(metrics).toHaveBeenLastCalledWith(expect.objectContaining({ contentLength: 220 }));
    });

    it("keeps following across an observed browser shrink clamp and interrupts real navigation below that clamp", () => {
        Platform.OS = "web";
        const ctx = createMockContext(
            { isFollowingEnd: true, totalSize: 800 },
            {
                props: { data: ["a"], maintainScrollAtEnd: true },
                queuedInitialLayout: true,
                refScroller: { current: { getMaxScrollOffset: () => 600 } } as any,
                scroll: 800,
                scrollLength: 200,
            },
        );
        updateScroll(ctx, 600, true, { fromNativeScrollEvent: true });
        expect(createImperativeHandle(ctx).getState().isFollowingEnd).toBe(true);
        updateScroll(ctx, 550, true, { fromNativeScrollEvent: true });
        expect(createImperativeHandle(ctx).getState().isFollowingEnd).toBe(false);
    });

    it("releases the measured DOM target when its owned request settles", async () => {
        const node = { getBoundingClientRect: () => ({ bottom: 200, top: 0 }) };
        const element = { getBoundingClientRect: () => ({ bottom: 320, height: 20, top: 300 }), isConnected: true };
        const ctx = createMockContext(
            {},
            {
                props: { data: ["a"] },
                refScroller: { current: { getCurrentScrollOffset: () => 40, getScrollableNode: () => node } } as any,
                scroll: 0,
            },
        );
        const scroll = spyOn(scrollModule, "scrollTo").mockImplementation((targetCtx, params) => {
            targetCtx.state.scrollingTo = { offset: params.offset };
        });
        const request = createImperativeHandle(ctx).scrollElementIntoView({ element: element as any });
        expect(scroll).toHaveBeenCalledWith(ctx, { animated: false, offset: 160 });
        expect(ctx.state.scrollElementTarget).toBeDefined();
        finishScrollTo(ctx);
        await request;
        expect(ctx.state.scrollElementTarget).toBeUndefined();
    });
});

describe("reading snapshots during dataset placement", () => {
    it("does not save an estimated bootstrap anchor or a not-yet-reset replacement", () => {
        const ctx = createMockContext(
            {},
            { didFinishInitialScroll: false, initialScroll: { index: 90 }, positions: [0], props: { data: ["row"] } },
        );
        const handle = createImperativeHandle(ctx);
        expect(handle.getScrollAnchor()).toBeUndefined();
        ctx.state.didFinishInitialScroll = true;
        ctx.state.freshDataTransitionEpoch = 1;
        ctx.state.handledFreshDataTransitionEpoch = 0;
        expect(handle.getState().dataEpoch).toBe(1);
        expect(handle.getScrollAnchor()).toBeUndefined();
        ctx.state.handledFreshDataTransitionEpoch = 1;
        expect(handle.getScrollAnchor()).toEqual({ key: "item_0", offset: 0 });
    });
});

describe("keyed navigation through layout changes", () => {
    function setupQueuedKeyTarget() {
        Platform.OS = "web";
        const frames: FrameRequestCallback[] = [];
        globalThis.requestAnimationFrame = (callback) => {
            frames.push(callback);
            return frames.length;
        };
        globalThis.cancelAnimationFrame = () => {};
        let observed = 0;
        const scrollTo = mock(({ y }: { y: number }) => {
            observed = y;
        });
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                didDataChange: true,
                didFinishInitialScroll: true,
                freshDataTransitionEpoch: 0,
                props: {
                    data: ["a", "target", "c"],
                    dataKey: "first",
                    getFixedItemSize: () => 100,
                    keyExtractor: (item) => item,
                },
                refScroller: {
                    current: {
                        getCurrentScrollOffset: () => observed,
                        getScrollableNode: () => ({}),
                        scrollTo,
                    },
                } as any,
                scrollLength: 100,
            },
        );
        updateItemPositions(ctx, true);
        const promise = createImperativeHandle(ctx).scrollToKey({
            animated: false,
            key: "target",
            viewOffset: 32,
            viewPosition: 0,
        });
        return { ctx, frames, promise, scrollTo };
    }

    it("lands a queued key target at its new position after a prepend", async () => {
        const { ctx, frames, promise, scrollTo } = setupQueuedKeyTarget();
        try {
            expect(scrollTo).not.toHaveBeenCalled();
            ctx.state.props.data = ["p", "q", "a", "target", "c"];
            resetLayoutCachesForDataChange(ctx.state);
            updateItemPositions(ctx, true);
            ctx.state.didDataChange = false;
            frames.shift()?.(0);
            frames.shift()?.(16);
            expect(ctx.state.scrollingTo).toMatchObject({ index: 3, key: "target", targetOffset: 268 });
            expect(scrollTo).toHaveBeenLastCalledWith({ animated: false, x: 0, y: 268 });
            finishScrollTo(ctx);
            await promise;
            expect(createImperativeHandle(ctx).getState().scroll).toBe(268);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("settles an old dataset's queued key request without dispatching it into replacement data", async () => {
        const { ctx, frames, promise, scrollTo } = setupQueuedKeyTarget();
        try {
            ctx.state.props.dataKey = "second";
            ctx.state.freshDataTransitionEpoch++;
            handleInitialScrollDataChange(ctx, {
                dataLength: ctx.state.props.data.length,
                didDataChange: true,
                didStartFreshData: true,
                initialScrollAtEnd: false,
                latestInitialScroll: undefined,
                latestInitialScrollSessionKind: "bootstrap",
                stylePaddingEnd: 0,
                useBootstrapInitialScroll: false,
            });
            await promise;
            expect(ctx.state.pendingScrollResolve).toBeUndefined();
            expect(ctx.state.scheduledWork.has("imperativeScrollReady")).toBe(false);
            frames.shift()?.(0);
            expect(scrollTo).not.toHaveBeenCalled();
            expect(ctx.state.scrollingTo).toBeUndefined();
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });
});

describe("end maintenance request ownership", () => {
    function setupMeasuredEnd() {
        Platform.OS = "web";
        const frames: FrameRequestCallback[] = [];
        globalThis.requestAnimationFrame = (callback) => {
            frames.push(callback);
            return frames.length;
        };
        globalThis.cancelAnimationFrame = () => {};
        let observed = 200;
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                initialScroll: { index: 2, preserveForBottomPadding: true, viewPosition: 1 },
                props: {
                    data: ["a", "b", "tail"],
                    estimatedItemSize: 100,
                    keyExtractor: (item) => item,
                    maintainScrollAtEnd: true,
                },
                queuedInitialLayout: true,
                refScroller: {
                    current: {
                        getCurrentScrollOffset: () => observed,
                        getScrollableNode: () => ({}),
                        scrollTo: ({ y }: { y: number }) => {
                            observed = y;
                        },
                    },
                } as any,
                scroll: 200,
                scrollLength: 100,
                sizes: new Map([
                    ["a", 100],
                    ["b", 100],
                    ["tail", 100],
                ]),
                sizesKnown: new Map([
                    ["a", 100],
                    ["b", 100],
                    ["tail", 100],
                ]),
                totalSize: 300,
            },
        );
        updateItemPositions(ctx, true);
        ctx.scrollToEnd = (options) => scrollToEnd(ctx, options);
        ctx.state.triggerCalculateItemsInView = () => updateItemPositions(ctx, false);
        finishInitialScroll(ctx, { preserveTarget: true });
        return { ctx, frames, observed: () => observed };
    }

    it("replays measured-size intent after an end request completes with a preserved initial target", async () => {
        const { ctx, frames, observed } = setupMeasuredEnd();
        const data = ctx.state.props.data;
        try {
            const earlierRequest = getScrollRequestTracker(ctx).runNowIfIdle(() =>
                scrollToEnd(ctx, { animated: false }),
            );
            updateItemSizes(ctx, { itemKey: "tail", size: { height: 104, width: 200 } });
            expect(ctx.state.pendingMaintainScrollAtEnd).toBe(true);
            finishScrollTo(ctx);
            await earlierRequest;
            for (let count = 0; frames.length && count < 10; count++) frames.shift()?.(count * 16);
            expect(observed()).toBe(204);
            finishScrollTo(ctx);
            await Promise.resolve();
            updateItemSizes(ctx, { itemKey: "tail", size: { height: 4104, width: 200 } });
            for (let count = 0; frames.length && count < 10; count++) frames.shift()?.(count * 16);
            expect(ctx.state.props.data).toBe(data);
            expect(observed()).toBe(4204);
            expect(createImperativeHandle(ctx).getState().distanceFromEnd).toBe(0);
            finishScrollTo(ctx);
            await Promise.resolve();
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("relinquishes a queued maintenance frame when another end request owns its dispatch", async () => {
        const { ctx, frames, observed } = setupMeasuredEnd();
        try {
            ctx.state.initialScroll = undefined;
            updateItemSizes(ctx, { itemKey: "tail", size: { height: 104, width: 200 } });
            expect(ctx.state.maintainingScrollAtEnd).toBe("pending-instant");
            const earlierRequest = getScrollRequestTracker(ctx).runNowIfIdle(() =>
                scrollToEnd(ctx, { animated: false }),
            );
            for (let count = 0; frames.length && count < 10; count++) frames.shift()?.(count * 16);
            expect(ctx.state.pendingMaintainScrollAtEnd).toBe(true);
            expect(ctx.state.maintainingScrollAtEnd).toBeUndefined();
            finishScrollTo(ctx);
            await earlierRequest;
            for (let count = 0; frames.length && count < 10; count++) frames.shift()?.(count * 16);
            expect(observed()).toBe(204);
            finishScrollTo(ctx);
            await Promise.resolve();
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });
});
