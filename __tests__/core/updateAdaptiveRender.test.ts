import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import {
    DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY,
    DEFAULT_ADAPTIVE_RENDER_EXIT_DELAY,
    DEFAULT_ADAPTIVE_RENDER_EXIT_VELOCITY,
    DEFAULT_WEB_ADAPTIVE_RENDER_ENTER_VELOCITY,
    DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_DELAY,
    DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_VELOCITY,
    updateAdaptiveRender,
} from "@/core/adaptiveRender";
import { Platform } from "@/platform/Platform";
import { peek$ } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

type TimeoutRecord = {
    callback: () => void;
    cleared?: boolean;
    delay: number;
};

describe("updateAdaptiveRender", () => {
    const originalClearTimeout = globalThis.clearTimeout;
    const originalSetTimeout = globalThis.setTimeout;
    const originalPlatform = Platform.OS;
    let timers: TimeoutRecord[];

    beforeEach(() => {
        Platform.OS = "ios";
        timers = [];
        globalThis.setTimeout = ((callback: () => void, delay: number) => {
            const timer = { callback, delay };
            timers.push(timer);
            return timer as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;
        globalThis.clearTimeout = ((timer: TimeoutRecord) => {
            timer.cleared = true;
        }) as unknown as typeof clearTimeout;
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
        globalThis.clearTimeout = originalClearTimeout;
        globalThis.setTimeout = originalSetTimeout;
    });

    function runTimer(timer: TimeoutRecord) {
        if (!timer.cleared) {
            timer.callback();
        }
    }

    it("keeps normal mode when adaptive render is not configured", () => {
        const ctx = createMockContext({ adaptiveRender: "normal" });

        updateAdaptiveRender(ctx, DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY + 0.1);

        expect(peek$(ctx, "adaptiveRender")).toBe("normal");
    });

    it("keeps normal mode for forced light when adaptive render is not configured", () => {
        const ctx = createMockContext({ adaptiveRender: "normal", readyToRender: true });

        updateAdaptiveRender(ctx, 0, { forceLight: true });

        expect(peek$(ctx, "adaptiveRender")).toBe("normal");
        expect(timers).toHaveLength(0);
    });

    it("keeps the configured initial mode until the list is ready to render", () => {
        const ctx = createMockContext(
            { adaptiveRender: "light" },
            {
                props: {
                    adaptiveRender: {
                        initialMode: "light",
                    },
                },
            },
        );

        updateAdaptiveRender(ctx, 0);

        expect(peek$(ctx, "adaptiveRender")).toBe("light");
    });

    it("switches to light mode immediately when velocity exceeds the default enter velocity", () => {
        const changes: Array<[string, string]> = [];
        const ctx = createMockContext(
            { adaptiveRender: "normal", readyToRender: true },
            {
                props: {
                    adaptiveRender: {
                        onChange: (mode, reason) => changes.push([mode, reason]),
                    },
                },
            },
        );

        updateAdaptiveRender(ctx, DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY + 0.1);

        expect(peek$(ctx, "adaptiveRender")).toBe("light");
        expect(changes).toEqual([["light", "scroll"]]);
    });

    it("switches to light mode immediately when forced even without velocity", () => {
        const changes: Array<[string, string]> = [];
        const ctx = createMockContext(
            { adaptiveRender: "normal", readyToRender: true },
            {
                props: {
                    adaptiveRender: {
                        onChange: (mode, reason) => changes.push([mode, reason]),
                    },
                },
            },
        );

        updateAdaptiveRender(ctx, 0, { forceLight: true });

        expect(peek$(ctx, "adaptiveRender")).toBe("light");
        expect(changes).toEqual([["light", "scroll"]]);
        expect(timers).toHaveLength(1);
        expect(timers[0].delay).toBe(DEFAULT_ADAPTIVE_RENDER_EXIT_DELAY);
    });

    it("waits for the default exit delay before returning to normal mode", () => {
        const changes: Array<[string, string]> = [];
        const ctx = createMockContext(
            { adaptiveRender: "normal", readyToRender: true },
            {
                props: {
                    adaptiveRender: {
                        onChange: (mode, reason) => changes.push([mode, reason]),
                    },
                },
            },
        );

        updateAdaptiveRender(ctx, DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY + 0.1);
        updateAdaptiveRender(ctx, DEFAULT_ADAPTIVE_RENDER_EXIT_VELOCITY - 0.1);

        expect(peek$(ctx, "adaptiveRender")).toBe("light");
        expect(timers).toHaveLength(1);
        expect(timers[0].delay).toBe(DEFAULT_ADAPTIVE_RENDER_EXIT_DELAY);

        runTimer(timers[0]);

        expect(peek$(ctx, "adaptiveRender")).toBe("normal");
        expect(changes).toEqual([
            ["light", "scroll"],
            ["normal", "scroll"],
        ]);
    });

    it("uses less aggressive default thresholds on web", () => {
        Platform.OS = "web";
        const ctx = createMockContext(
            { adaptiveRender: "normal", readyToRender: true },
            {
                props: {
                    adaptiveRender: {},
                },
            },
        );

        updateAdaptiveRender(ctx, DEFAULT_WEB_ADAPTIVE_RENDER_ENTER_VELOCITY - 1);
        expect(peek$(ctx, "adaptiveRender")).toBe("normal");

        updateAdaptiveRender(ctx, DEFAULT_WEB_ADAPTIVE_RENDER_ENTER_VELOCITY + 0.1);
        expect(peek$(ctx, "adaptiveRender")).toBe("light");

        updateAdaptiveRender(ctx, DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_VELOCITY - 0.5);
        expect(timers).toHaveLength(1);
        expect(timers[0].delay).toBe(DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_DELAY);
    });

    it("cancels a pending exit timeout when velocity crosses the exit velocity again", () => {
        const ctx = createMockContext(
            { adaptiveRender: "normal", readyToRender: true },
            {
                props: {
                    adaptiveRender: {},
                },
            },
        );

        updateAdaptiveRender(ctx, DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY + 0.1);
        updateAdaptiveRender(ctx, 0);

        const settleTimer = timers[0];
        updateAdaptiveRender(ctx, DEFAULT_ADAPTIVE_RENDER_EXIT_VELOCITY + 0.1);
        runTimer(settleTimer);

        expect(settleTimer.cleared).toBe(true);
        expect(peek$(ctx, "adaptiveRender")).toBe("light");
    });

    it("does not extend settling while velocity remains below the threshold", () => {
        const ctx = createMockContext(
            { adaptiveRender: "normal", readyToRender: true },
            {
                props: {
                    adaptiveRender: {},
                },
            },
        );

        updateAdaptiveRender(ctx, DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY + 0.1);
        updateAdaptiveRender(ctx, DEFAULT_ADAPTIVE_RENDER_EXIT_VELOCITY - 0.1);
        updateAdaptiveRender(ctx, DEFAULT_ADAPTIVE_RENDER_EXIT_VELOCITY - 0.25);

        expect(timers).toHaveLength(1);
        expect(timers[0].delay).toBe(DEFAULT_ADAPTIVE_RENDER_EXIT_DELAY);

        runTimer(timers[0]);

        expect(peek$(ctx, "adaptiveRender")).toBe("normal");
    });

    it("uses custom enter velocity, exit velocity, and exit delay values", () => {
        const ctx = createMockContext(
            { adaptiveRender: "normal", readyToRender: true },
            {
                props: {
                    adaptiveRender: {
                        enterVelocity: 3,
                        exitDelay: 25,
                        exitVelocity: 1,
                    },
                },
            },
        );

        updateAdaptiveRender(ctx, 2);
        expect(peek$(ctx, "adaptiveRender")).toBe("normal");

        updateAdaptiveRender(ctx, 4);
        expect(peek$(ctx, "adaptiveRender")).toBe("light");

        updateAdaptiveRender(ctx, 2);
        expect(peek$(ctx, "adaptiveRender")).toBe("light");

        updateAdaptiveRender(ctx, 0);

        expect(peek$(ctx, "adaptiveRender")).toBe("light");
        expect(timers).toHaveLength(2);
        expect(timers[0].cleared).toBe(true);
        expect(timers[1].delay).toBe(25);
    });
});
