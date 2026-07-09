import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { resetInitialRenderState, setInitialRenderState } from "../../src/utils/setInitialRenderState";
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
                    drawDistance: 50,
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

    it("calls onLoad only once across replayed readiness transitions", () => {
        const onLoad = mock(() => {});
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                props: {
                    onLoad,
                },
            },
        );

        setInitialRenderState(ctx, { didInitialScroll: true });

        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(ctx.state.didLoad).toBe(true);
        expect(onLoad).toHaveBeenCalledTimes(1);

        resetInitialRenderState(ctx, { resetLayout: true });
        setInitialRenderState(ctx, { didLayout: true });

        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it("resets readiness and adaptive render before a replayed initial render", () => {
        const changes: Array<[string, string]> = [];
        const ctx = createMockContext(
            {
                adaptiveRender: "normal",
                readyToRender: true,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                props: {
                    adaptiveRender: {
                        initialMode: "light",
                        onChange: (mode, reason) => changes.push([mode, reason]),
                    },
                },
                timeoutAdaptiveRender: 123 as any,
                timeouts: new Set([123 as any]),
            },
        );

        resetInitialRenderState(ctx, {
            resetInitialScroll: true,
            resetLayout: true,
        });

        expect(ctx.state.didContainersLayout).toBe(false);
        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(ctx.state.queuedInitialLayout).toBe(false);
        expect(ctx.values.get("readyToRender")).toBe(false);
        expect(ctx.values.get("adaptiveRender")).toBe("light");
        expect(ctx.state.timeoutAdaptiveRender).toBeUndefined();
        expect(ctx.state.timeouts.size).toBe(0);
        expect(changes).toEqual([["light", "initial"]]);

        setInitialRenderState(ctx, { didLayout: true });
        expect(ctx.values.get("readyToRender")).toBe(false);
        expect(ctx.values.get("adaptiveRender")).toBe("light");
        expect(changes).toEqual([["light", "initial"]]);

        setInitialRenderState(ctx, { didInitialScroll: true });
        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(ctx.values.get("adaptiveRender")).toBe("normal");
        expect(changes).toEqual([
            ["light", "initial"],
            ["normal", "ready"],
        ]);
    });
});
