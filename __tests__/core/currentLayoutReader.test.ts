import { describe, expect, it } from "bun:test";
import "../setup";

import { updateItemPositions } from "../../src/core/updateItemPositions";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";
import { createCurrentLayoutReader } from "../helpers/currentLayoutReader";

function createItems(count: number) {
    return Array.from({ length: count }, (_, index) => ({ id: `item-${index}` }));
}

function createSizedContext(sizes: number[], estimatedItemSize = 100) {
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
        ctx.state.sizesKnown.set(`item-${index}`, size);
    });

    return ctx;
}

function updateFrom(ctx: StateContext, startIndex = 0) {
    updateItemPositions(ctx, false, {
        doMVCP: false,
        scrollBottomBuffered: -1,
        startIndex,
    });
}

describe("current layout reader", () => {
    it("reads offsets, ends, and total size from current positions semantics", () => {
        const ctx = createSizedContext([50, 75, 25]);

        updateFrom(ctx);

        const reader = createCurrentLayoutReader(ctx);
        expect(reader.getOffset(0)).toBe(0);
        expect(reader.getOffset(1)).toBe(50);
        expect(reader.getOffset(2)).toBe(125);
        expect(reader.getEnd(0)).toBe(50);
        expect(reader.getEnd(1)).toBe(125);
        expect(reader.getEnd(2)).toBe(150);
        expect(reader.getTotalSize()).toBe(150);
    });

    it("finds the first item whose end offset is greater than the target offset", () => {
        const ctx = createSizedContext([50, 75, 25]);

        updateFrom(ctx);

        const reader = createCurrentLayoutReader(ctx);
        expect(reader.findIndexAtOffset(0)).toBe(0);
        expect(reader.findIndexAtOffset(49.999)).toBe(0);
        expect(reader.findIndexAtOffset(50)).toBe(1);
        expect(reader.findIndexAtOffset(124.999)).toBe(1);
        expect(reader.findIndexAtOffset(125)).toBe(2);
        expect(reader.findIndexAtOffset(149.999)).toBe(2);
        expect(reader.findIndexAtOffset(150)).toBeUndefined();
    });

    it("handles mixed measured and estimated sizes", () => {
        const ctx = createMockContext(
            {
                numColumns: 1,
                totalSize: 0,
            },
            {
                props: {
                    data: createItems(4),
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                totalSize: 0,
            },
        );
        ctx.state.sizesKnown.set("item-0", 60);
        ctx.state.sizesKnown.set("item-2", 140);

        updateFrom(ctx);

        const reader = createCurrentLayoutReader(ctx);
        expect(reader.getSize(0)).toBe(60);
        expect(reader.getSize(1)).toBe(100);
        expect(reader.getSize(2)).toBe(140);
        expect(reader.getSize(3)).toBe(100);
        expect(reader.getOffset(0)).toBe(0);
        expect(reader.getOffset(1)).toBe(60);
        expect(reader.getOffset(2)).toBe(160);
        expect(reader.getOffset(3)).toBe(300);
        expect(reader.getTotalSize()).toBe(400);
    });

    it("propagates an index 0 size change through semantic offsets", () => {
        const ctx = createSizedContext([100, 100, 100, 100]);

        updateFrom(ctx);
        ctx.state.sizesKnown.set("item-0", 150);
        updateFrom(ctx);

        const reader = createCurrentLayoutReader(ctx);
        expect(reader.getOffset(0)).toBe(0);
        expect(reader.getOffset(1)).toBe(150);
        expect(reader.getOffset(2)).toBe(250);
        expect(reader.getOffset(3)).toBe(350);
        expect(reader.getTotalSize()).toBe(450);
    });

    it("propagates a middle size change from the changed index onward", () => {
        const ctx = createSizedContext([100, 100, 100, 100]);

        updateFrom(ctx);
        ctx.state.sizesKnown.set("item-2", 175);
        updateFrom(ctx, 2);

        const reader = createCurrentLayoutReader(ctx);
        expect(reader.getOffset(0)).toBe(0);
        expect(reader.getOffset(1)).toBe(100);
        expect(reader.getOffset(2)).toBe(200);
        expect(reader.getOffset(3)).toBe(375);
        expect(reader.getTotalSize()).toBe(475);
    });

    it("preserves fractional layout sizes", () => {
        const ctx = createSizedContext([10.5, 20.25, 3.75]);

        updateFrom(ctx);

        const reader = createCurrentLayoutReader(ctx);
        expect(reader.getOffset(1)).toBeCloseTo(10.5);
        expect(reader.getOffset(2)).toBeCloseTo(30.75);
        expect(reader.getEnd(2)).toBeCloseTo(34.5);
        expect(reader.getTotalSize()).toBeCloseTo(34.5);
    });

    it("can compute an MVCP-style anchor delta from committed and updated offsets", () => {
        const ctx = createSizedContext([100, 100, 100, 100]);

        updateFrom(ctx);

        const readerBefore = createCurrentLayoutReader(ctx);
        const oldAnchorTop = readerBefore.getOffset(3);

        ctx.state.sizesKnown.set("item-0", 150);
        updateFrom(ctx);

        const readerAfter = createCurrentLayoutReader(ctx);
        const newAnchorTop = readerAfter.getOffset(3);

        expect(oldAnchorTop).toBe(300);
        expect(newAnchorTop).toBe(350);
        expect(newAnchorTop! - oldAnchorTop!).toBe(50);
    });
});
