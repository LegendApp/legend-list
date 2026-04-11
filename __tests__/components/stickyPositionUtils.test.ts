import { describe, expect, it } from "bun:test";

import { getStickyPushLimit } from "../../src/components/stickyPositionUtils";
import { createMockState } from "../__mocks__/createMockState";

describe("stickyPositionUtils", () => {
    it("computes a push limit from the next sticky header and current sticky size", () => {
        const state = createMockState({
            positions: [0, 80, 160, 240, 320, 360],
            props: {
                stickyIndicesArr: [1, 5],
            },
        });
        state.sizes.set("header-1", 120);

        expect(getStickyPushLimit(state, 1, "header-1")).toBe(240);
    });

    it("returns undefined when there is no next sticky header", () => {
        const state = createMockState({
            positions: [0, 80],
            props: {
                stickyIndicesArr: [1],
            },
        });
        state.sizes.set("header-1", 120);

        expect(getStickyPushLimit(state, 1, "header-1")).toBeUndefined();
    });
});
