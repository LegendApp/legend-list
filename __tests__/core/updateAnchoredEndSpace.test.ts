import { beforeEach, describe, expect, it, mock } from "bun:test";
import { maybeUpdateAnchoredEndSpace } from "../../src/core/updateAnchoredEndSpace";
import { updateItemSize } from "../../src/core/updateItemSize";
import { getContentInsetEnd } from "../../src/state/getContentInsetEnd";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateAnchoredEndSpace", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        mockCtx = createMockContext(
            {},
            {
                indexByKey: new Map([
                    ["item_0", 0],
                    ["item_1", 1],
                    ["item_2", 2],
                ]),
                props: {
                    data: [{ id: "item_0" }, { id: "item_1" }, { id: "item_2" }],
                    keyExtractor: (item: { id: string }) => item.id,
                },
                scrollLength: 300,
            },
        );
        mockState = mockCtx.state;
        mockState.sizesKnown.set("item_0", 100);
        mockState.sizesKnown.set("item_1", 120);
        mockState.sizesKnown.set("item_2", 80);
    });

    it("computes anchored end space and only reports when the size changes", () => {
        const onSizeChanged = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(mockState.anchoredEndSpaceSize).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onSizeChanged).toHaveBeenCalledWith(100);

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
    });

    it("clears anchored end space to zero when the anchor becomes invalid", () => {
        const onSizeChanged = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onSizeChanged,
        };

        maybeUpdateAnchoredEndSpace(mockCtx);

        mockState.props.anchoredEndSpace = {
            anchorIndex: -1,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(0);
        expect(mockState.anchoredEndSpaceSize).toBe(0);
        expect(onSizeChanged).toHaveBeenLastCalledWith(0);
    });

    it("includes anchored end space in the end inset using max semantics", () => {
        mockState.props.contentInset = { bottom: 20, left: 0, right: 0, top: 0 };
        mockState.contentInsetOverride = { bottom: 30 };
        mockState.anchoredEndSpaceSize = 50;
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            includeInEndInset: true,
        };

        expect(getContentInsetEnd(mockState)).toBe(50);

        mockState.contentInsetOverride = { bottom: 80 };

        expect(getContentInsetEnd(mockState)).toBe(80);
    });

    it("recomputes when item sizes change through updateItemSize", () => {
        const onSizeChanged = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onSizeChanged,
        };
        mockState.props.onItemSizeChanged = undefined;
        mockState.didContainersLayout = true;
        mockState.endBuffered = 2;
        mockState.startBuffered = 0;
        mockState.sizes.set("item_1", 120);

        maybeUpdateAnchoredEndSpace(mockCtx);
        updateItemSize(mockCtx, "item_1", { height: 150, width: 100 });

        expect(mockState.anchoredEndSpaceSize).toBe(70);
        expect(onSizeChanged).toHaveBeenLastCalledWith(70);
    });
});
