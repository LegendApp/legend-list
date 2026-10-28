import { afterEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { checkFinishedScroll, getCurrentTargetOffset } from "../../src/core/checkFinishedScroll";
import { reissueClampedNativeEndScroll } from "../../src/core/doMaintainScrollAtEnd";
import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { handleLayout } from "../../src/core/handleLayout";
import { onScroll } from "../../src/core/onScroll";
import { getScrollRequestTracker } from "../../src/core/scrollRequestTracker";
import { scrollToEnd } from "../../src/core/scrollToEnd";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import { getContentSize } from "../../src/state/getContentSize";
import type { StateContext } from "../../src/state/state";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { normalizeMaintainScrollAtEnd } from "../../src/utils/normalizeMaintainScrollAtEnd";
import { createMockContext } from "../__mocks__/createMockContext";
import { installFakeClock } from "../helpers/webScrollHarness";

const originalPlatform = Platform.OS;
const cleanups: (() => void)[] = [];
afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    Platform.OS = originalPlatform;
});

describe.each(["ios", "android"] as const)("end following across a viewport resize (%s)", (platform) => {
    it.each([
        [600, 500, 70, 1],
        [400, 500, 70, 1],
        [344, 250, 130, 1],
        [400, 250, 130, 1],
        // Native can mount the new content several frames late.
        [600, 500, 70, 4],
        [400, 250, 130, 4],
    ])("height %d width %d item %d mounted after %d frames", async (height, width, itemHeight, mountFrames) => {
        Platform.OS = platform;
        const clock = installFakeClock();
        const now = spyOn(Date, "now").mockImplementation(() => clock.now);
        const dispatch = spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
        const data = Array.from({ length: 20 }, (_, index) => ({ id: String(index) }));
        const ctx: StateContext = createMockContext(
            {
                isWithinMaintainScrollAtEndThreshold: true,
                numColumns: 1,
                numContainers: 20,
                numContainersPooled: 20,
                readyToRender: true,
                totalSize: 2000,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                hasScrolled: true,
                idCache: data.map((item) => item.id),
                indexByKey: new Map(data.map((item, index) => [item.id, index])),
                initialScrollSession: undefined,
                lastLayout: { height: 400, width: 300, x: 0, y: 0 },
                otherAxisSize: 300,
                positions: data.map((_, index) => index * 100),
                props: {
                    data,
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                    maintainScrollAtEnd: normalizeMaintainScrollAtEnd(true),
                    maintainVisibleContentPosition: { data: true, size: true },
                },
                scrollLength: 400,
                sizes: new Map(data.map((item) => [item.id, 100])),
                sizesKnown: new Map(data.map((item) => [item.id, 100])),
            },
        );
        cleanups.push(() => {
            ctx.state.scheduledWork.dispose();
            dispatch.mockRestore();
            now.mockRestore();
            clock.restore();
        });
        const { state } = ctx;
        state.triggerCalculateItemsInView = (params) => calculateItemsInView(ctx, params);
        let observed = 1600;
        let nativeContent = 2000;
        let nativeLength = 400;
        state.scroll = state.lastNativeScroll = observed;
        const emitScroll = () =>
            onScroll(ctx, {
                nativeEvent: {
                    contentOffset: { x: 0, y: observed },
                    contentSize: { height: nativeContent, width },
                    layoutMeasurement: { height: nativeLength, width },
                },
            } as never);
        state.refScroller.current = {
            scrollTo: ({ y }: { y: number }) => {
                const next = Math.max(0, Math.min(y, nativeContent - nativeLength));
                if (next !== observed) {
                    observed = next;
                    requestAnimationFrame(emitScroll);
                }
            },
        } as never;
        ctx.scrollToEnd = (options) => scrollToEnd(ctx, options);
        calculateItemsInView(ctx);

        const offEnd = () => Math.abs(observed - Math.max(0, getContentSize(ctx) - state.scrollLength));
        // A UI frame: JS frame callbacks and timers run, then the UI thread mounts the commit
        // mountFrames frames after it changed and reports the new content size.
        let framesUnmounted = 0;
        const tick = async () => {
            clock.tick(16);
            for (let i = 0; i < 5; i++) await Promise.resolve();
            nativeLength = state.scrollLength;
            if (getContentSize(ctx) !== nativeContent && ++framesUnmounted >= mountFrames) {
                framesUnmounted = 0;
                nativeContent = getContentSize(ctx);
                reissueClampedNativeEndScroll(ctx);
            }
        };

        handleLayout(ctx, { height, width, x: 0, y: 0 }, () => {});
        nativeLength = height;
        await tick();
        await tick();
        expect(offEnd()).toBeLessThanOrEqual(1);
        // Rows reflow at the new width; the tail re-measures over the next frames.
        for (const first of [15, 10]) {
            updateItemSizesBatch(
                ctx,
                data.slice(first, first + 5).map((item) => ({ itemKey: item.id, size: { height: itemHeight, width } })),
            );
            // Follow the content once native mounts it, without waiting for the 100 ms fallback.
            for (let i = 0; i <= mountFrames; i++) await tick();
            expect(offEnd()).toBeLessThanOrEqual(1);
        }
    });
});

