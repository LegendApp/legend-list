import { ScheduledWork } from "@/core/ScheduledWork";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

describe("ScheduledWork", () => {
    let nextHandle: number;
    let frames: Map<number, FrameRequestCallback>;
    let timeouts: Map<number, () => void>;
    let scheduledWork: ScheduledWork;
    let originalCancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
    let originalClearTimeout: typeof globalThis.clearTimeout;
    let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;
    let originalSetTimeout: typeof globalThis.setTimeout;

    beforeEach(() => {
        nextHandle = 0;
        frames = new Map();
        timeouts = new Map();
        scheduledWork = new ScheduledWork();
        originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        originalClearTimeout = globalThis.clearTimeout;
        originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        originalSetTimeout = globalThis.setTimeout;
        globalThis.requestAnimationFrame = (callback) => {
            const handle = ++nextHandle;
            frames.set(handle, callback);
            return handle;
        };
        globalThis.cancelAnimationFrame = (handle) => frames.delete(handle);
        globalThis.setTimeout = ((callback: () => void) => {
            const handle = ++nextHandle;
            timeouts.set(handle, callback);
            return handle;
        }) as typeof setTimeout;
        globalThis.clearTimeout = ((handle: number) => timeouts.delete(handle)) as typeof clearTimeout;
    });

    afterEach(() => {
        scheduledWork.dispose();
        globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        globalThis.clearTimeout = originalClearTimeout;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        globalThis.setTimeout = originalSetTimeout;
    });

    it("replaces named timeouts and forgets completed work", () => {
        const calls: string[] = [];
        scheduledWork.timeout(() => calls.push("first"), 10, "adaptiveRender");
        scheduledWork.timeout(() => calls.push("second"), 10, "adaptiveRender");

        expect(timeouts.size).toBe(1);
        expect(scheduledWork.has("adaptiveRender")).toBe(true);
        Array.from(timeouts.values())[0]();

        expect(calls).toEqual(["second"]);
        expect(scheduledWork.has("adaptiveRender")).toBe(false);
    });

    it("tracks concurrent anonymous timeouts independently", () => {
        const calls: number[] = [];
        const callback = () => calls.push(1);
        scheduledWork.timeout(callback, 10);
        scheduledWork.timeout(callback, 10);

        expect(timeouts.size).toBe(2);
        for (const timeoutCallback of timeouts.values()) {
            timeoutCallback();
        }

        expect(calls).toEqual([1, 1]);
    });

    it("replaces named frames", () => {
        const calls: string[] = [];
        scheduledWork.frame(() => calls.push("first"), "mvcpRecalculate");
        scheduledWork.frame(() => calls.push("second"), "mvcpRecalculate");

        expect(frames.size).toBe(1);
        Array.from(frames.values())[0](0);

        expect(calls).toEqual(["second"]);
        expect(scheduledWork.has("mvcpRecalculate")).toBe(false);
    });

    it("cancels every kind of pending work on dispose", () => {
        scheduledWork.timeout(() => {}, 10);
        scheduledWork.timeout(() => {}, 10, "adaptiveRender");
        scheduledWork.frame(() => {}, "mvcpRecalculate");

        scheduledWork.dispose();

        expect(timeouts.size).toBe(0);
        expect(frames.size).toBe(0);
        expect(scheduledWork.has("adaptiveRender")).toBe(false);
        expect(scheduledWork.has("mvcpRecalculate")).toBe(false);
    });
});
