import { describe, expect, it, mock } from "bun:test";
import {
    getScrollAdjustAxis,
    getScrollAdjustTarget,
    scrollAdjustBy,
} from "../../src/components/ScrollAdjust?web-behavior";

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
    } as any;
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
});
