import { beforeEach, describe, expect, it, mock } from "bun:test";
import { getScrollRangeEnd } from "../../src/core/clampScrollOffset";
import { getNativeScrollPoint } from "../../src/core/doScrollParams";
import { onScroll } from "../../src/core/onScroll";
import { maybeUpdateAnchoredEndSpace } from "../../src/core/updateAnchoredEndSpace";
import { setContentInsetOverride, setFooterSize } from "../../src/core/updateContentMetrics";
import { updateItemPositions } from "../../src/core/updateItemPositions";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
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

    it.each([0, 24])("keeps the list-owned anchor at offset %i with a native bottom inset", (offset) => {
        const previousPlatform = Platform.OS;
        Platform.OS = "ios";
        try {
            mockState.props.anchoredEndSpace = { anchorIndex: 1, anchorOffset: offset };
            mockState.props.anchoredEndSpaceOwner = "list";
            mockState.props.contentInset = { bottom: 40, left: 0, right: 0, top: 0 };
            mockState.positions = [0, 100, 220];
            mockState.totalSize = 300;
            set$(mockCtx, "totalSize", 300);

            maybeUpdateAnchoredEndSpace(mockCtx);

            expect(mockState.positions[1]! - getScrollRangeEnd(mockCtx)).toBe(offset);
            expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(60 - offset);
        } finally {
            Platform.OS = previousPlatform;
            mockState.scheduledWork.dispose();
        }
    });

    it.each([
        { inset: 86, platform: "ios" },
        { inset: 0, platform: "ios" },
        { inset: 86, platform: "android" },
    ] as const)(
        "preserves stable RTL anchor space and offsets on $platform with inset $inset",
        ({ platform, inset }) => {
            const previousPlatform = Platform.OS;
            Platform.OS = platform;
            const onSizeChanged = mock();
            const ctx = createMockContext(
                { numColumns: 1, otherAxisSize: 100, readyToRender: true },
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    horizontalRTLScrollType: "inverted",
                    props: {
                        anchoredEndSpace: { anchorIndex: 9, onSizeChanged },
                        anchoredEndSpaceOwner: "list",
                        contentInset: { bottom: 0, left: inset, right: 0, top: 0 },
                        data: Array.from({ length: 10 }, (_, id) => ({ id: String(id) })),
                        estimatedItemSize: 100,
                        getFixedItemSize: () => 100,
                        horizontal: true,
                        keyExtractor: (item: { id: string }) => item.id,
                        rtl: true,
                    },
                    queuedInitialLayout: true,
                    scrollLength: 600,
                },
            );
            try {
                updateItemPositions(ctx, true);
                expect(maybeUpdateAnchoredEndSpace(ctx)).toBe(500);
                expect(maybeUpdateAnchoredEndSpace(ctx)).toBe(500);
                expect(onSizeChanged).toHaveBeenCalledTimes(1);
                expect(onSizeChanged).toHaveBeenCalledWith(500);

                const point = getNativeScrollPoint(ctx, 300);
                onScroll(ctx, {
                    nativeEvent: {
                        contentInset: { bottom: 0, left: platform === "ios" ? inset : 0, right: 0, top: 0 },
                        contentOffset: point,
                        contentSize: { height: 100, width: ctx.state.totalSize + peek$(ctx, "anchoredEndSpaceSize") },
                        layoutMeasurement: { height: 100, width: 600 },
                    },
                } as any);
                expect(point.x).toBe(600);
                expect(ctx.state.scroll).toBe(300);
                expect(onSizeChanged).toHaveBeenCalledTimes(1);
            } finally {
                Platform.OS = previousPlatform;
                ctx.state.scheduledWork.dispose();
            }
        },
    );

    it.each(["override", "native observation"])(
        "keeps the list-owned anchor current when its end inset changes by %s",
        (source) => {
            const previousPlatform = Platform.OS;
            Platform.OS = "ios";
            try {
                mockState.props.anchoredEndSpace = { anchorIndex: 1 };
                mockState.props.anchoredEndSpaceOwner = "list";
                if (source === "native observation") mockState.props.contentInset = undefined;
                mockState.positions = [0, 100, 220];
                mockState.totalSize = 300;
                mockState.scroll = mockState.scrollPending = 100;
                set$(mockCtx, "totalSize", 300);
                set$(mockCtx, "isWithinMaintainScrollAtEndThreshold", true);
                expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);

                if (source === "override") {
                    setContentInsetOverride(mockCtx, { bottom: 40 });
                } else {
                    onScroll(mockCtx, {
                        nativeEvent: {
                            contentInset: { bottom: 40, left: 0, right: 0, top: 0 },
                            contentOffset: { x: 0, y: 100 },
                            contentSize: { height: 400, width: 300 },
                            layoutMeasurement: { height: 300, width: 300 },
                        },
                    } as any);
                }

                expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(60);
                expect(mockState.positions[1]! - getScrollRangeEnd(mockCtx)).toBe(0);
                expect(mockState.scroll).toBe(100);
            } finally {
                Platform.OS = previousPlatform;
                mockState.scheduledWork.dispose();
            }
        },
    );

    it("computes anchored end space and reports readiness once for the committed anchor", () => {
        const onSizeChanged = mock(() => {});
        const onReady = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onReady,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onSizeChanged).toHaveBeenCalledWith(100);
        expect(onReady).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledWith({ anchorIndex: 1, anchorKey: "item_1", size: 100 });

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it("reports readiness when anchorIndex changes even if the anchored end space size is unchanged", () => {
        const onSizeChanged = mock(() => {});
        const onReady = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onReady,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledTimes(1);

        mockState.sizesKnown.set("item_0", 0);
        mockState.props.anchoredEndSpace = {
            anchorIndex: 0,
            onReady,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledTimes(2);
        expect(onReady).toHaveBeenLastCalledWith({ anchorIndex: 0, anchorKey: "item_0", size: 100 });
    });

    it("clears anchored end space to zero when the anchor becomes invalid", () => {
        const onSizeChanged = mock(() => {});
        const onReady = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onReady,
            onSizeChanged,
        };

        maybeUpdateAnchoredEndSpace(mockCtx);

        mockState.props.anchoredEndSpace = {
            anchorIndex: -1,
            onReady,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(0);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(0);
        expect(onSizeChanged).toHaveBeenLastCalledWith(0);
        expect(onReady).toHaveBeenLastCalledWith({ anchorIndex: -1, anchorKey: undefined, size: 0 });
    });

    it("uses scroll-owned anchored space as a minimum end inset with additive adjustments", () => {
        mockState.props.anchoredEndSpaceOwner = "scroll";
        mockState.props.contentInset = { bottom: 20, left: 0, right: 0, top: 0 };
        mockState.props.contentInsetEndAdjustment = 40;
        set$(mockCtx, "anchoredEndSpaceSize", 50);
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
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

    it("recomputes once after all item sizes in a committed batch are applied", () => {
        const onSizeChanged = mock(() => {});
        const onReady = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onReady,
            onSizeChanged,
        };
        mockState.props.onItemSizeChanged = undefined;
        mockState.didContainersLayout = true;
        mockState.endBuffered = 2;
        mockState.startBuffered = 0;
        mockState.sizes.set("item_1", 120);
        mockState.sizes.set("item_2", 80);

        maybeUpdateAnchoredEndSpace(mockCtx);
        onSizeChanged.mockClear();
        onReady.mockClear();
        updateItemSizesBatch(mockCtx, [
            { itemKey: "item_1", size: { height: 150, width: 100 } },
            { itemKey: "item_2", size: { height: 100, width: 100 } },
        ]);

        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(50);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onSizeChanged).toHaveBeenCalledWith(50);
        expect(onReady).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledWith({ anchorIndex: 1, anchorKey: "item_1", size: 50 });
    });

    it("becomes ready when the tail is first measured at exactly its estimated size", () => {
        const onSizeChanged = mock(() => {});
        const onReady = mock(() => {});
        mockState.props.anchoredEndSpace = { anchorIndex: 1, onReady, onSizeChanged };
        mockState.props.estimatedItemSize = 80;
        mockState.props.onItemSizeChanged = undefined;
        mockState.didContainersLayout = true;
        mockState.sizesKnown.delete("item_2");

        maybeUpdateAnchoredEndSpace(mockCtx);
        expect(onReady).not.toHaveBeenCalled();

        updateItemSizesBatch(mockCtx, [{ itemKey: "item_2", size: { height: 80, width: 100 } }]);

        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledWith(100);
        expect(onReady).toHaveBeenCalledWith({ anchorIndex: 1, anchorKey: "item_1", size: 100 });
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

    it("recomputes once when the footer size changes and ignores repeated measurements", () => {
        const onSizeChanged = mock(() => {});
        const onReady = mock(() => {});
        const triggerCalculateItemsInView = mock(() => {});
        mockState.props.anchoredEndSpace = { anchorIndex: 1, onReady, onSizeChanged };
        mockState.triggerCalculateItemsInView = triggerCalculateItemsInView;

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        onSizeChanged.mockClear();
        onReady.mockClear();
        triggerCalculateItemsInView.mockClear();

        expect(setFooterSize(mockCtx, 24)).toBe(true);

        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(76);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onSizeChanged).toHaveBeenCalledWith(76);
        expect(onReady).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledWith({ anchorIndex: 1, anchorKey: "item_1", size: 76 });
        expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);

        expect(setFooterSize(mockCtx, 24)).toBe(false);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledTimes(1);
        expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
    });

    it("refreshes scroll geometry without marking anchored end-space changes as user scrolls", () => {
        const triggerCalculateItemsInView = mock(() => {});
        mockState.hasScrolled = false;
        mockState.props.anchoredEndSpace = { anchorIndex: 1 };
        mockState.triggerCalculateItemsInView = triggerCalculateItemsInView;

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
        expect(mockState.hasScrolled).toBe(false);

        triggerCalculateItemsInView.mockClear();
        mockState.props.anchoredEndSpace = undefined;

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(0);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(0);
        expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
        expect(mockState.hasScrolled).toBe(false);

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(0);
        expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
    });

    it("replaces alignItemsAtEnd padding instead of stacking with it", () => {
        mockState.props.data = [{ id: "item_0" }];
        mockState.props.alignItemsAtEndPaddingEnabled = true;
        mockState.props.anchoredEndSpace = { anchorIndex: 0 };
        mockState.totalSize = 100;
        mockState.sizesKnown.set("item_0", 100);
        set$(mockCtx, "alignItemsAtEndPadding", 200);

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(200);
        expect(peek$(mockCtx, "alignItemsAtEndPadding")).toBe(0);
    });

    it("uses logical end padding for horizontal LTR and RTL lists", () => {
        mockState.props.horizontal = true;
        mockState.props.stylePaddingLeft = 10;
        mockState.props.stylePaddingRight = 30;
        mockState.props.anchoredEndSpace = { anchorIndex: 1 };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(70);

        mockState.props.rtl = true;

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(90);
    });

    it("excludes the trailing scroll-axis gap removed by the containers layer", () => {
        mockCtx.scrollAxisGap = 8;
        mockState.props.anchoredEndSpace = { anchorIndex: 1 };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(108);
    });

    it("keeps the previous anchored end space while tail item sizes are unknown", () => {
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
        };
        set$(mockCtx, "anchoredEndSpaceSize", 50);
        mockState.sizesKnown.delete("item_2");

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(50);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(50);

        mockState.sizesKnown.set("item_2", 80);

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(100);
    });

    it("shrinks stale anchored end space to the largest value allowed by known tail sizes", () => {
        const onReady = mock(() => {});
        const onSizeChanged = mock(() => {});
        const triggerCalculateItemsInView = mock(() => {});
        mockState.hasScrolled = false;
        mockState.props.anchoredEndSpace = { anchorIndex: 1, onReady, onSizeChanged };
        mockState.sizesKnown.delete("item_2");
        mockState.triggerCalculateItemsInView = triggerCalculateItemsInView;
        set$(mockCtx, "anchoredEndSpaceSize", 250);

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(180);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(180);
        expect(onSizeChanged).toHaveBeenCalledWith(180);
        expect(onReady).not.toHaveBeenCalled();
        expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
        expect(mockState.hasScrolled).toBe(false);
    });

    it("reports readiness once when the measured tail confirms a provisional zero-sized space", () => {
        const onReady = mock(() => {});
        const onSizeChanged = mock(() => {});
        mockState.props.anchoredEndSpace = { anchorIndex: 1, onReady, onSizeChanged };
        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        onReady.mockClear();
        onSizeChanged.mockClear();

        mockState.props.data = [...mockState.props.data, { id: "item_3" }];
        mockState.sizesKnown.set("item_1", 300);
        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(0);
        expect(onSizeChanged).toHaveBeenCalledWith(0);
        expect(onReady).not.toHaveBeenCalled();

        mockState.sizesKnown.set("item_3", 80);
        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(0);
        expect(onReady).toHaveBeenCalledWith({ anchorIndex: 1, anchorKey: "item_1", size: 0 });
        maybeUpdateAnchoredEndSpace(mockCtx);
        expect(onReady).toHaveBeenCalledTimes(1);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
    });

    it("waits for an authoritative tail size before reporting an initial zero-sized space", () => {
        const onReady = mock(() => {});
        const onSizeChanged = mock(() => {});
        const triggerCalculateItemsInView = mock(() => {});
        mockState.props.anchoredEndSpace = { anchorIndex: 1, onReady, onSizeChanged };
        mockState.sizesKnown.delete("item_2");
        mockState.triggerCalculateItemsInView = triggerCalculateItemsInView;

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(0);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBeUndefined();
        expect(onSizeChanged).not.toHaveBeenCalled();
        expect(onReady).not.toHaveBeenCalled();
        expect(triggerCalculateItemsInView).not.toHaveBeenCalled();
    });

    it("reports readiness when unknown tail item sizes become measurable", () => {
        const onSizeChanged = mock(() => {});
        const onReady = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onReady,
            onSizeChanged,
        };
        mockState.anchoredEndSpaceReadyAnchorIndex = 1;
        mockState.anchoredEndSpaceReadyAnchorKey = "item_1";
        set$(mockCtx, "anchoredEndSpaceSize", 50);
        mockState.sizesKnown.delete("item_2");

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(50);
        expect(onSizeChanged).not.toHaveBeenCalled();
        expect(onReady).not.toHaveBeenCalled();

        mockState.sizesKnown.set("item_2", 80);

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(peek$(mockCtx, "anchoredEndSpaceSize")).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledWith(100);
        expect(onReady).toHaveBeenCalledWith({ anchorIndex: 1, anchorKey: "item_1", size: 100 });
    });

    it("does not report readiness for a new anchor while reusing stale size from an unmeasured tail", () => {
        const onSizeChanged = mock(() => {});
        const onReady = mock(() => {});
        mockState.props.anchoredEndSpace = {
            anchorIndex: 1,
            onReady,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(onReady).toHaveBeenCalledTimes(1);

        mockState.sizesKnown.set("item_0", 0);
        mockState.sizesKnown.delete("item_2");
        mockState.props.anchoredEndSpace = {
            anchorIndex: 0,
            onReady,
            onSizeChanged,
        };

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledTimes(1);
        expect(mockState.anchoredEndSpaceReadyAnchorIndex).toBe(1);
        expect(mockState.anchoredEndSpaceReadyAnchorKey).toBe("item_1");

        mockState.sizesKnown.set("item_2", 80);

        expect(maybeUpdateAnchoredEndSpace(mockCtx)).toBe(100);
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledTimes(2);
        expect(onReady).toHaveBeenLastCalledWith({ anchorIndex: 0, anchorKey: "item_0", size: 100 });
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
