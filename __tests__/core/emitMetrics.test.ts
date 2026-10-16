import { describe, expect, it } from "bun:test";
import "../setup";

import { getDistanceFromEnd, getObservedScrollOffset } from "../../src/core/emitMetrics";
import { createMockContext } from "../__mocks__/createMockContext";

describe("getObservedScrollOffset", () => {
    function createObservedContext(rawOffset: number, props: Record<string, unknown>) {
        return createMockContext(
            { totalSize: 1000 },
            {
                props,
                refScroller: { current: { getCurrentScrollOffset: () => rawOffset } } as any,
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

    it("keeps vertical and LTR offsets unchanged", () => {
        expect(getObservedScrollOffset(createObservedContext(350, {}))).toBe(350);
        expect(getObservedScrollOffset(createObservedContext(350, { horizontal: true }))).toBe(350);
    });
});
