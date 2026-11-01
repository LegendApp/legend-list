import { describe, expect, it, mock } from "bun:test";

import "../setup";

import { createMockContext } from "../__mocks__/createMockContext";

type DomScroller = {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
    scrollWidth?: number;
};

// A short list whose model still holds a stale 20px viewport while the DOM is 347px tall,
// as when a side panel finishes opening before the list's ResizeObserver reports it.
function setup(options: { domContent: number; modelContent?: number; hasExternalScroll?: boolean }) {
    const ctx = createMockContext({ totalSize: options.modelContent ?? 278 });
    ctx.state.scrollLength = 20;
    ctx.state.props.hasExternalScroll = options.hasExternalScroll;
    const dom: DomScroller = { clientHeight: 347, scrollHeight: options.domContent, scrollTop: 0 };
    const maxOffset = () => Math.max(0, dom.scrollHeight - dom.clientHeight);
    const scrollTo = mock(({ y }: { y?: number }) => {
        dom.scrollTop = Math.max(0, Math.min(y ?? 0, maxOffset()));
    });
    ctx.state.refScroller = {
        current: {
            getCurrentScrollOffset: () => dom.scrollTop,
            getMaxScrollOffset: maxOffset,
            getScrollableNode: () => dom,
            scrollTo,
        },
    } as any;
    return { ctx, dom, scrollTo };
}

function withFrames(run: (frames: FrameRequestCallback[]) => void) {
    const frames: FrameRequestCallback[] = [];
    const originalRAF = globalThis.requestAnimationFrame;
    const originalCancelRAF = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => {
        frames.push(callback);
        return frames.length;
    };
    globalThis.cancelAnimationFrame = () => {};
    try {
        run(frames);
    } finally {
        globalThis.requestAnimationFrame = originalRAF;
        globalThis.cancelAnimationFrame = originalCancelRAF;
    }
}

describe("doScrollTo (web) instant landing clamped by the DOM", () => {
    it("records the DOM's offset when a stale viewport lets the request overshoot", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-clamped-instant");
        const { ctx, dom } = setup({ domContent: 347 });
        withFrames(() => {
            ctx.state.scrollingTo = { animated: false, offset: 258 };
            doScrollTo(ctx, { animated: false, horizontal: false, offset: 258 });
        });
        expect(dom.scrollTop).toBe(0);
        expect(ctx.state.scroll).toBe(0);
    });

    it("keeps a request the DOM can reach", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-clamped-instant-reachable");
        const { ctx, dom } = setup({ domContent: 700, modelContent: 700 });
        withFrames(() => {
            ctx.state.scrollingTo = { animated: false, offset: 258 };
            doScrollTo(ctx, { animated: false, horizontal: false, offset: 258 });
        });
        expect(dom.scrollTop).toBe(258);
        expect(ctx.state.scroll).toBe(258);
    });

    it("keeps the request while measured content has not reached the DOM", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-clamped-instant-pending");
        const { ctx } = setup({ domContent: 360, modelContent: 700 });
        withFrames(() => {
            ctx.state.scrollingTo = { animated: false, offset: 353 };
            doScrollTo(ctx, { animated: false, horizontal: false, offset: 353 });
        });
        expect(ctx.state.scroll).toBe(353);
    });

    it("reconciles on the completion frame once committed content still cannot reach the request", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-clamped-instant-frame");
        const { ctx, dom } = setup({ domContent: 200, modelContent: 278 });
        const resolve = mock(() => {});
        withFrames((frames) => {
            ctx.state.scrollingTo = { animated: false, offset: 258 };
            ctx.state.pendingScrollResolve = resolve;
            doScrollTo(ctx, { animated: false, horizontal: false, offset: 258 });
            expect(ctx.state.scroll).toBe(258);

            dom.scrollHeight = 347;
            frames[0]!(0);
        });
        expect(ctx.state.scroll).toBe(0);
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(resolve).toHaveBeenCalledTimes(1);
    });

    it("leaves external scroll containers to their own offset handling", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-clamped-instant-external");
        const { ctx } = setup({ domContent: 347, hasExternalScroll: true });
        withFrames(() => {
            ctx.state.scrollingTo = { animated: false, offset: 258 };
            doScrollTo(ctx, { animated: false, horizontal: false, offset: 258 });
        });
        expect(ctx.state.scroll).toBe(258);
    });
});
