import { describe, expect, it } from "bun:test";
import "../setup";

import { createLayoutEngine } from "@/core/LayoutEngine";
import { reconcileLayoutEngineOffsetRange } from "@/core/layoutEngineRange";
import { syncPrefixLayoutStoreStructure } from "@/core/prefixLayoutStoreLifecycle";
import { listenPosition$ } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";
import { countLayoutValues } from "../helpers/layoutArrays";

describe("layout engine range reconciliation", () => {
    it("reconciles prefix identity and size caches without writing positions", () => {
        const ctx = createMockContext(
            {
                numColumns: 1,
                readyToRender: true,
            },
            {
                props: {
                    data: Array.from({ length: 100 }, (_, index) => ({ id: `item-${index}` })),
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                    numColumns: 1,
                },
            },
        );
        syncPrefixLayoutStoreStructure(ctx);
        const engine = createLayoutEngine(ctx);

        const range = reconcileLayoutEngineOffsetRange(ctx, engine, 250, 450);

        expect(range).toEqual({ end: 4, start: 2 });
        expect(ctx.state.indexByKey.get("item-2")).toBe(2);
        expect(ctx.state.indexByKey.get("item-4")).toBe(4);
        expect(ctx.state.sizes.get("item-2")).toBe(100);
        expect(countLayoutValues(ctx.state.positions)).toBe(0);
    });

    it("notifies prefix position listeners once for unchanged offsets", () => {
        const ctx = createMockContext(
            {
                numColumns: 1,
                readyToRender: true,
            },
            {
                props: {
                    data: Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` })),
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                    numColumns: 1,
                },
            },
        );
        syncPrefixLayoutStoreStructure(ctx);
        const engine = createLayoutEngine(ctx);
        const updates: number[] = [];
        listenPosition$(ctx, "item-3", (position) => {
            updates.push(position as number);
        });

        reconcileLayoutEngineOffsetRange(ctx, engine, 0, 500);
        reconcileLayoutEngineOffsetRange(ctx, engine, 0, 500);

        expect(updates).toEqual([300]);
        expect(countLayoutValues(ctx.state.positions)).toBe(0);
    });
});
