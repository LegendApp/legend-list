import { describe, expect, it } from "bun:test";
import "../setup";

import { checkStructuralDataChange } from "../../src/core/checkStructuralDataChange";
import { syncMountedContainer } from "../../src/core/syncMountedContainer";
import { peek$, set$ } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("syncMountedContainer", () => {
    it("reuses cached equality results prepared before a later changed item", () => {
        const previousData = [
            { id: "item-1", label: "Alpha", version: 1 },
            { id: "item-2", label: "Beta", version: 1 },
        ];
        const nextData = [
            { id: "item-1", label: "Alpha", version: 2 },
            { id: "item-2", label: "Beta", version: 2 },
        ];
        let itemsAreEqualCalls = 0;
        const ctx = createMockContext(
            {},
            {
                idCache: ["item-1", "item-2"],
                previousData,
                props: {
                    data: nextData,
                    itemsAreEqual: (_previous, _next, index) => {
                        itemsAreEqualCalls += 1;
                        return index === 0;
                    },
                    keyExtractor: (item: { id: string }) => item.id,
                },
            },
        );

        const didChange = checkStructuralDataChange(ctx.state, nextData, previousData);
        set$(ctx, "containerItemKey0", "item-1");
        set$(ctx, "containerItemData0", previousData[0]);

        const result = syncMountedContainer(ctx, 0, 0, { updateLayout: false });

        expect(didChange).toBe(true);
        expect(result.didRefreshData).toBe(false);
        expect(itemsAreEqualCalls).toBe(2);
        expect(ctx.state.pendingDataComparison?.byIndex[0]).toBe(1);
        expect(ctx.state.pendingDataComparison?.byIndex[1]).toBe(2);
    });

    it("writes back an untouched fallback comparison so later syncs do not rerun itemsAreEqual", () => {
        const previousData = [
            { id: "item-1", label: "Alpha", version: 1 },
            { id: "item-2", label: "Beta", version: 1 },
        ];
        const nextData = [
            { id: "item-1", label: "Alpha changed", version: 2 },
            { id: "item-2", label: "Beta", version: 2 },
        ];
        let itemsAreEqualCalls = 0;
        const ctx = createMockContext(
            {},
            {
                idCache: ["item-1", "item-2"],
                previousData,
                props: {
                    data: nextData,
                    itemsAreEqual: (_previous, _next, index) => {
                        itemsAreEqualCalls += 1;
                        return index === 1;
                    },
                    keyExtractor: (item: { id: string }) => item.id,
                },
            },
        );

        const didChange = checkStructuralDataChange(ctx.state, nextData, previousData);
        set$(ctx, "containerItemKey0", "item-2");
        set$(ctx, "containerItemData0", previousData[1]);

        const firstResult = syncMountedContainer(ctx, 0, 1, { updateLayout: false });
        const secondResult = syncMountedContainer(ctx, 0, 1, { updateLayout: false });

        expect(didChange).toBe(true);
        expect(firstResult.didRefreshData).toBe(false);
        expect(secondResult.didRefreshData).toBe(false);
        expect(itemsAreEqualCalls).toBe(2);
        expect(ctx.state.pendingDataComparison?.byIndex[1]).toBe(1);
    });

    it("mirrors horizontal rtl container positions into physical space", () => {
        const ctx = createMockContext(
            {
                totalSize: 1000,
            },
            {
                idCache: ["item-0"],
                positions: [200],
                props: {
                    data: [{ id: "item-0" }],
                    horizontal: true,
                    keyExtractor: (item?: { id: string }) => item?.id,
                    rtl: true,
                },
            },
        );
        ctx.state.sizes.set("item-0", 50);
        set$(ctx, "containerItemKey0", "item-0");

        const result = syncMountedContainer(ctx, 0, 0);

        expect(result.didChangePosition).toBe(true);
        expect(peek$(ctx, "containerPosition0")).toBe(750);
    });
});
