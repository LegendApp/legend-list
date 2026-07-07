import { describe, expect, it } from "bun:test";
import { getStickyPushLimit } from "../../src/components/stickyPositionUtils";
import { createMockContext } from "../__mocks__/createMockContext";

describe("stickyPositionUtils", () => {
    it("computes a push limit from the next sticky header and current sticky size", () => {
        const ctx = createMockContext(
            {},
            {
                idCache: ["item-0", "header-1", "item-2", "item-3", "item-4", "header-5"],
                positions: [0, 80, 160, 240, 320, 360],
                props: {
                    data: Array.from({ length: 6 }, (_, index) => ({ id: `item-${index}` })),
                    stickyHeaderIndicesArr: [1, 5],
                },
            },
        );
        const state = ctx.state;
        state.sizes.set("header-1", 120);

        expect(getStickyPushLimit(ctx, 1, "header-1")).toBe(240);
    });

    it("returns undefined when there is no next sticky header", () => {
        const ctx = createMockContext(
            {},
            {
                idCache: ["item-0", "header-1"],
                positions: [0, 80],
                props: {
                    data: Array.from({ length: 2 }, (_, index) => ({ id: `item-${index}` })),
                    stickyHeaderIndicesArr: [1],
                },
            },
        );
        ctx.state.sizes.set("header-1", 120);

        expect(getStickyPushLimit(ctx, 1, "header-1")).toBeUndefined();
    });
});
