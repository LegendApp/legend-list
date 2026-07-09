import { describe, expect, it } from "bun:test";
import "../setup";

import {
    getEffectiveDrawDistance,
    INITIAL_DRAW_DISTANCE,
    scheduleFullDrawDistancePrewarm,
} from "../../src/utils/getEffectiveDrawDistance";
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

    it("caps drawDistance in visible-first mode after the list is ready to render", () => {
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

        expect(getEffectiveDrawDistance(ctx, "visible-first")).toBe(INITIAL_DRAW_DISTANCE);
    });

    it("uses the configured drawDistance in full mode before the list is ready to render", () => {
        const ctx = createMockContext(
            {},
            {
                props: {
                    drawDistance: 1_000,
                },
            },
        );

        expect(getEffectiveDrawDistance(ctx, "full")).toBe(1_000);
    });

    it("dedupes scheduled full drawDistance prewarm passes", () => {
        const originalRAF = globalThis.requestAnimationFrame;
        const rafCallbacks: Array<(time: number) => void> = [];
        globalThis.requestAnimationFrame = (callback: (time: number) => void) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        };
        try {
            const ctx = createMockContext(
                {},
                {
                    props: {
                        drawDistance: 1_000,
                    },
                },
            );
            let calculateCount = 0;
            ctx.state.triggerCalculateItemsInView = () => {
                calculateCount += 1;
            };

            scheduleFullDrawDistancePrewarm(ctx);
            scheduleFullDrawDistancePrewarm(ctx);

            expect(rafCallbacks).toHaveLength(1);
            expect(ctx.state.queuedFullDrawDistancePrewarm).toBe(1);

            rafCallbacks[0](Date.now());

            expect(calculateCount).toBe(1);
            expect(ctx.state.queuedFullDrawDistancePrewarm).toBeUndefined();
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    it("does not schedule full drawDistance prewarm when drawDistance is already initial-sized", () => {
        const originalRAF = globalThis.requestAnimationFrame;
        const rafCallbacks: Array<(time: number) => void> = [];
        globalThis.requestAnimationFrame = (callback: (time: number) => void) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        };
        try {
            const ctx = createMockContext(
                {},
                {
                    props: {
                        drawDistance: INITIAL_DRAW_DISTANCE,
                    },
                },
            );

            scheduleFullDrawDistancePrewarm(ctx);

            expect(rafCallbacks).toHaveLength(0);
            expect(ctx.state.queuedFullDrawDistancePrewarm).toBeUndefined();
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });
});
