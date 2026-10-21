import { describe, expect, it, mock } from "bun:test";

import "../setup";

import { createMockContext } from "../__mocks__/createMockContext";

describe("doScrollTo (web)", () => {
    it("does not let an already-aligned completion frame finish a newer target", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-stale-no-op");
        const ctx = createMockContext();
        const resolve = mock(() => {});
        const originalRAF = globalThis.requestAnimationFrame;
        let frame: FrameRequestCallback | undefined;
        globalThis.requestAnimationFrame = (callback) => {
            frame = callback;
            return 1;
        };
        ctx.state.scrollingTo = { animated: true, offset: 100 };
        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => 100,
                getMaxScrollOffset: () => 100,
                getScrollableNode: () => ({}),
                scrollTo: mock(() => {}),
            },
        } as any;
        try {
            doScrollTo(ctx, { animated: true, offset: 100 });
            const target = { animated: true, offset: 20 };
            ctx.state.scrollingTo = target;
            ctx.state.pendingScrollResolve = resolve;
            expect(frame).toBeDefined();
            frame?.(0);
            expect(ctx.state.scrollingTo).toBe(target);
            expect(resolve).not.toHaveBeenCalled();
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    for (const animated of [true, false]) {
        it(`finishes an aligned clamped target on the next frame (animated: ${animated})`, async () => {
            const { doScrollTo } = await import("../../src/core/doScrollTo?web-clamped-no-op");
            const ctx = createMockContext();
            const resolve = mock(() => {});
            const addEventListener = mock(() => {});
            const originalRAF = globalThis.requestAnimationFrame;
            let frame: FrameRequestCallback | undefined;
            globalThis.requestAnimationFrame = (callback) => {
                frame = callback;
                return 1;
            };
            ctx.state.scrollingTo = { animated, offset: 116 };
            ctx.state.pendingScrollResolve = resolve;
            ctx.state.refScroller = {
                current: {
                    getCurrentScrollOffset: () => 100,
                    getMaxScrollOffset: () => 100,
                    getScrollableNode: () => ({}),
                    getScrollEventTarget: () => ({ addEventListener, removeEventListener: mock(() => {}) }),
                    scrollTo: mock(() => {}),
                },
            } as any;

            try {
                doScrollTo(ctx, { animated, offset: 116 });
                expect(resolve).not.toHaveBeenCalled();
                expect(addEventListener).not.toHaveBeenCalled();
                expect(frame).toBeDefined();
                frame?.(0);
                expect(resolve).toHaveBeenCalledTimes(1);
                expect(ctx.state.scrollingTo).toBeUndefined();
            } finally {
                globalThis.requestAnimationFrame = originalRAF;
            }
        });
    }

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

    it("cancels previous completion work when getScrollableNode returns null", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-missing-dom-node");
        const ctx = createMockContext();
        const cancelPlatformCompletion = mock(() => {});
        const scrollerScrollTo = mock(() => {});

        ctx.state.refScroller = {
            current: {
                getScrollableNode: () => null,
                getScrollEventTarget: () => null,
                scrollTo: scrollerScrollTo,
            },
        } as any;
        ctx.state.scheduledWork.register("platformScrollCompletion", cancelPlatformCompletion);

        doScrollTo(ctx, { animated: false, horizontal: false, offset: 120 });

        expect(cancelPlatformCompletion).toHaveBeenCalledTimes(1);
        expect(ctx.state.scheduledWork.has("platformScrollCompletion")).toBe(false);
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
                getCurrentScrollOffset: () => 70,
                getScrollableNode: () => element,
                getScrollEventTarget: () => ({ addEventListener, removeEventListener }),
                scrollTo: scrollerScrollTo,
            },
        } as any;
        ctx.state.scrollingTo = { animated: true, offset: 80 };

        doScrollTo(ctx, { animated: true, horizontal: false, offset: 80 });

        expect(scrollerScrollTo).toHaveBeenCalledWith({ animated: true, x: 0, y: 80 });
        expect(addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
        // Input belongs to ListComponentScrollView, which applies ownership and control filters.
        expect(addEventListener.mock.calls.every(([type]) => type === "scroll")).toBe(true);
    });

    it("does not let an old non-animated frame finish a newer scroll", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-stale-non-animated-timer");
        const ctx = createMockContext();
        const element = {} as HTMLElement;
        const scheduledCallbacks: FrameRequestCallback[] = [];
        const originalRAF = globalThis.requestAnimationFrame;
        const originalCancelRAF = globalThis.cancelAnimationFrame;
        const resolveSecondScroll = mock(() => {});
        let observedOffset = 0;

        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => observedOffset,
                getScrollableNode: () => element,
                scrollTo: mock(({ y }: { y: number }) => {
                    observedOffset = y;
                }),
            },
        } as any;
        globalThis.requestAnimationFrame = (callback) => {
            scheduledCallbacks.push(callback);
            return scheduledCallbacks.length;
        };
        globalThis.cancelAnimationFrame = mock(() => {});

        try {
            const firstTarget = { animated: false, offset: 40 } as NonNullable<typeof ctx.state.scrollingTo>;
            const secondTarget = { animated: false, offset: 120 } as NonNullable<typeof ctx.state.scrollingTo>;

            ctx.state.scrollingTo = firstTarget;
            doScrollTo(ctx, { animated: false, horizontal: false, offset: 40 });

            ctx.state.scrollingTo = secondTarget;
            ctx.state.pendingScrollResolve = resolveSecondScroll;
            doScrollTo(ctx, { animated: false, horizontal: false, offset: 120 });

            scheduledCallbacks[0]!(0);

            expect(ctx.state.scrollingTo).toBe(secondTarget);
            expect(resolveSecondScroll).not.toHaveBeenCalled();

            scheduledCallbacks[1]!(0);

            expect(ctx.state.scrollingTo).toBeUndefined();
            expect(resolveSecondScroll).toHaveBeenCalledTimes(1);
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
            globalThis.cancelAnimationFrame = originalCancelRAF;
        }
    });

    it("exposes cancellation for non-animated completion frames", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-cancel-non-animated-completion");
        const ctx = createMockContext();
        const scheduledCallbacks: FrameRequestCallback[] = [];
        const clearedHandles: number[] = [];
        const originalRAF = globalThis.requestAnimationFrame;
        const originalCancelRAF = globalThis.cancelAnimationFrame;
        const resolveScroll = mock(() => {});

        ctx.state.refScroller = {
            current: {
                getScrollableNode: () => ({}),
                scrollTo: mock(() => {}),
            },
        } as any;
        ctx.state.scrollingTo = { animated: false, offset: 40 };
        ctx.state.pendingScrollResolve = resolveScroll;
        globalThis.requestAnimationFrame = (callback) => {
            scheduledCallbacks.push(callback);
            return 0;
        };
        globalThis.cancelAnimationFrame = (handle) => {
            clearedHandles.push(handle);
        };

        try {
            doScrollTo(ctx, { animated: false, horizontal: false, offset: 40 });
            ctx.state.scheduledWork.cancel("platformScrollCompletion");

            expect(clearedHandles).toEqual([0]);
            scheduledCallbacks[0]!(0);
            expect(resolveScroll).not.toHaveBeenCalled();
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
            globalThis.cancelAnimationFrame = originalCancelRAF;
        }
    });

    it("removes animated completion listeners when canceled", async () => {
        const { doScrollTo } = await import("../../src/core/doScrollTo?web-cancel-animated-completion");
        const ctx = createMockContext();
        const listeners = new Map<string, (...args: any[]) => void>();
        const addEventListener = mock((type: string, listener: (...args: any[]) => void) => {
            listeners.set(type, listener);
        });
        const removeEventListener = mock((type: string) => {
            listeners.delete(type);
        });
        const target = {
            addEventListener,
            onscrollend: null,
            removeEventListener,
        };

        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => 0,
                getScrollableNode: () => ({}),
                getScrollEventTarget: () => target,
                scrollTo: mock(() => {}),
            },
        } as any;
        ctx.state.scrollingTo = { animated: true, offset: 40 };

        doScrollTo(ctx, { animated: true, horizontal: false, offset: 40 });
        ctx.state.scheduledWork.cancel("platformScrollCompletion");

        expect(removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
        expect(removeEventListener).toHaveBeenCalledWith("scrollend", expect.any(Function));
        expect(listeners.size).toBe(0);
    });
});
