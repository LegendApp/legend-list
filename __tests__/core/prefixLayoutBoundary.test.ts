import { getStickyPushLimit } from "@/components/stickyPositionUtils";
import * as updateItemPositionsModule from "@/core/arrayLayout";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import * as doScrollToModule from "@/core/doScrollTo";
import { prepareMVCP } from "@/core/mvcp";
import {
    setPrefixLayoutStoreMeasuredSize,
    syncPrefixLayoutStoreLayoutState,
    syncPrefixLayoutStoreStructure,
} from "@/core/prefixLayoutStoreLifecycle";
import { scrollTo } from "@/core/scrollTo";
import { syncMountedContainer } from "@/core/syncMountedContainer";
import * as updateScrollModule from "@/core/updateScroll";
import { peek$, set$ } from "@/state/state";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { describe, expect, it, mock, spyOn } from "bun:test";
import { createMockContext } from "../__mocks__/createMockContext";
import { countLayoutValues } from "../helpers/layoutArrays";

function createPrefixContext(options?: {
    drawDistance?: number;
    horizontal?: boolean;
    itemCount?: number;
    itemSize?: number;
    numContainers?: number;
    rtl?: boolean;
    scroll?: number;
    scrollLength?: number;
}) {
    const itemCount = options?.itemCount ?? 100;
    const itemSize = options?.itemSize ?? 50;
    const ctx = createMockContext(
        {
            headerSize: 0,
            numColumns: 1,
            numContainers: options?.numContainers ?? 10,
            stylePaddingTop: 0,
            totalSize: itemCount * itemSize,
        },
        {
            positions: [],
            props: {
                data: Array.from({ length: itemCount }, (_, index) => ({ id: index })),
                drawDistance: options?.drawDistance ?? 0,
                estimatedItemSize: itemSize,
                horizontal: !!options?.horizontal,
                rtl: options?.rtl,
            },
            scroll: options?.scroll ?? 0,
            scrollLength: options?.scrollLength ?? 300,
            totalSize: itemCount * itemSize,
        },
    );

    syncPrefixLayoutStoreStructure(ctx);
    syncPrefixLayoutStoreLayoutState(ctx);
    return ctx;
}

function expectPrefixPositionsEmpty(ctx: ReturnType<typeof createPrefixContext>) {
    expect(countLayoutValues(ctx.state.positions)).toBe(0);
}

describe("prefix layout hard boundary", () => {
    it("handles prefix first mount, snap offsets, sticky headers, and viewability without positions", () => {
        const viewabilityCalls: any[] = [];
        const ctx = createPrefixContext({
            drawDistance: 0,
            itemCount: 100,
            itemSize: 50,
            numContainers: 8,
            scroll: 100,
            scrollLength: 150,
        });
        const state = ctx.state;
        state.isFirst = true;
        state.props.snapToIndices = [0, 4, 10];
        state.props.stickyHeaderIndicesArr = [0, 4, 10];
        state.sizes.set("item_0", 50);
        state.viewabilityConfigCallbackPairs = [
            {
                onViewableItemsChanged: (info) => viewabilityCalls.push(info),
                viewabilityConfig: { id: "default", itemVisiblePercentThreshold: 1 },
            },
        ];
        const updateItemPositionsSpy = spyOn(updateItemPositionsModule, "updateItemPositions");

        try {
            calculateItemsInView(ctx, { dataChanged: true });

            expect(updateItemPositionsSpy).not.toHaveBeenCalled();
            expectPrefixPositionsEmpty(ctx);
            expect(peek$(ctx, "snapToOffsets")).toEqual([0, 200, 500]);
            expect(peek$(ctx, "activeStickyIndex")).toBe(0);
            expect(getStickyPushLimit(ctx, 0, "item_0")).toBe(150);
            expect(viewabilityCalls).toHaveLength(1);
            expect(viewabilityCalls[0].viewableItems.map((token: any) => token.index)).toEqual([2, 3, 4]);
        } finally {
            updateItemPositionsSpy.mockRestore();
        }
    });

    it("pins scroll targets and positions mounted containers from the prefix store without positions", () => {
        const ctx = createPrefixContext({
            itemCount: 1000,
            itemSize: 40,
            scrollLength: 120,
        });
        const doScrollToSpy = spyOn(doScrollToModule, "doScrollTo").mockImplementation(() => undefined);
        const updateScrollSpy = spyOn(updateScrollModule, "updateScroll").mockImplementation(() => undefined);
        const triggerCalculateItemsInView = mock(() => undefined);
        ctx.state.triggerCalculateItemsInView = triggerCalculateItemsInView;

        try {
            scrollTo(ctx, {
                animated: true,
                index: 20,
                itemSize: 40,
                offset: 800,
            });

            expect(ctx.state.scrollTargetPinnedRange).toEqual({
                end: 23,
                start: 20,
            });
            expect(triggerCalculateItemsInView).toHaveBeenCalledWith();
            expect(updateScrollSpy).not.toHaveBeenCalled();
            expect(doScrollToSpy).toHaveBeenCalledWith(ctx, {
                animated: true,
                horizontal: false,
                isInitialScroll: undefined,
                offset: 800,
            });

            set$(ctx, "containerItemKey0", "item_20");
            const result = syncMountedContainer(ctx, 0, 20);

            expect(result.didChangePosition).toBe(true);
            expect(peek$(ctx, "containerPosition0")).toBe(800);
            expectPrefixPositionsEmpty(ctx);
        } finally {
            doScrollToSpy.mockRestore();
            updateScrollSpy.mockRestore();
        }
    });

    it("supports horizontal prefix offsets and physical RTL container positions without positions", () => {
        const ctx = createPrefixContext({
            horizontal: true,
            itemCount: 10,
            itemSize: 50,
            rtl: true,
            scrollLength: 150,
        });
        const doScrollToSpy = spyOn(doScrollToModule, "doScrollTo").mockImplementation(() => undefined);

        try {
            scrollTo(ctx, {
                animated: true,
                index: 4,
                itemSize: 50,
                offset: 200,
            });

            expect(doScrollToSpy).toHaveBeenCalledWith(ctx, {
                animated: true,
                horizontal: true,
                isInitialScroll: undefined,
                offset: 200,
            });

            set$(ctx, "containerItemKey0", "item_4");
            const result = syncMountedContainer(ctx, 0, 4);

            expect(result.didChangePosition).toBe(true);
            expect(peek$(ctx, "containerPosition0")).toBe(250);
            expect(ctx.state.layoutStoreRuntime?.store.getOffset(4)).toBe(200);
            expectPrefixPositionsEmpty(ctx);
        } finally {
            doScrollToSpy.mockRestore();
        }
    });

    it("keeps MVCP accurate after an index 0 prefix measurement update without positions", () => {
        const ctx = createPrefixContext({
            itemCount: 20,
            itemSize: 100,
            scrollLength: 300,
        });
        const state = ctx.state;
        state.didContainersLayout = true;
        state.idsInView = ["item_5"];
        state.indexByKey.set("item_5", 5);
        state.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

        try {
            const adjust = prepareMVCP(ctx);
            setPrefixLayoutStoreMeasuredSize(ctx, 0, 150);

            adjust?.();

            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 50, undefined);
            expect(state.layoutStoreRuntime?.store.getOffset(5)).toBe(550);
            expect(state.totalSize).toBe(2050);
            expectPrefixPositionsEmpty(ctx);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });
});
