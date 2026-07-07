import { describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { getStickyPushLimit } from "@/components/stickyPositionUtils";
import { updateItemPositions } from "@/core/arrayLayout";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { getLayoutOffset, getLayoutSize } from "@/core/layoutAccessors";
import { prepareMVCP } from "@/core/mvcp";
import { syncMountedContainer } from "@/core/syncMountedContainer";
import { setupViewability, updateViewableItems } from "@/core/viewability";
import { peek$, set$ } from "@/state/state";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";
import { createMockContext } from "../__mocks__/createMockContext";

function createItems(count: number) {
    return Array.from({ length: count }, (_, index) => ({ id: `item-${index}` }));
}

function createLaidOutContext(sizes: number[]) {
    const data = createItems(sizes.length);
    const ctx = createMockContext(
        {
            numColumns: 1,
            totalSize: 0,
        },
        {
            props: {
                data,
                estimatedItemSize: 100,
                keyExtractor: (item?: { id: string }) => item?.id,
            },
            totalSize: 0,
        },
    );

    sizes.forEach((size, index) => {
        ctx.state.sizesKnown.set(`item-${index}`, size);
        ctx.state.sizes.set(`item-${index}`, size);
    });
    updateItemPositions(ctx, false, {
        doMVCP: false,
        scrollBottomBuffered: -1,
        startIndex: 0,
    });

    return ctx;
}

describe("current positions-backed layout behavior", () => {
    it("reads offset, size, total, and unknown rows from the current layout state", () => {
        const ctx = createLaidOutContext([40, 60, 125, 75]);

        expect(getLayoutOffset(ctx, 0)).toBe(0);
        expect(getLayoutOffset(ctx, 2)).toBe(100);
        expect(getLayoutSize(ctx, 2)).toBe(125);
        expect(ctx.state.totalSize).toBe(300);
        expect(calculateOffsetForIndex(ctx, 3)).toBe(225);
        expect(getLayoutOffset(ctx, 10)).toBeUndefined();
    });

    it("computes snap offsets from the current positions array for fixed and mixed-size rows", () => {
        const ctx = createLaidOutContext([40, 60, 125, 75]);
        ctx.state.props.snapToIndices = [0, 2, 3];

        updateSnapToOffsets(ctx);

        expect(peek$(ctx, "snapToOffsets")).toEqual([0, 100, 225]);
    });

    it("computes sticky push limits from the next sticky header position", () => {
        const ctx = createLaidOutContext([40, 60, 125, 75]);
        ctx.state.props.stickyHeaderIndicesArr = [1, 3];

        expect(getStickyPushLimit(ctx, 1, "item-1")).toBe(165);
    });

    it("computes viewability from current positions, sizes, and scroll padding", () => {
        const ctx = createLaidOutContext([100, 100, 100, 100]);
        const calls: any[] = [];
        const pairs = setupViewability({
            onViewableItemsChanged: (info) => calls.push(info),
            viewabilityConfig: {
                id: "visible",
                itemVisiblePercentThreshold: 50,
            },
        })!;
        ctx.state.scroll = 50;
        ctx.state.scrollLength = 150;
        set$(ctx, "numContainers", 3);
        set$(ctx, "containerItemKey0", "item-0");
        set$(ctx, "containerItemKey1", "item-1");
        set$(ctx, "containerItemKey2", "item-2");
        set$(ctx, "headerSize", 10);

        updateViewableItems(ctx, pairs, 150, 0, 2);

        expect(calls).toHaveLength(1);
        expect(calls[0].viewableItems).toEqual([
            expect.objectContaining({ index: 0, key: "item-0" }),
            expect.objectContaining({ index: 1, key: "item-1" }),
        ]);
        expect(calls[0].changed).toEqual([
            expect.objectContaining({ index: 0, isViewable: true, key: "item-0" }),
            expect.objectContaining({ index: 1, isViewable: true, key: "item-1" }),
        ]);
        expect(ctx.mapViewabilityAmountValues.get(0)).toEqual(
            expect.objectContaining({
                index: 0,
                isViewable: true,
                key: "item-0",
                percentVisible: 60,
            }),
        );
    });

    it("positions mounted containers from current positions after a measured size update", () => {
        const ctx = createLaidOutContext([100, 100, 100]);
        set$(ctx, "containerItemKey0", "item-2");

        let result = syncMountedContainer(ctx, 0, 2);

        expect(result.didChangePosition).toBe(true);
        expect(peek$(ctx, "containerPosition0")).toBe(200);

        ctx.state.sizesKnown.set("item-0", 150);
        updateItemPositions(ctx, false, {
            doMVCP: false,
            scrollBottomBuffered: -1,
            startIndex: 0,
        });

        result = syncMountedContainer(ctx, 0, 2);

        expect(result.didChangePosition).toBe(true);
        expect(peek$(ctx, "containerPosition0")).toBe(250);
    });

    it("computes MVCP anchor deltas from committed positions before and after layout updates", () => {
        const ctx = createLaidOutContext([100, 100, 100, 100]);
        ctx.state.didContainersLayout = true;
        ctx.state.idsInView = ["item-3"];
        ctx.state.props.maintainVisibleContentPosition.size = true;
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

        try {
            const adjust = prepareMVCP(ctx);

            ctx.state.sizesKnown.set("item-0", 150);
            updateItemPositions(ctx, false, {
                doMVCP: true,
                scrollBottomBuffered: -1,
                startIndex: 0,
            });
            adjust?.();

            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 50, undefined);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });
});
