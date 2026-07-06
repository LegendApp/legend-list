import { describe, expect, it } from "bun:test";
import "../setup";

import { PrefixLayoutEngine } from "@/core/PrefixLayoutEngine";
import { syncPrefixLayoutStoreStructure } from "@/core/prefixLayoutStoreLifecycle";
import { listenPosition$ } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";
import type { CreateLayoutEngineHarness } from "../helpers/layoutEngineContract";
import { runLayoutEngineContract } from "../helpers/layoutEngineContract";

function createItems(count: number) {
    return Array.from({ length: count }, (_, index) => ({ id: `item-${index}` }));
}

const createPrefixLayoutHarness: CreateLayoutEngineHarness = ({ estimatedItemSize = 100, sizes }) => {
    const ctx = createMockContext(
        {
            numColumns: 1,
            readyToRender: true,
            totalSize: 0,
        },
        {
            props: {
                data: createItems(sizes.length),
                estimatedItemSize,
                keyExtractor: (item: { id: string }) => item.id,
                numColumns: 1,
            },
            totalSize: 0,
        },
    );
    const store = syncPrefixLayoutStoreStructure(ctx)!;

    sizes.forEach((size, index) => {
        if (size !== undefined) {
            store.setMeasuredSize(index, size);
            ctx.state.sizesKnown.set(`item-${index}`, size);
            ctx.state.sizes.set(`item-${index}`, size);
        }
    });

    return {
        engine: new PrefixLayoutEngine(ctx, store),
        updateFrom() {},
    };
};

runLayoutEngineContract("PrefixLayoutEngine", createPrefixLayoutHarness);

describe("PrefixLayoutEngine", () => {
    it("reports prefix layout kind", () => {
        const harness = createPrefixLayoutHarness({ sizes: [50] });

        expect(harness.engine.kind).toBe("prefix");
    });

    it("records measurements, syncs observers, and leaves positions empty", () => {
        const ctx = createMockContext(
            {
                numColumns: 1,
                readyToRender: true,
                totalSize: 0,
            },
            {
                indexByKey: new Map([["item-1", 1]]),
                props: {
                    data: createItems(3),
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                    numColumns: 1,
                    snapToIndices: [0, 1, 2],
                },
                totalSize: 0,
            },
        );
        const store = syncPrefixLayoutStoreStructure(ctx)!;
        const engine = new PrefixLayoutEngine(ctx, store);
        const positionUpdates: number[] = [];
        listenPosition$(ctx, "item-1", (value) => {
            positionUpdates.push(value as number);
        });

        const didRecord = engine.recordMeasuredSize(0, "item-0", 150);

        expect(didRecord).toBe(true);
        expect(engine.getTotalSize()).toBe(350);
        expect(ctx.state.totalSize).toBe(350);
        expect(ctx.values.get("snapToOffsets")).toEqual([0, 150, 250]);
        expect(positionUpdates).toEqual([150]);
        expect(ctx.state.positions).toEqual([]);
    });
});
