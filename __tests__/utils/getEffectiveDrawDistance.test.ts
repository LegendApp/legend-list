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
            expect(ctx.state.scheduledWork.has("fullDrawDistancePrewarm")).toBe(true);

            rafCallbacks[0](Date.now());

            expect(calculateCount).toBe(1);
            expect(ctx.state.scheduledWork.has("fullDrawDistancePrewarm")).toBe(false);
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    it("refreshes the external list position before expanding its buffer", () => {
        const originalRAF = globalThis.requestAnimationFrame;
        let frame: FrameRequestCallback | undefined;
        globalThis.requestAnimationFrame = (callback) => {
            frame = callback;
            return 1;
        };
        const ctx = createMockContext({}, { props: { drawDistance: 320, hasExternalScroll: true } });
        let offset = -252;
        ctx.state.refScroller.current = { getRawScrollOffset: () => offset } as any;
        ctx.state.scroll = ctx.state.scrollPending = offset;
        ctx.state.triggerCalculateItemsInView = () => {
            expect(ctx.state.scroll).toBe(-835);
            expect(ctx.state.scrollPending).toBe(-835);
        };
        try {
            scheduleFullDrawDistancePrewarm(ctx);
            offset = -835;
            frame!(0);
        } finally {
            ctx.state.scheduledWork.dispose();
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    for (const mode of ["native", "initial", "target", "adjustment"] as const) {
        it(`preserves the pending scroll state during ${mode} prewarming`, () => {
            const originalRAF = globalThis.requestAnimationFrame;
            let frame: FrameRequestCallback | undefined;
            globalThis.requestAnimationFrame = (callback) => {
                frame = callback;
                return 1;
            };
            const ctx = createMockContext({}, { props: { drawDistance: 320, hasExternalScroll: mode !== "native" } });
            ctx.state.scroll = ctx.state.scrollPending = 500;
            ctx.state.refScroller.current = { getRawScrollOffset: () => -835 } as any;
            if (mode === "initial") {
                ctx.state.initialScroll = { index: 10 };
                ctx.state.didFinishInitialScroll = false;
            }
            if (mode === "target") ctx.state.scrollingTo = { offset: 500 } as any;
            if (mode === "adjustment") ctx.state.pendingNativeMVCPAdjust = {} as any;
            let calculated = false;
            ctx.state.triggerCalculateItemsInView = () => {
                calculated = true;
                expect(ctx.state.scroll).toBe(500);
                expect(ctx.state.scrollPending).toBe(500);
            };
            try {
                scheduleFullDrawDistancePrewarm(ctx);
                frame!(0);
                expect(calculated).toBe(true);
            } finally {
                ctx.state.scheduledWork.dispose();
                globalThis.requestAnimationFrame = originalRAF;
            }
        });
    }

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
            expect(ctx.state.scheduledWork.has("fullDrawDistancePrewarm")).toBe(false);
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });
});