describe.each(["ios", "android"] as const)("native end content shrink (%s)", (platform) => {
    it.each([1740, undefined])(
        "keeps a shrinking native end without losing an unobserved target (%s)",
        (lastNativeScroll) => {
            Platform.OS = platform;
            const data = Array.from({ length: 20 }, (_, index) => ({ id: String(index) }));
            const ctx = createMockContext(
                { headerSize: 100, totalSize: 2000 },
                {
                    idCache: data.map((item) => item.id),
                    indexByKey: new Map(data.map((item, index) => [item.id, index])),
                    lastNativeScroll,
                    positions: data.map((_, index) => index * 100),
                    props: { data, estimatedItemSize: 100, keyExtractor: (item: { id: string }) => item.id },
                    scroll: 1740,
                    scrollingTo: {
                        animated: false,
                        clampToContentContainerMinSize: true,
                        index: 19,
                        isScrollToEnd: true,
                        offset: 1938,
                        targetOffset: 1740,
                        viewPosition: 1,
                    },
                    scrollLength: 400,
                    sizes: new Map(data.map((item) => [item.id, 100])),
                },
            );
            cleanups.push(() => ctx.state.scheduledWork.dispose());
            // Header margins add 16 native points beyond the modeled content. Native layout
            // clamps the old 1740 offset to 1716 when the rows shrink by 40 points.
            const nativeEnd = 1716;
            // Before the first native event, JS scroll is optimistic and the target still needs dispatch.
            let observed = lastNativeScroll === undefined ? 0 : lastNativeScroll;
            ctx.state.refScroller.current = {
                scrollTo: ({ y }: { y: number }) => {
                    observed = Math.min(y, nativeEnd);
                },
            } as never;

            reissueClampedNativeEndScroll(ctx);
            observed = Math.min(observed, nativeEnd);

            expect(observed).toBe(lastNativeScroll === undefined ? 1700 : nativeEnd);
        },
    );
});

