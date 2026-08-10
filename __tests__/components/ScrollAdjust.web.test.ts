import * as React from "react";

import { describe, expect, it, mock } from "bun:test";
import {
    getScrollAdjustAxis,
    getScrollAdjustTarget,
    ScrollAdjust,
    scrollAdjustBy,
} from "../../src/components/ScrollAdjust?web-behavior";
import { StateProvider, set$, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import TestRenderer, { act } from "../helpers/testRenderer";

function createElementLike(parentElement: unknown, isConnected = true) {
    return {
        isConnected,
        parentElement,
    } as HTMLElement;
}

function createCtx(horizontal = false, scrollElement?: HTMLElement) {
    return {
        state: {
            props: {
                horizontal,
            },
            refScroller: {
                current: scrollElement
                    ? {
                          getScrollableNode: () => scrollElement,
                      }
                    : null,
            },
        },
        values: new Map([["scrollAdjustUserOffset", 0]]),
    } as any;
}

function installAnimationFrameQueue() {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextId = 0;

    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
        const id = ++nextId;
        callbacks.set(id, callback);
        return id;
    };
    globalThis.cancelAnimationFrame = (id: number) => {
        callbacks.delete(id);
    };

    return {
        flush() {
            const pending = [...callbacks.values()];
            callbacks.clear();
            pending.forEach((callback) => callback(Date.now()));
        },
        restore() {
            globalThis.requestAnimationFrame = originalRequestAnimationFrame;
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        },
    };
}

function renderPaddingAdjustment() {
    const contentNode = {
        offsetHeight: 0,
        parentElement: null,
        scrollHeight: 76723,
        style: { paddingBottom: "607px" },
    } as unknown as HTMLElement;
    const scrollElement = {
        clientHeight: 799,
        querySelector: mock(() => contentNode),
        scrollBy: mock(({ top }: { top: number }) => {
            scrollElement.scrollTop += top;
        }),
        scrollLeft: 0,
        scrollTop: 75924,
    } as unknown as HTMLElement;
    let ctx: ReturnType<typeof useStateContext> | undefined;

    function Setup() {
        ctx = useStateContext();
        ctx.state = createMockState({
            props: { horizontal: false },
            refScroller: {
                current: {
                    getScrollableNode: () => scrollElement,
                },
            } as any,
            scroll: 75924.25,
        });

        return React.createElement(ScrollAdjust);
    }

    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
        renderer = TestRenderer.create(React.createElement(StateProvider, null, React.createElement(Setup)));
    });
    return { contentNode, ctx: ctx!, renderer: renderer!, scrollElement };
}

