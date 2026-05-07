import { beforeEach, describe, expect, it, mock } from "bun:test";
import { maybeUpdateAnchoredEndSpace } from "../../src/core/updateAnchoredEndSpace";
import { updateItemSize } from "../../src/core/updateItemSize";
import { getContentInsetEnd } from "../../src/state/getContentInsetEnd";
import { peek$, type StateContext, set$ } from "../../src/state/state";
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
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(100);
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
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(0);
        expect(onSizeChanged).toHaveBeenLastCalledWith(0);
    });

    it("uses anchored end space as a minimum end inset with additive adjustments", () => {
        mockState.props.contentInset = { bottom: 20, left: 0, right: 0, top: 0 };
        mockState.props.contentInsetEndAdjustment = 40;
        set$(mockCtx, "anchoredEndSpaceSize", 50);
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            includeInEndInset: true,
        };

        expect(getContentInsetEnd(mockCtx)).toBe(60);

        mockState.contentInsetOverride = { bottom: 30 };

        expect(getContentInsetEnd(mockCtx)).toBe(70);

        mockState.contentInsetOverride = { bottom: 80 };

        expect(getContentInsetEnd(mockCtx)).toBe(120);

        mockState.contentInsetOverride = undefined;
        mockState.props.contentInsetEndAdjustment = 90;

        expect(getContentInsetEnd(mockCtx)).toBe(110);
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

        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(70);
        expect(onSizeChanged).toHaveBeenLastCalledWith(70);
    });

    it("subtracts footer size and bottom padding from the required anchored end space", () => {
        const onSizeChanged = mock(() => {});
        mockCtx.values.set("footerSize", 24);
        mockState.props.stylePaddingBottom = 16;
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(60);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(60);
        expect(onSizeChanged).toHaveBeenCalledWith(60);
    });

    it("subtracts anchorOffset from the required anchored end space", () => {
        const onSizeChanged = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            anchorOffset: 24,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(76);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(76);
        expect(onSizeChanged).toHaveBeenCalledWith(76);
    });

    it("clamps anchored end space at zero when anchorOffset exceeds the remaining blank space", () => {
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            anchorOffset: 120,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(0);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(0);
    });

    it("caps the anchor item's contribution using anchorMaxSize", () => {
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            anchorMaxSize: 40,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(180);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(180);
    });

    it("clamps negative anchorMaxSize to zero before calculating anchored end space", () => {
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            anchorMaxSize: -20,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(220);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(220);
    });

    it("combines anchorMaxSize and anchorOffset", () => {
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            anchorMaxSize: 40,
            anchorOffset: 16,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(164);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(164);
    });
});
