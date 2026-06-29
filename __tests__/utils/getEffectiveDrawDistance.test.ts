import { describe, expect, it } from "bun:test";
import "../setup";

import { getEffectiveDrawDistance, INITIAL_DRAW_DISTANCE } from "../../src/utils/getEffectiveDrawDistance";
import { createMockContext } from "../__mocks__/createMockContext";

describe("getEffectiveDrawDistance", () => {
    it("caps drawDistance before the list is ready to render", () => {
        const ctx = createMockContext(
            {},
            {
                props: {
                    drawDistance: 1_000,
                },
            },
        );

        expect(getEffectiveDrawDistance(ctx)).toBe(INITIAL_DRAW_DISTANCE);
    });

    it("preserves smaller drawDistance values before the list is ready to render", () => {
        const ctx = createMockContext(
            {},
            {
                props: {
                    drawDistance: 50,
                },
            },
        );

        expect(getEffectiveDrawDistance(ctx)).toBe(50);
    });

    it("uses the configured drawDistance after the list is ready to render", () => {
        const ctx = createMockContext(
            {
                readyToRender: true,
            },
            {
                props: {
                    drawDistance: 1_000,
                },
            },
        );

        expect(getEffectiveDrawDistance(ctx)).toBe(1_000);
    });
});