describe.each(["ios", "android"] as const)("first estimated end landing (%s)", (platform) => {
    it("keeps an optimistic end request until native catches up with measurements", async () => {
        Platform.OS = platform;
        const clock = installFakeClock();
        const dispatch = spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
        const data = Array.from({ length: 20 }, (_, index) => ({ id: String(index) }));
        const ctx = createMockContext(
            { numColumns: 1, totalSize: 2100 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                idCache: data.map((item) => item.id),
                indexByKey: new Map(data.map((item, index) => [item.id, index])),
                lastLayout: { height: 400, width: 300, x: 0, y: 0 },
                lastNativeScroll: 100,
                positions: data.map((_, index) => index * 100),
                props: { data, estimatedItemSize: 100, keyExtractor: (item: { id: string }) => item.id },
                scroll: 100,
                scrollLength: 400,
                sizes: new Map(data.map((item, index) => [item.id, index === 19 ? 200 : 100])),
                sizesKnown: new Map(data.map((item, index) => [item.id, index === 19 ? 200 : 100])),
            },
        );
        cleanups.push(() => {
            ctx.state.scheduledWork.dispose();
            dispatch.mockRestore();
            clock.restore();
        });
        const commands: number[] = [];
        let observed = 100;
        const emitScroll = () =>
            onScroll(ctx, {
                nativeEvent: {
                    contentOffset: { x: 0, y: observed },
                    contentSize: { height: getContentSize(ctx), width: 300 },
                    layoutMeasurement: { height: 400, width: 300 },
                },
            } as never);
        ctx.state.refScroller.current = {
            scrollTo: ({ y }: { y: number }) => {
                commands.push(y);
                if (commands.length > 1) {
                    observed = y;
                    requestAnimationFrame(emitScroll);
                }
            },
        } as never;
        let resolved = false;
        void createImperativeHandle(ctx)
            .scrollToEnd({ animated: false })
            .then(() => {
                resolved = true;
            });
        expect(commands).toEqual([1700]);
        // JS has predicted the end, but the native command has not landed yet.
        checkFinishedScroll(ctx);
        clock.tick();
        await Promise.resolve();
        expect(resolved).toBe(false);
        expect(ctx.state.scrollingTo?.isScrollToEnd).toBe(true);

        // A late measurement moves the end before native reports its first landing.
        updateItemSizesBatch(ctx, [{ itemKey: "19", size: { height: 100, width: 300 } }]);
        expect(getCurrentTargetOffset(ctx, ctx.state.scrollingTo!)).toBe(1600);
        observed = 1623;
        emitScroll();
        for (let i = 0; i < 40; i++) {
            clock.tick();
            await Promise.resolve();
        }
        expect(commands.at(-1)).toBe(1600);
        expect(observed).toBe(1600);
        expect(resolved).toBe(true);
        expect(ctx.state.scrollingTo).toBeUndefined();
    });

    it.each([
        [false, 70],
        [false, 130],
        [true, 70],
        [true, 130],
    ] as const)("keeps the request through tail measurements (animated %s, size %d)", async (animated, tailSize) => {
        Platform.OS = platform;
        const clock = installFakeClock();
        const now = spyOn(Date, "now").mockImplementation(() => clock.now);
        const dispatch = spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
        const data = Array.from({ length: 20 }, (_, index) => ({ id: String(index) }));
        const ctx = createMockContext(
            { numColumns: 1, numContainers: 20, numContainersPooled: 20, readyToRender: true, totalSize: 2000 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                idCache: data.map((item) => item.id),
                indexByKey: new Map(data.map((item, index) => [item.id, index])),
                positions: data.map((_, index) => index * 100),
                props: { data, estimatedItemSize: 100, keyExtractor: (item: { id: string }) => item.id },
                scrollLength: 400,
                sizes: new Map(data.map((item) => [item.id, 100])),
                sizesKnown: new Map(data.slice(0, 15).map((item) => [item.id, 100])),
            },
        );
        cleanups.push(() => {
            ctx.state.scheduledWork.dispose();
            dispatch.mockRestore();
            now.mockRestore();
            clock.restore();
        });
        const { state } = ctx;
        state.triggerCalculateItemsInView = (params) => calculateItemsInView(ctx, params);
        let observed = 0;
        let nativeContent = 1800;
        const commands: number[] = [];
        const emitScroll = () =>
            onScroll(ctx, {
                nativeEvent: {
                    contentOffset: { x: 0, y: observed },
                    contentSize: { height: nativeContent, width: 300 },
                    layoutMeasurement: { height: 400, width: 300 },
                },
            } as never);
        state.refScroller.current = {
            scrollTo: ({ y }: { y: number }) => {
                commands.push(y);
                const apply = () => {
                    observed = Math.max(0, Math.min(y, nativeContent - state.scrollLength));
                    requestAnimationFrame(emitScroll);
                };
                // The content-size reissue can reach native after its MVCP scroll
                // event has already completed the request.
                if (commands.length === 1) apply();
                else setTimeout(apply, 72);
            },
        } as never;
        calculateItemsInView(ctx);
        let resolved = false;
        const promise = getScrollRequestTracker(ctx).runNowIfIdle(() => scrollToEnd(ctx, { animated }));
        void promise.then(() => {
            resolved = true;
        });
        expect(commands).toEqual([1600]);
        clock.tick();
        await Promise.resolve();
        expect(resolved).toBe(false);

        // The first native command was clamped to its old mounted content. Tail layout
        // now replaces estimates before the content-size callback reissues the request.
        updateItemSizesBatch(
            ctx,
            data.slice(15).map((item) => ({
                itemKey: item.id,
                size: { height: tailSize, width: 300 },
            })),
        );
        const end = getContentSize(ctx) - state.scrollLength;
        expect(end).toBe(tailSize === 70 ? 1450 : 1750);
        expect(getCurrentTargetOffset(ctx, state.scrollingTo!)).toBe(end);
        nativeContent = getContentSize(ctx);
        reissueClampedNativeEndScroll(ctx);
        // Native layout/anchor correction (or the animation) reports the measured end
        // before the queued content-size reissue is applied. Completion is valid here;
        // a stale reissue must not move native away after the promise resolves.
        observed = end;
        emitScroll();
        for (let i = 0; i < 80; i++) {
            clock.tick();
            await Promise.resolve();
            if (resolved) expect(Math.abs(observed - end)).toBeLessThanOrEqual(1);
        }
        expect(resolved).toBe(true);
        expect(state.scrollingTo).toBeUndefined();
        expect(Math.abs(observed - end)).toBeLessThanOrEqual(1);
        if (!animated) expect(commands.at(-1)).toBe(end);
    });
});

