import * as React from "react";

import { describe, expect, it, mock } from "bun:test";
import {
    getScrollAdjustAxis,
    getScrollAdjustTarget,
    ScrollAdjust,
    scrollAdjustBy,
} from "../../src/components/ScrollAdjust?web-behavior";
import { getCommittedWebEndOffset } from "../../src/core/getCurrentTargetOffset";
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

function renderPaddingAdjustment({
    scroll = 75924.25,
    style = { paddingBottom: "607px" },
    externalOffset,
    horizontal = false,
}: {
    scroll?: number;
    horizontal?: boolean;
    externalOffset?: number;
    style?: { paddingBottom: string };
} = {}) {
    const spacer = {
        offsetHeight: 0,
        parentElement: null as HTMLElement | null,
        remove() {
            this.parentElement = null;
        },
        setAttribute: mock(),
        style: { height: "0px", width: "0px" },
    };
    const contentNode = {
        appendChild: mock((element: typeof spacer) => {
            element.parentElement = contentNode;
        }),
        offsetHeight: 0,
        ownerDocument: { createElement: mock(() => spacer) },
        parentElement: null,
        scrollHeight: 76723,
        scrollWidth: 76723,
        style,
    } as unknown as HTMLElement;
    const scrollElement = {
        clientHeight: 799,
        clientWidth: 799,
        querySelector: mock(() => contentNode),
        scrollBy: mock(({ left, top }: { left: number; top: number }) => {
            scrollElement.scrollLeft += left;
            scrollElement.scrollTop += top;
        }),
        scrollLeft: 75924,
        scrollTop: 75924,
    } as unknown as HTMLElement;
    let ctx: ReturnType<typeof useStateContext> | undefined;

    function Setup() {
        ctx = useStateContext();
        ctx.state = createMockState({
            props: { hasExternalScroll: externalOffset !== undefined, horizontal },
            refScroller: {
                current: {
                    getScrollableNode: () => scrollElement,
                    ...(externalOffset === undefined
                        ? {}
                        : {
                              getContentNode: () => contentNode,
                              getCurrentScrollOffset: () => Math.max(0, Math.min(1000, externalOffset)),
                              getMaxScrollOffset: () => 1000,
                              isScrollInRange: () => externalOffset >= 0 && externalOffset <= 1000,
                          }),
                },
            } as any,
            scroll,
        });

        return React.createElement(ScrollAdjust);
    }

    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
        renderer = TestRenderer.create(React.createElement(StateProvider, null, React.createElement(Setup)), {
            createNodeMock: () => spacer,
        });
    });
    return { contentNode, ctx: ctx!, renderer: renderer!, scrollElement, spacer };
}

