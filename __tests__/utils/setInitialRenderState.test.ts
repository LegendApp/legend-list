import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { setInitialRenderState } from "../../src/utils/setInitialRenderState";
import { createMockContext } from "../__mocks__/createMockContext";

describe("setInitialRenderState", () => {
    let originalRAF: typeof globalThis.requestAnimationFrame;
    let rafCallbacks: Array<(time: number) => void>;

    beforeEach(() => {
        originalRAF = globalThis.requestAnimationFrame;
        rafCallbacks = [];
        globalThis.requestAnimationFrame = (callback: (time: number) => void) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        };
    });

    afterEach(() => {
        globalThis.requestAnimationFrame = originalRAF;
    });

    it("schedules a full drawDistance prewarm after the list becomes ready", () => {
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                props: {
                    drawDistance: 1_000,
                },
            },
        );
        const triggerCalculateItemsInView = mock(() => {});
        ctx.state.triggerCalculateItemsInView = triggerCalculateItemsInView;

        setInitialRenderState(ctx, { didInitialScroll: true });

        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(ctx.values.get("adaptiveRender")).toBe("normal");
        expect(rafCallbacks).toHaveLength(1);
        expect(triggerCalculateItemsInView).not.toHaveBeenCalled();

        rafCallbacks[0](Date.now());

        expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith();
    });

    it("does not schedule a prewarm when the configured drawDistance is already initial-sized", () => {
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                props: {
                    drawDistance: 100,
                },
            },
        );

        setInitialRenderState(ctx, { didInitialScroll: true });

        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(ctx.values.get("adaptiveRender")).toBe("normal");
        expect(rafCallbacks).toHaveLength(0);
    });

    it("does not schedule a second prewarm after readyToRender is already true", () => {
        const ctx = createMockContext(
            {
                readyToRender: true,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                props: {
                    drawDistance: 1_000,
                },
            },
        );

        setInitialRenderState(ctx, { didInitialScroll: true });

        expect(rafCallbacks).toHaveLength(0);
    });
});
