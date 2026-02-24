import { describe, expect, it, mock } from "bun:test";

import "../setup";

import { createMockContext } from "../__mocks__/createMockContext";

describe("doScrollTo (web)", () => {
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
});