describe.each(["ios", "android"] as const)("superseded instant end request (%s)", (platform) => {
    it.each(["waiting index", "visible region"] as const)(
        "does not replay the end after a %s replacement",
        (replacement) => {
            Platform.OS = platform;
            const clock = installFakeClock();
            const now = spyOn(Date, "now").mockImplementation(() => clock.now);
            const dispatch = spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
            const data = Array.from({ length: 20 }, (_, index) => ({ id: String(index) }));
            const calls: number[] = [];
            const ctx = createMockContext(
                { totalSize: 2000 },
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    idCache: data.map((item) => item.id),
                    indexByKey: new Map(data.map((item, index) => [item.id, index])),
                    lastLayout: { height: 400, width: 300, x: 0, y: 0 },
                    positions: data.map((_, index) => index * 100),
                    props: { data, estimatedItemSize: 100, keyExtractor: (item: { id: string }) => item.id },
                    scrollLength: 400,
                    sizes: new Map(data.map((item) => [item.id, 100])),
                    sizesKnown: new Map(data.map((item) => [item.id, 100])),
                },
            );
            cleanups.push(() => {
                ctx.state.scheduledWork.dispose();
                dispatch.mockRestore();
                now.mockRestore();
                clock.restore();
            });
            ctx.state.refScroller.current = { scrollTo: ({ y }: { y: number }) => calls.push(y) } as never;
            const handle = createImperativeHandle(ctx);
            void handle.scrollToEnd({ animated: false });
            expect(ctx.state.scrollingTo?.isScrollToEnd).toBe(true);
            expect(calls).toEqual([1600]);
            ctx.state.lastNativeScroll = 0;
            if (replacement === "visible region") {
                void handle.scrollIndexIntoView({ animated: false, index: 2 });
                expect(ctx.scrollRequestTracker?.isWaitingToRun()).toBe(false);
                expect(ctx.state.scrollingTo).toBeUndefined();
                expect(ctx.state.pendingScrollResolve).toBeUndefined();
                expect(ctx.state.scroll).toBe(0);
                reissueClampedNativeEndScroll(ctx);
                clock.tick(32);
                expect(calls).toEqual([1600]);
            } else {
                ctx.state.didDataChange = true;
                void handle.scrollToIndex({ animated: false, index: 2 });
                expect(ctx.scrollRequestTracker?.isWaitingToRun()).toBe(true);
                // Content mounts while the replacement is waiting; it belongs to the new request.
                reissueClampedNativeEndScroll(ctx);
                expect(calls).toHaveLength(1);
                ctx.state.didDataChange = false;
                clock.tick(16);
                clock.tick(16);
                expect(ctx.scrollRequestTracker?.isWaitingToRun()).toBe(false);
                expect(calls.at(-1)).toBe(200);
            }
        },
    );
});
