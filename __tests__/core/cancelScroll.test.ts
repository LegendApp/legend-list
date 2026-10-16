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
            refScroller: { current: { getCurrentScrollOffset: () => 100, scrollTo } } as any,
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
        expect(scrollTo).toHaveBeenCalledWith({ animated: false, x: 600, y: 0 });
    });

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