describe("ScrollAdjust (web)", () => {
    it("uses horizontal scroll measurements and padding on the x axis", () => {
        expect(getScrollAdjustAxis(true)).toEqual({
            contentSizeKey: "scrollWidth",
            sizeProp: "width",
            viewportSizeKey: "clientWidth",
            x: 1,
            y: 0,
        });
    });

    it("uses vertical scroll measurements and padding on the y axis", () => {
        expect(getScrollAdjustAxis(false)).toEqual({
            contentSizeKey: "scrollHeight",
            sizeProp: "height",
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

    for (const horizontal of [false, true]) {
        it(`keeps temporary ${horizontal ? "horizontal" : "vertical"} scroll room off the rows wrapper`, () => {
            const animationFrames = installAnimationFrameQueue();
            const rendered = renderPaddingAdjustment({ horizontal });
            const sizeProp = horizontal ? "width" : "height";
            const scrollProp = horizontal ? "scrollLeft" : "scrollTop";
            const writes: number[] = [];
            rendered.scrollElement.scrollBy = ({ left, top }: ScrollToOptions) => {
                const max =
                    75924 + (rendered.spacer.parentElement ? Number.parseFloat(rendered.spacer.style[sizeProp]) : 0);
                rendered.scrollElement[scrollProp] = Math.min(
                    max,
                    rendered.scrollElement[scrollProp] + (horizontal ? left! : top!),
                );
                writes.push(rendered.scrollElement[scrollProp]);
            };
            try {
                act(() => set$(rendered.ctx, "scrollAdjust", -20.75));
                expect(rendered.contentNode.style.paddingBottom).toBe("607px");
                expect(rendered.spacer.style[sizeProp]).toBe("0.5px");
                expect(writes).toEqual([75924.25]);
                act(() => animationFrames.flush());
                expect(rendered.spacer.parentElement).toBeNull();
            } finally {
                animationFrames.restore();
                act(() => rendered.renderer.unmount());
            }
        });
    }

    it("cancels temporary scroll-room cleanup on unmount", () => {
        const animationFrames = installAnimationFrameQueue();
        const rendered = renderPaddingAdjustment();
        try {
            act(() => set$(rendered.ctx, "scrollAdjust", -20.75));
            act(() => rendered.renderer.unmount());
            rendered.spacer.style.height = "42px";
            act(() => animationFrames.flush());
            expect(rendered.spacer.style.height).toBe("42px");
        } finally {
            animationFrames.restore();
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

            expect(rendered.contentNode.style.paddingBottom).toBe("607px");
            expect(rendered.spacer.style.height).toBe("0.5px");
            expect(rendered.scrollElement.scrollTop).toBe(75924.25);

            act(() => animationFrames.flush());

            expect(rendered.contentNode.style.paddingBottom).toBe("607px");
        } finally {
            window.getComputedStyle = originalGetComputedStyle;
            animationFrames.restore();
            act(() => renderer?.unmount());
        }
    });

    it("keeps fractional scroll room independent of normalized wrapper padding", () => {
        const animationFrames = installAnimationFrameQueue();
        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = ((element: HTMLElement) => element.style) as typeof window.getComputedStyle;
        let paddingBottom = "607px";
        const style = {
            get paddingBottom() {
                return paddingBottom;
            },
            set paddingBottom(value: string) {
                const numericValue = Number.parseFloat(value);
                paddingBottom = Number.isInteger(numericValue) ? `${numericValue}px` : `${numericValue.toFixed(3)}px`;
            },
        };
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            const rendered = renderPaddingAdjustment({ scroll: 75924.123456, style });
            renderer = rendered.renderer;

            act(() => {
                set$(rendered.ctx, "scrollAdjust", -20.75);
            });

            expect(rendered.contentNode.style.paddingBottom).toBe("607px");
            expect(Number.parseFloat(rendered.spacer.style.height)).toBeCloseTo(0.246912);

            act(() => animationFrames.flush());

            expect(rendered.contentNode.style.paddingBottom).toBe("607px");
        } finally {
            window.getComputedStyle = originalGetComputedStyle;
            animationFrames.restore();
            act(() => renderer?.unmount());
        }
    });

    it("coalesces repeated scroll room and resets the spacer", () => {
        const animationFrames = installAnimationFrameQueue();
        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = ((element: HTMLElement) => element.style) as typeof window.getComputedStyle;
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            const rendered = renderPaddingAdjustment();
            renderer = rendered.renderer;
            expect(renderer.toJSON()).toBeNull();

            act(() => {
                set$(rendered.ctx, "scrollAdjust", -20.75);
            });
            rendered.contentNode.scrollHeight = 76723.5;
            rendered.ctx.state.scroll = 75924.75;
            act(() => {
                set$(rendered.ctx, "scrollAdjust", -20.25);
            });

            expect(rendered.contentNode.style.paddingBottom).toBe("607px");
            expect(rendered.spacer.style.height).toBe("1px");
            expect(rendered.spacer.style.display).toBe("block");
            expect(rendered.spacer.parentElement).toBe(rendered.contentNode);

            act(() => animationFrames.flush());

            expect(rendered.contentNode.style.paddingBottom).toBe("607px");
            expect(rendered.spacer.parentElement).toBeNull();
        } finally {
            window.getComputedStyle = originalGetComputedStyle;
            animationFrames.restore();
            act(() => renderer?.unmount());
        }
    });

    it("clears temporary range before reading a committed end target", () => {
        const animationFrames = installAnimationFrameQueue();
        const rendered = renderPaddingAdjustment();
        rendered.ctx.state.refScroller.current!.getMaxScrollOffset = () =>
            75924 + (rendered.spacer.parentElement ? Number.parseFloat(rendered.spacer.style.height) : 0);
        try {
            act(() => set$(rendered.ctx, "scrollAdjust", -20.75));
            expect(rendered.spacer.style.height).toBe("0.5px");
            expect(getCommittedWebEndOffset(rendered.ctx)).toBe(75924);
            expect(rendered.spacer.parentElement).toBeNull();
            act(() => animationFrames.flush());
            expect(getCommittedWebEndOffset(rendered.ctx)).toBe(75924);
        } finally {
            act(() => rendered.renderer.unmount());
            expect(rendered.ctx.clearTemporaryScrollAdjust).toBeUndefined();
            animationFrames.restore();
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

describe("shared owner scroll adjustments", () => {
    it("applies a list-local correction without confusing the parent's offset with the list's offset", () => {
        const { ctx, renderer, scrollElement } = renderPaddingAdjustment({ externalOffset: 300, scroll: 320 });
        act(() => {
            set$(ctx, "scrollAdjust", 20);
        });
        expect(scrollElement.scrollBy).toHaveBeenCalledWith({ behavior: "auto", left: 0, top: 20 });
        act(() => renderer.unmount());
    });
    for (const offset of [-200, 1500]) {
        it(`does not pull an offscreen list into view (local offset ${offset})`, () => {
            const { ctx, renderer, scrollElement } = renderPaddingAdjustment({ externalOffset: offset, scroll: 320 });
            act(() => {
                set$(ctx, "scrollAdjust", 20);
            });
            expect(scrollElement.scrollBy).not.toHaveBeenCalled();
            act(() => renderer.unmount());
        });
    }
});
