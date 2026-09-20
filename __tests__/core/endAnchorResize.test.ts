import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import {
    handleBootstrapInitialScrollLayoutChange,
    schedulePreservedEndAnchorCorrection,
} from "../../src/core/bootstrapInitialScroll";
import { calculateOffsetWithOffsetPosition } from "../../src/core/calculateOffsetWithOffsetPosition";
import { doMaintainScrollAtEnd } from "../../src/core/doMaintainScrollAtEnd";
import { clearPreservedInitialScrollTarget } from "../../src/core/finishInitialScroll";
import { handleLayout } from "../../src/core/handleLayout";
import { resolveInitialScrollOffset } from "../../src/core/initialScroll";
import { scrollToEnd } from "../../src/core/scrollToEnd";
import { Platform } from "../../src/platform/Platform";
import { getContentSize } from "../../src/state/getContentSize";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe.each(["web", "ios", "android"] as const)("end anchoring across a late viewport resize (%s)", (platform) => {
    const originalRAF = globalThis.requestAnimationFrame;
    const originalPlatform = Platform.OS;
    let frames: FrameRequestCallback[];
    let contexts: StateContext[];

    beforeEach(() => {
        Platform.OS = platform;
        frames = [];
        contexts = [];
        globalThis.requestAnimationFrame = (callback) => frames.push(callback);
    });
    afterEach(() => {
        for (const ctx of contexts) ctx.state.scheduledWork.dispose();
        globalThis.requestAnimationFrame = originalRAF;
        Platform.OS = originalPlatform;
    });

    function setup(footer = 16, horizontal = false, padding = 0) {
        const data = Array.from({ length: 8 }, (_, index) => ({ id: String(index) }));
        const ctx = createMockContext(
            { footerSize: footer, isWithinMaintainScrollAtEndThreshold: true, readyToRender: true, totalSize: 800 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                idCache: data.map((item) => item.id),
                indexByKey: new Map(data.map((item, index) => [item.id, index])),
                initialScroll: {
                    index: 7,
                    preserveForBottomPadding: true,
                    preserveForFooterLayout: true,
                    viewOffset: -footer - padding,
                    viewPosition: 1,
                },
                initialScrollSession: undefined,
                lastLayout: { height: horizontal ? 300 : 400, width: horizontal ? 400 : 300, x: 0, y: 0 },
                otherAxisSize: 300,
                positions: data.map((_, index) => index * 100),
                props: {
                    data,
                    estimatedItemSize: 100,
                    horizontal,
                    keyExtractor: (item) => item.id,
                    maintainScrollAtEnd: { animated: false },
                    stylePaddingBottom: horizontal ? 0 : padding,
                    stylePaddingRight: horizontal ? padding : 0,
                },
                scrollLength: 400,
                sizes: new Map(data.map((item) => [item.id, 100])),
                sizesKnown: new Map(data.map((item) => [item.id, 100])),
            },
        );
        let observed = getContentSize(ctx) - 400;
        ctx.state.scroll = observed;
        ctx.state.lastNativeScroll = observed;
        const scrollTo = mock(({ x, y }: { x: number; y: number }) => {
            observed = Math.max(0, Math.min(horizontal ? x : y, getContentSize(ctx) - ctx.state.scrollLength));
        });
        ctx.state.refScroller.current = {
            getCurrentScrollOffset: () => observed,
            getMaxScrollOffset: () => Math.max(0, getContentSize(ctx) - ctx.state.scrollLength),
            getScrollableNode: () => ({}),
            scrollTo,
        } as unknown as NonNullable<typeof ctx.state.refScroller.current>;
        ctx.scrollToEnd = (options) => scrollToEnd(ctx, options);
        contexts.push(ctx);
        return {
            ctx,
            observed: () => observed,
            scrollTo,
            setObserved: (value: number) => {
                observed = value;
            },
        };
    }

    function resize(ctx: StateContext, length = 344) {
        handleLayout(
            ctx,
            {
                height: ctx.state.props.horizontal ? 300 : length,
                width: ctx.state.props.horizontal ? length : 300,
                x: 0,
                y: 0,
            },
            () => {},
        );
        handleBootstrapInitialScrollLayoutChange(ctx);
    }
    function flushFrame() {
        const pending = frames.splice(0);
        for (const callback of pending) callback(0);
    }

    for (const horizontal of [false, true]) {
        for (const footer of [0, 16, 80]) {
            for (const padding of [0, 24]) {
                it(`counts footer/padding once: horizontal=${horizontal}, footer=${footer}, padding=${padding}`, () => {
                    const { ctx } = setup(footer, horizontal, padding);
                    const end = getContentSize(ctx) - ctx.state.scrollLength;
                    expect(resolveInitialScrollOffset(ctx, ctx.state.initialScroll!)).toBe(end);
                    scrollToEnd(ctx, { animated: false });
                    expect(ctx.state.scrollingTo?.targetOffset).toBe(end);
                });
            }
        }
        it(`follows a shrinking viewport with platform-appropriate timing: horizontal=${horizontal}`, () => {
            const { ctx, observed, scrollTo } = setup(16, horizontal);
            resize(ctx);
            if (platform !== "web") {
                expect(scrollTo).not.toHaveBeenCalled();
                flushFrame();
            }
            const end = getContentSize(ctx) - ctx.state.scrollLength;
            expect(observed()).toBe(end);
            expect(ctx.state.scroll).toBe(end);
            const calls = scrollTo.mock.calls.length;
            flushFrame();
            expect(ctx.state.scroll).toBe(end);
            expect(scrollTo.mock.calls.length).toBe(calls);
        });
    }

    for (const viewPosition of [0, 0.5, 1]) {
        it(`does not shift a last-item alignment by the footer at viewPosition=${viewPosition}`, () => {
            const { ctx } = setup();
            expect(calculateOffsetWithOffsetPosition(ctx, 700, { index: 7, viewPosition })).toBe(
                700 - viewPosition * 300,
            );
        });
    }

    it.skipIf(platform !== "web")("does not add a stale native delta to a position already at the end", () => {
        const { ctx, observed, scrollTo } = setup(0);
        ctx.state.lastNativeScroll = ctx.state.scroll - 56;
        schedulePreservedEndAnchorCorrection(ctx);
        flushFrame();
        expect(ctx.state.scroll).toBe(observed());
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("lets active end maintenance own the correction", () => {
        const { ctx, scrollTo } = setup(0);
        ctx.state.scrollLength -= 56;
        ctx.state.maintainingScrollAtEnd = "animated";
        ctx.state.scrollingTo = { animated: true, index: 7, isScrollToEnd: true, offset: 456 };
        schedulePreservedEndAnchorCorrection(ctx);
        flushFrame();
        expect(ctx.state.scroll).toBe(400);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    for (const owner of ["drag", "explicit", "promise", "maintenance"] as const) {
        it(`does not let a preserved initial target compete with ${owner}`, () => {
            const { ctx, scrollTo } = setup(0);
            ctx.state.scrollLength -= 56;
            if (owner === "drag") ctx.state.isDragging = true;
            if (owner === "explicit") ctx.state.scrollingTo = { animated: true, index: 2, offset: 200 };
            if (owner === "promise") ctx.state.pendingScrollResolve = () => {};
            if (owner === "maintenance") ctx.state.maintainingScrollAtEnd = "pending-instant";
            schedulePreservedEndAnchorCorrection(ctx);
            flushFrame();
            expect(scrollTo).not.toHaveBeenCalled();
            expect(ctx.state.scroll).toBe(400);
        });
    }

    it("keeps animated end following deferred", () => {
        const { ctx, scrollTo } = setup(0);
        ctx.state.props.maintainScrollAtEnd!.animated = true;
        resize(ctx);
        expect(scrollTo).not.toHaveBeenCalled();
        flushFrame();
        expect(scrollTo).toHaveBeenCalledTimes(1);
        expect(scrollTo.mock.calls[0][0]).toMatchObject({ animated: true, y: 456 });
    });

    for (const reason of ["away", "dragging", "explicit", "disabled"] as const) {
        it(`does not steal the scroll when ${reason}`, () => {
            const { ctx, scrollTo } = setup(0);
            clearPreservedInitialScrollTarget(ctx.state);
            if (reason === "away") ctx.values.set("isWithinMaintainScrollAtEndThreshold", false);
            if (reason === "dragging") ctx.state.isDragging = true;
            if (reason === "explicit") ctx.state.scrollingTo = { animated: false, index: 2, offset: 200 };
            if (reason === "disabled") ctx.state.props.maintainScrollAtEnd = undefined;
            resize(ctx);
            flushFrame();
            expect(scrollTo).not.toHaveBeenCalled();
        });
    }

    it("drops a queued preserved correction when its target is cleared", () => {
        const { ctx, scrollTo } = setup(0);
        ctx.state.scrollLength -= 56;
        schedulePreservedEndAnchorCorrection(ctx);
        clearPreservedInitialScrollTarget(ctx.state);
        flushFrame();
        expect(scrollTo).not.toHaveBeenCalled();
        expect(ctx.state.scroll).toBe(400);
    });

    it.skipIf(platform !== "web")(
        "flushes an already queued instant follow on resize without replaying it next frame",
        () => {
            const { ctx, observed, scrollTo } = setup(0);
            doMaintainScrollAtEnd(ctx);
            expect(scrollTo).not.toHaveBeenCalled();
            resize(ctx);
            expect(observed()).toBe(456);
            expect(scrollTo).toHaveBeenCalledTimes(1);
            flushFrame();
            expect(scrollTo).toHaveBeenCalledTimes(1);
        },
    );

    it.skipIf(platform !== "web")(
        "retargets an active instant end request across repeated resizes without replacing its promise",
        () => {
            const { ctx, observed } = setup();
            resize(ctx);
            const resolve = ctx.state.pendingScrollResolve;
            expect(resolve).toBeDefined();
            resize(ctx, 280);
            expect(observed()).toBe(536);
            expect(ctx.state.pendingScrollResolve).toBe(resolve);
            resize(ctx, 380);
            expect(observed()).toBe(436);
            expect(ctx.state.pendingScrollResolve).toBe(resolve);
            flushFrame();
            expect(observed()).toBe(436);
        },
    );

    it.skipIf(platform === "web")("preserves deferred scheduling on native", () => {
        const { ctx, observed, scrollTo } = setup(0);
        resize(ctx);
        expect(scrollTo).not.toHaveBeenCalled();
        expect(observed()).toBe(400);
        flushFrame();
        expect(observed()).toBe(456);
    });

    it("honors a caller's scrollToEnd viewOffset without counting the footer twice", () => {
        const { ctx } = setup(16, false, 24);
        scrollToEnd(ctx, { animated: false, viewOffset: 30 });
        expect(ctx.state.scrollingTo?.targetOffset).toBe(410);
    });

    it("uses logical end padding for horizontal RTL end scrolling", () => {
        const { ctx } = setup(16, true, 24);
        ctx.state.props.rtl = true;
        ctx.state.props.stylePaddingLeft = 24;
        ctx.state.props.stylePaddingRight = 0;
        scrollToEnd(ctx, { animated: false });
        expect(ctx.state.scrollingTo?.targetOffset).toBe(440);
    });

    for (const length of [1000, 900, 817, 816, 815, 760, 400]) {
        it(`keeps short content end-aligned across a resize to ${length}px`, () => {
            const { ctx, observed, setObserved } = setup();
            ctx.state.props.alignItemsAtEndPaddingEnabled = true;
            ctx.state.scrollLength = 1000;
            ctx.state.lastLayout!.height = 1000;
            ctx.state.scroll = 0;
            ctx.state.lastNativeScroll = 0;
            ctx.values.set("alignItemsAtEndPadding", 184);
            setObserved(0);
            resize(ctx, length);
            if (platform !== "web") flushFrame();
            expect(observed()).toBe(Math.max(0, 816 - length));
            expect(ctx.state.scroll).toBe(observed());
            flushFrame();
            expect(ctx.state.scroll).toBe(observed());
        });
    }
});
