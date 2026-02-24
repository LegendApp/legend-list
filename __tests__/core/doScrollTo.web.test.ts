import { describe, expect, it, mock } from "bun:test";

import "../setup";

import { createMockContext } from "../__mocks__/createMockContext";

describe("doScrollTo (web)", () => {
    it("uses DOM scrollTo options when getScrollableNode returns an element", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-dom-scroll-options");
        const ctx = createMockContext();
        const addEventListener = mock(() => {});
        const removeEventListener = mock(() => {});
        const scrollTo = mock(() => {});
        const element = {
            addEventListener,
            removeEventListener,
            scrollLeft: 0,
            scrollTo,
            scrollTop: 0,
        } as unknown as HTMLElement;

        ctx.state.refScroller = {
            current: {
                getScrollableNode: () => element,
            },
        } as any;

        doScrollTo(ctx, { animated: true, horizontal: false, offset: 120 });

        expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", left: 0, top: 120 });
    });

    it("does nothing when getScrollableNode returns null", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-missing-dom-node");
        const ctx = createMockContext();
        const scrollTo = mock(() => {});

        ctx.state.refScroller = {
            current: {
                getScrollableNode: () => null,
                scrollTo,
            },
        } as any;

        doScrollTo(ctx, { animated: false, horizontal: false, offset: 120 });

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("uses getScrollEventTarget for animated scroll end listeners", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-scroll-target");
        const ctx = createMockContext();
        const scrollTo = mock(() => {});
        const addEventListener = mock(() => {});
        const removeEventListener = mock(() => {});
        const element = {
            addEventListener: mock(() => {}),
            removeEventListener: mock(() => {}),
            scrollLeft: 0,
            scrollTo,
            scrollTop: 80,
        } as unknown as HTMLElement;

        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => 80,
                getScrollableNode: () => element,
                getScrollEventTarget: () => ({ addEventListener, removeEventListener }),
            },
        } as any;

        doScrollTo(ctx, { animated: true, horizontal: false, offset: 80 });

        expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", left: 0, top: 80 });
        expect(addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    });
});