describe("ScrollAdjust (web)", () => {
    it("uses horizontal scroll measurements and padding on the x axis", () => {
        expect(getScrollAdjustAxis(true)).toEqual({
            contentSizeKey: "scrollWidth",
            paddingEndProp: "paddingRight",
            viewportSizeKey: "clientWidth",
            x: 1,
            y: 0,
        });
    });

    it("uses vertical scroll measurements and padding on the y axis", () => {
        expect(getScrollAdjustAxis(false)).toEqual({
            contentSizeKey: "scrollHeight",
            paddingEndProp: "paddingBottom",
            viewportSizeKey: "clientHeight",
            x: 0,
            y: 1,
        });
    });

    it("reuses a cached content node while it remains a direct child of the scroller", () => {
        const scrollElement = {
            querySelector: mock(() => null),
        } as unknown as HTMLElement;
        const contentNode = createElementLike(scrollElement);

        expect(getScrollAdjustTarget(createCtx(false, scrollElement), contentNode)).toEqual({
            contentNode,
            scrollElement,
        });
        expect(scrollElement.querySelector).not.toHaveBeenCalled();
    });

    it("queries only direct content-container children when there is no usable cached node", () => {
        const contentNode = createElementLike(null);
        const scrollElement = {
            querySelector: mock(() => contentNode),
        } as unknown as HTMLElement;

        expect(getScrollAdjustTarget(createCtx(false, scrollElement), null)).toEqual({
            contentNode,
            scrollElement,
        });
        expect(scrollElement.querySelector).toHaveBeenCalledWith(":scope > .legend-list-content-container");
    });

    it("queries again when the cached node is disconnected or belongs to another parent", () => {
        const nextContentNode = createElementLike(null);
        const scrollElement = {
            querySelector: mock(() => nextContentNode),
        } as unknown as HTMLElement;
        const disconnectedNode = createElementLike(scrollElement, false);
        const otherParentNode = createElementLike({});

        expect(getScrollAdjustTarget(createCtx(false, scrollElement), disconnectedNode)).toEqual({
            contentNode: nextContentNode,
            scrollElement,
        });
        expect(getScrollAdjustTarget(createCtx(false, scrollElement), otherParentNode)).toEqual({
            contentNode: nextContentNode,
            scrollElement,
        });
        expect(scrollElement.querySelector).toHaveBeenCalledTimes(2);
    });

    it("scrolls the DOM element directly", () => {
        const scrollElement = {
            scrollBy: mock(() => {}),
            scrollLeft: 0,
            scrollTop: 0,
        } as unknown as HTMLElement;

        scrollAdjustBy(scrollElement, 3, 4);

        expect(scrollElement.scrollBy).toHaveBeenCalledWith({ behavior: "auto", left: 3, top: 4 });
    });

    it("does not scroll again when content shrink clamps the DOM to the intended scroll", () => {
        const scrollByMock = mock(() => {});
        const contentNode = {
            clientHeight: 0,
            offsetHeight: 0,
            parentElement: null,
            scrollHeight: 2000,
            style: {},
        } as unknown as HTMLElement;
        const scrollElement = {
            clientHeight: 500,
            querySelector: mock(() => contentNode),
            scrollBy: scrollByMock,
            scrollLeft: 0,
            scrollTop: 829,
        } as unknown as HTMLElement;
        let ctx: ReturnType<typeof useStateContext> | undefined;
        function Setup() {
            ctx = useStateContext();
            ctx.state = createMockState({
                props: { horizontal: false },
                refScroller: {
                    current: {
                        getScrollableNode: () => scrollElement,
                    },
                } as any,
                scroll: 829,
            });

            return React.createElement(ScrollAdjust);
        }

        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(React.createElement(StateProvider, null, React.createElement(Setup)));
            });

            act(() => {
                set$(ctx!, "scrollAdjust", -448);
            });

            expect(scrollByMock).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("applies only the user anchor offset delta after state observes the previous adjustment", () => {
        const scrollByCalls: Array<{ left: number; top: number }> = [];
        const contentNode = {
            clientHeight: 0,
            offsetHeight: 0,
            parentElement: null,
            scrollHeight: 5000,
            style: {},
        } as unknown as HTMLElement;
        const scrollElement = {
            clientHeight: 500,
            querySelector: mock(() => contentNode),
            scrollBy: mock(({ left, top }: { left: number; top: number }) => {
                scrollByCalls.push({ left, top });
                scrollElement.scrollLeft += left;
                scrollElement.scrollTop += top;
            }),
            scrollLeft: 0,
            scrollTop: 1000,
        } as unknown as HTMLElement;
        let ctx: ReturnType<typeof useStateContext> | undefined;
        function Setup() {
            ctx = useStateContext();
            ctx.state = createMockState({
                props: { horizontal: false },
                refScroller: {
                    current: {
                        getScrollableNode: () => scrollElement,
                    },
                } as any,
                scroll: 1000,
            });

            return React.createElement(ScrollAdjust);
        }

        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(React.createElement(StateProvider, null, React.createElement(Setup)));
            });

            act(() => {
                set$(ctx!, "scrollAdjustUserOffset", 50);
            });
            expect(scrollElement.scrollTop).toBe(1050);

            ctx!.state.scroll = 1050;
            act(() => {
                set$(ctx!, "scrollAdjustUserOffset", 100);
            });

            expect(scrollElement.scrollTop).toBe(1100);
            expect(scrollByCalls).toEqual([
                { left: 0, top: 50 },
                { left: 0, top: 50 },
            ]);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("applies only the user anchor offset delta before state observes the previous adjustment", () => {
        const scrollByCalls: Array<{ left: number; top: number }> = [];
        const contentNode = {
            clientHeight: 0,
            offsetHeight: 0,
            parentElement: null,
            scrollHeight: 5000,
            style: {},
        } as unknown as HTMLElement;
        const scrollElement = {
            clientHeight: 500,
            querySelector: mock(() => contentNode),
            scrollBy: mock(({ left, top }: { left: number; top: number }) => {
                scrollByCalls.push({ left, top });
                scrollElement.scrollLeft += left;
                scrollElement.scrollTop += top;
            }),
            scrollLeft: 0,
            scrollTop: 1000,
        } as unknown as HTMLElement;
        let ctx: ReturnType<typeof useStateContext> | undefined;
        function Setup() {
            ctx = useStateContext();
            ctx.state = createMockState({
                props: { horizontal: false },
                refScroller: {
                    current: {
                        getScrollableNode: () => scrollElement,
                    },
                } as any,
                scroll: 1000,
            });

            return React.createElement(ScrollAdjust);
        }

        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(React.createElement(StateProvider, null, React.createElement(Setup)));
            });

            act(() => {
                set$(ctx!, "scrollAdjustUserOffset", 50);
            });
            act(() => {
                set$(ctx!, "scrollAdjustUserOffset", 100);
            });

            expect(scrollElement.scrollTop).toBe(1100);
            expect(scrollByCalls).toEqual([
                { left: 0, top: 50 },
                { left: 0, top: 50 },
            ]);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("adds temporary scroll room without replacing existing end padding, then restores it", () => {
        const animationFrames = installAnimationFrameQueue();
        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = ((element: HTMLElement) => element.style) as typeof window.getComputedStyle;
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            const rendered = renderPaddingAdjustment();
            renderer = rendered.renderer;

            act(() => {
                set$(rendered.ctx, "scrollAdjust", -20.75);
            });

            expect(rendered.contentNode.style.paddingBottom).toBe("607.5px");
            expect(rendered.scrollElement.scrollTop).toBe(75924.25);

            act(() => animationFrames.flush());

            expect(rendered.contentNode.style.paddingBottom).toBe("607px");
        } finally {
            window.getComputedStyle = originalGetComputedStyle;
            animationFrames.restore();
            act(() => renderer?.unmount());
        }
    });

    it("coalesces repeated temporary padding and restores the original baseline", () => {
        const animationFrames = installAnimationFrameQueue();
        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = ((element: HTMLElement) => element.style) as typeof window.getComputedStyle;
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            const rendered = renderPaddingAdjustment();
            renderer = rendered.renderer;

            act(() => {
                set$(rendered.ctx, "scrollAdjust", -20.75);
            });
            rendered.contentNode.scrollHeight = 76723.5;
            rendered.ctx.state.scroll = 75924.75;
            act(() => {
                set$(rendered.ctx, "scrollAdjust", -20.25);
            });

            expect(rendered.contentNode.style.paddingBottom).toBe("608px");

            act(() => animationFrames.flush());

            expect(rendered.contentNode.style.paddingBottom).toBe("607px");
        } finally {
            window.getComputedStyle = originalGetComputedStyle;
            animationFrames.restore();
            act(() => renderer?.unmount());
        }
    });

    it("does not reset over a newer padding value applied while temporary padding is active", () => {
        const animationFrames = installAnimationFrameQueue();
        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = ((element: HTMLElement) => element.style) as typeof window.getComputedStyle;
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            const rendered = renderPaddingAdjustment();
            renderer = rendered.renderer;

            act(() => {
                set$(rendered.ctx, "scrollAdjust", -20.75);
            });
            rendered.contentNode.style.paddingBottom = "586px";

            act(() => animationFrames.flush());

            expect(rendered.contentNode.style.paddingBottom).toBe("586px");
        } finally {
            window.getComputedStyle = originalGetComputedStyle;
            animationFrames.restore();
            act(() => renderer?.unmount());
        }
    });
});
