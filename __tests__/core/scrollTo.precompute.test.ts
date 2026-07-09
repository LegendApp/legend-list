import { describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { calculateItemsInView } from "@/core/calculateItemsInView";
import * as doScrollToModule from "@/core/doScrollTo";
import { scrollTo } from "@/core/scrollTo";
import type { ViewToken } from "@/types.base";
import { createMockContext } from "../__mocks__/createMockContext";

type TestItem = {
    id: string;
    label: string;
};

const ITEM_SIZE = 100;
const VIEWPORT_SIZE = 200;

function createItems(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        id: `item-${index}`,
        label: `Item ${index}`,
    }));
}

function createPrecomputeContext(options?: {
    props?: Record<string, unknown>;
    viewabilityCalls?: Array<{ viewableItems: ViewToken<TestItem>[] }>;
}) {
    const data = createItems(30);
    const ctx = createMockContext(
        {
            headerSize: 0,
            numColumns: 1,
            numContainers: 5,
            numContainersPooled: 5,
            stylePaddingTop: 0,
        },
        {
            props: {
                data,
                drawDistance: 0,
                estimatedItemSize: ITEM_SIZE,
                getFixedItemSize: () => ITEM_SIZE,
                keyExtractor: (item: TestItem) => item.id,
                ...(options?.props ?? {}),
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollLength: VIEWPORT_SIZE,
            totalSize: data.length * ITEM_SIZE,
        },
    );

    if (options?.viewabilityCalls) {
        ctx.state.viewabilityConfigCallbackPairs = [
            {
                onViewableItemsChanged: (info: { viewableItems: ViewToken<TestItem>[] }) => {
                    options.viewabilityCalls!.push(info);
                },
                viewabilityConfig: {
                    id: "imperative-scroll-precompute",
                    itemVisiblePercentThreshold: 50,
                },
            },
        ];
    }

    ctx.state.triggerCalculateItemsInView = (params) => calculateItemsInView(ctx, params);
    calculateItemsInView(ctx, { dataChanged: true });

    return ctx;
}

describe("scrollTo non-animated precompute integration", () => {
    it("calculates the target window before native onScroll arrives", () => {
        const ctx = createPrecomputeContext();

        scrollTo(ctx, {
            animated: false,
            index: 10,
            itemSize: ITEM_SIZE,
            offset: 10 * ITEM_SIZE,
        });

        expect(ctx.state.scroll).toBe(1000);
        expect(ctx.state.startNoBuffer).toBe(10);
        expect(ctx.state.endNoBuffer).toBe(12);
    });

    it("reports the target viewable range once and does not repeat it for the matching native onScroll", () => {
        const viewabilityCalls: Array<{ viewableItems: ViewToken<TestItem>[] }> = [];
        const ctx = createPrecomputeContext({ viewabilityCalls });
        viewabilityCalls.length = 0;

        scrollTo(ctx, {
            animated: false,
            index: 10,
            itemSize: ITEM_SIZE,
            offset: 10 * ITEM_SIZE,
        });

        expect(viewabilityCalls).toHaveLength(1);
        expect(viewabilityCalls[0].viewableItems.map((token) => token.index)).toEqual([10, 11]);

        ctx.state.triggerCalculateItemsInView?.({ doMVCP: true });

        expect(viewabilityCalls).toHaveLength(1);
    });

    it("fires onEndReached once for a non-animated jump to the end threshold", () => {
        const endReachedCalls: Array<{ distanceFromEnd: number }> = [];
        const ctx = createPrecomputeContext({
            props: {
                onEndReached: (info: { distanceFromEnd: number }) => {
                    endReachedCalls.push(info);
                },
                onEndReachedThreshold: 0.1,
            },
        });
        endReachedCalls.length = 0;

        scrollTo(ctx, {
            animated: false,
            index: 28,
            itemSize: ITEM_SIZE,
            offset: 28 * ITEM_SIZE,
        });

        expect(endReachedCalls).toEqual([{ distanceFromEnd: 0 }]);

        ctx.state.triggerCalculateItemsInView?.({ doMVCP: true });

        expect(endReachedCalls).toEqual([{ distanceFromEnd: 0 }]);
    });

    it("updates sticky header state for the target range before native onScroll arrives", () => {
        const stickyCalls: Array<{ index: number; item: TestItem }> = [];
        const ctx = createPrecomputeContext({
            props: {
                onStickyHeaderChange: (info: { index: number; item: TestItem }) => {
                    stickyCalls.push(info);
                },
                stickyHeaderIndicesArr: [0, 10, 20],
                stickyHeaderIndicesSet: new Set([0, 10, 20]),
            },
        });
        stickyCalls.length = 0;

        scrollTo(ctx, {
            animated: false,
            index: 12,
            itemSize: ITEM_SIZE,
            offset: 12 * ITEM_SIZE,
        });

        expect(ctx.state.activeStickyIndex).toBe(10);
        expect(stickyCalls).toEqual([{ index: 10, item: { id: "item-10", label: "Item 10" } }]);
    });

    it("does not precompute animated scrolls", () => {
        const ctx = createPrecomputeContext();

        scrollTo(ctx, {
            animated: true,
            index: 10,
            itemSize: ITEM_SIZE,
            offset: 10 * ITEM_SIZE,
        });

        expect(ctx.state.scroll).toBe(0);
        expect(ctx.state.startNoBuffer).toBe(0);
    });

    it("does not issue native scroll in the precompute step", () => {
        const ctx = createPrecomputeContext();
        const doScrollToSpy = spyOn(doScrollToModule, "doScrollTo").mockImplementation(() => undefined);

        try {
            scrollTo(ctx, {
                animated: false,
                index: 10,
                itemSize: ITEM_SIZE,
                offset: 10 * ITEM_SIZE,
            });

            expect(doScrollToSpy).toHaveBeenCalledTimes(1);
        } finally {
            doScrollToSpy.mockRestore();
        }
    });
});
