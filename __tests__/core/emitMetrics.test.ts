import { describe, expect, it } from "bun:test";
import "../setup";

import { getDistanceFromEnd, getObservedScrollOffset } from "../../src/core/emitMetrics";
import { createMockContext } from "../__mocks__/createMockContext";

describe("getObservedScrollOffset", () => {
    function createObservedContext(rawOffset: number, props: Record<string, unknown>, maxOffset = 700) {
        return createMockContext(
            { totalSize: 1000 },
            {
                props,
                refScroller: {
                    current: { getCurrentScrollOffset: () => rawOffset, getMaxScrollOffset: () => maxOffset },
                } as any,
                scroll: 0,
                scrollLength: 300,
            },
        );
    }

    it("converts a raw negative RTL DOM offset into the logical offset", () => {
        const ctx = createObservedContext(-350, { horizontal: true, rtl: true });
        expect(getObservedScrollOffset(ctx)).toBe(350);
        expect(getDistanceFromEnd(ctx)).toBe(350);
    });

    it("uses the known RTL convention without reclassifying it", () => {
        const negative = createObservedContext(0, { horizontal: true, rtl: true });
        negative.state.horizontalRTLScrollType = "negative";
        expect(getObservedScrollOffset(negative)).toBe(0);
        expect(negative.state.horizontalRTLScrollType).toBe("negative");

        // The live DOM extent, not the model content size, mirrors an inverted offset.
        const inverted = createObservedContext(500, { horizontal: true, rtl: true }, 900);
        inverted.state.horizontalRTLScrollType = "inverted";
        expect(getObservedScrollOffset(inverted)).toBe(400);
        expect(inverted.state.horizontalRTLScrollType).toBe("inverted");
    });

    it("keeps vertical and LTR offsets unchanged", () => {
        expect(getObservedScrollOffset(createObservedContext(350, {}))).toBe(350);
        expect(getObservedScrollOffset(createObservedContext(350, { horizontal: true }))).toBe(350);
    });
});
