import { afterEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { cancelScroll, interruptUserScroll } from "../../src/core/cancelScroll";
import { Platform } from "../../src/platform/Platform";
import { createMockContext } from "../__mocks__/createMockContext";

const originalPlatform = Platform.OS;

afterEach(() => {
    Platform.OS = originalPlatform;
});

function createScrollingContext(scrollingTo: Record<string, unknown> | undefined, props = {}) {
    const scrollTo = mock(() => {});
    const ctx = createMockContext(
        { totalSize: 1000 },
        {
            props,
            refScroller: {
                current: { getCurrentScrollOffset: () => 100, getMaxScrollOffset: () => 700, scrollTo },
            } as any,
            scroll: 900,
            scrollingTo,
            scrollLength: 300,
        },
    );
    return { ctx, scrollTo };
}

describe("cancelScroll", () => {
    it("does not write an offset when no animation is active", () => {
        const { ctx, scrollTo } = createScrollingContext(undefined);
        cancelScroll(ctx);
        expect(scrollTo).not.toHaveBeenCalled();
        expect(ctx.state.scroll).toBe(100);
    });

    it("lets a native user interruption keep the platform's drag offset", () => {
        Platform.OS = "ios";
        const { ctx, scrollTo } = createScrollingContext({ animated: true, offset: 900 });
        interruptUserScroll(ctx);
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("stops a horizontal RTL animation at the native offset", () => {
        const { ctx, scrollTo } = createScrollingContext(
            { animated: true, offset: 900 },
            { horizontal: true, rtl: true },
        );
        ctx.state.horizontalRTLScrollType = "inverted";
        cancelScroll(ctx);
        // The raw inverted DOM offset 100 is logical 600; stopping keeps the native position.
        expect(ctx.state.scroll).toBe(600);
        expect(scrollTo).toHaveBeenCalledWith({ animated: false, x: 100, y: 0 });
    });

    it.each([
        ["inverted", 500, 900],
        [undefined, -350, 700],
    ] as const)("stops a %s RTL DOM animation at its raw offset", (convention, rawOffset, maxOffset) => {
        const { ctx, scrollTo } = createScrollingContext(
            { animated: true, offset: 900 },
            { horizontal: true, rtl: true },
        );
        ctx.state.horizontalRTLScrollType = convention;
        ctx.state.refScroller.current = {
            getCurrentScrollOffset: () => rawOffset,
            getMaxScrollOffset: () => maxOffset,
            scrollTo,
        } as any;
        cancelScroll(ctx);
        expect(scrollTo).toHaveBeenCalledWith({ animated: false, x: rawOffset, y: 0 });
    });

    it("syncs the observed offset inside the MVCP ignore window before committing deferred adjustments", () => {
        const { ctx } = createScrollingContext({ animated: true, offset: 900 });
        ctx.state.refScroller.current = { scrollTo: mock(() => {}) } as any;
        ctx.state.lastNativeScroll = 600;
        // A +100 adjustment deferred during the animation raised the model scroll and opened an ignore window.
        ctx.state.scroll = 700;
        ctx.values.set("scrollAdjustPending", 100);
        const ignoreWindow = { lt: 650 };
        ctx.state.ignoreScrollFromMVCP = ignoreWindow;
        ctx.state.scrollAdjustHandler.commitPendingAdjust = mock(() => {
            // The deferred adjustment is not applied natively yet, so it must apply to the observed offset.
            expect(ctx.state.scroll).toBe(600);
        });

        cancelScroll(ctx);

        expect(ctx.state.scrollAdjustHandler.commitPendingAdjust).toHaveBeenCalledTimes(1);
        expect(ctx.state.ignoreScrollFromMVCP).toBe(ignoreWindow);
    });

    it.each([100, -100])(
        "uses the uncompensated fallback for a deferred %ipx adjustment without native observations",
        (pending) => {
            const { ctx } = createScrollingContext({ animated: true, index: 2, offset: 200 });
            ctx.state.refScroller.current = { scrollTo: mock(() => {}) } as any;
            ctx.state.scrollPending = 500;
            ctx.state.scroll = 500 + pending;
            ctx.values.set("scrollAdjustPending", pending);
            ctx.state.scrollAdjustHandler.commitPendingAdjust = mock(() => {
                expect(ctx.state.scroll).toBe(500);
            });
            cancelScroll(ctx);
            expect(ctx.state.scrollAdjustHandler.commitPendingAdjust).toHaveBeenCalledTimes(1);
        },
    );

    it("commits adjustments deferred by the cancelled animation", () => {
        const { ctx } = createScrollingContext({ animated: true, offset: 900 });
        const commitPendingAdjust = mock((target?: unknown) => {
            // Runs after the cancelled target is released, so it cannot retarget it.
            expect(target).toBeUndefined();
            expect(ctx.state.scrollingTo).toBeUndefined();
            expect(ctx.state.scroll).toBe(100);
        });
        ctx.state.scrollAdjustHandler.commitPendingAdjust = commitPendingAdjust;

        cancelScroll(ctx);

        expect(commitPendingAdjust).toHaveBeenCalledTimes(1);
    });
});
