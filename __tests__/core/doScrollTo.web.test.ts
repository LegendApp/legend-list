import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";

import "../setup";

import { createMockContext } from "../__mocks__/createMockContext";

const checkFinishedScrollMock = mock(() => {});
const checkFinishedScrollFallbackMock = mock(() => {});

mock.module("@/core/checkFinishedScroll", () => ({
    checkFinishedScroll: checkFinishedScrollMock,
    checkFinishedScrollFallback: checkFinishedScrollFallbackMock,
}));

describe("doScrollTo (web)", () => {
    afterAll(() => {
        mock.restore();
    });

    afterEach(() => {
        checkFinishedScrollMock.mockClear();
        checkFinishedScrollFallbackMock.mockClear();
    });

    it("uses scroller scrollTo options when getScrollableNode returns an element", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-dom-scroll-options");
        const ctx = createMockContext();
        const addEventListener = mock(() => {});
        const removeEventListener = mock(() => {});
        const elementScrollTo = mock(() => {});
        const scrollerScrollTo = mock(() => {});
        const element = {
            addEventListener,
            removeEventListener,
            scrollLeft: 0,
            scrollTo: elementScrollTo,
            scrollTop: 0,
        } as unknown as HTMLElement;

        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => 0,
                getScrollableNode: () => element,
                getScrollEventTarget: () => element,
                scrollTo: scrollerScrollTo,
            },
        } as any;

        doScrollTo(ctx, { animated: true, horizontal: false, offset: 120 });

        expect(scrollerScrollTo).toHaveBeenCalledWith({ animated: true, x: 0, y: 120 });
        expect(elementScrollTo).not.toHaveBeenCalled();
    });

    it("does nothing when getScrollableNode returns null", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-missing-dom-node");
        const ctx = createMockContext();
        const scrollerScrollTo = mock(() => {});

        ctx.state.refScroller = {
            current: {
                getScrollableNode: () => null,
                getScrollEventTarget: () => null,
                scrollTo: scrollerScrollTo,
            },
        } as any;

        doScrollTo(ctx, { animated: false, horizontal: false, offset: 120 });

        expect(scrollerScrollTo).not.toHaveBeenCalled();
    });

    it("uses getScrollEventTarget for animated scroll end listeners", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-scroll-target");
        const ctx = createMockContext();
        const scrollerScrollTo = mock(() => {});
        const addEventListener = mock(() => {});
        const removeEventListener = mock(() => {});
        const element = {
            addEventListener: mock(() => {}),
            removeEventListener: mock(() => {}),
            scrollLeft: 0,
            scrollTop: 80,
        } as unknown as HTMLElement;

        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => 80,
                getScrollableNode: () => element,
                getScrollEventTarget: () => ({ addEventListener, removeEventListener }),
                scrollTo: scrollerScrollTo,
            },
        } as any;

        doScrollTo(ctx, { animated: true, horizontal: false, offset: 80 });

        expect(scrollerScrollTo).toHaveBeenCalledWith({ animated: true, x: 0, y: 80 });
        expect(addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    });

    it("arms the fallback cleanup for non-animated scrolls", async () => {
        const originalSetTimeout = globalThis.setTimeout;
        const setTimeoutMock = mock((_callback: TimerHandler, _delay?: number) => 1 as ReturnType<typeof setTimeout>);
        globalThis.setTimeout = setTimeoutMock as typeof globalThis.setTimeout;

        try {
            const { doScrollTo } = await import("../../src/core/doScrollTo?web-non-animated-fallback");
            const ctx = createMockContext();
            const scrollerScrollTo = mock(() => {});
            const element = {
                addEventListener: mock(() => {}),
                removeEventListener: mock(() => {}),
                scrollLeft: 0,
                scrollTop: 0,
            } as unknown as HTMLElement;

            ctx.state.refScroller = {
                current: {
                    getCurrentScrollOffset: () => 0,
                    getScrollableNode: () => element,
                    getScrollEventTarget: () => element,
                    scrollTo: scrollerScrollTo,
                },
            } as any;

            doScrollTo(ctx, { animated: false, horizontal: false, offset: 120 });

            expect(scrollerScrollTo).toHaveBeenCalledWith({ animated: false, x: 0, y: 120 });
            expect(checkFinishedScrollFallbackMock).toHaveBeenCalledWith(ctx);
            expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 100);
        } finally {
            globalThis.setTimeout = originalSetTimeout;
        }
    });
});
