import { describe, expect, it } from "bun:test";
import "../setup";

import { ArrayLayoutEngine } from "@/core/ArrayLayoutEngine";
import { updateItemPositions } from "@/core/updateItemPositions";
import type { StateContext } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";
import type { CreateLayoutEngineHarness } from "../helpers/layoutEngineContract";
import { runLayoutEngineContract } from "../helpers/layoutEngineContract";

function createItems(count: number) {
    return Array.from({ length: count }, (_, index) => ({ id: `item-${index}` }));
}

const createArrayLayoutHarness: CreateLayoutEngineHarness = ({ estimatedItemSize = 100, sizes }) => {
    const ctx = createMockContext(
        {
            numColumns: 1,
            totalSize: 0,
        },
        {
            props: {
                data: createItems(sizes.length),
                estimatedItemSize,
                keyExtractor: (item: { id: string }) => item.id,
            },
            totalSize: 0,
        },
    );

    sizes.forEach((size, index) => {
        if (size !== undefined) {
            ctx.state.sizesKnown.set(`item-${index}`, size);
        }
    });

    return {
        engine: new ArrayLayoutEngine(ctx),
        updateFrom(startIndex = 0) {
            updateFrom(ctx, startIndex);
        },
    };
};

function updateFrom(ctx: StateContext, startIndex = 0) {
    updateItemPositions(ctx, false, {
        doMVCP: false,
        scrollBottomBuffered: -1,
        startIndex,
    });
}

runLayoutEngineContract("ArrayLayoutEngine", createArrayLayoutHarness);

describe("ArrayLayoutEngine", () => {
    it("reports array layout kind", () => {
        const harness = createArrayLayoutHarness({ sizes: [50] });

        expect(harness.engine.kind).toBe("array");
    });
});
