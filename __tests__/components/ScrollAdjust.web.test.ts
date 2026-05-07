import { describe, expect, it, mock } from "bun:test";
import { getScrollAdjustAxis, resolveScrollAdjustContentNode } from "../../src/components/ScrollAdjust?web-behavior";

function createElementLike(parentElement: unknown, isConnected = true) {
    return {
        isConnected,
        parentElement,
    } as HTMLElement;
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

        expect(resolveScrollAdjustContentNode(scrollElement, contentNode)).toBe(contentNode);
        expect(scrollElement.querySelector).not.toHaveBeenCalled();
    });

    it("queries only direct content-container children when there is no usable cached node", () => {
        const contentNode = createElementLike(null);
        const scrollElement = {
            querySelector: mock(() => contentNode),
        } as unknown as HTMLElement;

        expect(resolveScrollAdjustContentNode(scrollElement, null)).toBe(contentNode);
        expect(scrollElement.querySelector).toHaveBeenCalledWith(":scope > .legend-list-content-container");
    });

    it("queries again when the cached node is disconnected or belongs to another parent", () => {
        const nextContentNode = createElementLike(null);
        const scrollElement = {
            querySelector: mock(() => nextContentNode),
        } as unknown as HTMLElement;
        const disconnectedNode = createElementLike(scrollElement, false);
        const otherParentNode = createElementLike({});

        expect(resolveScrollAdjustContentNode(scrollElement, disconnectedNode)).toBe(nextContentNode);
        expect(resolveScrollAdjustContentNode(scrollElement, otherParentNode)).toBe(nextContentNode);
        expect(scrollElement.querySelector).toHaveBeenCalledTimes(2);
    });
});
