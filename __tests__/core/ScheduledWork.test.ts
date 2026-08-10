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
        const staleCallback = Array.from(timeouts.values())[0]!;
        scheduledWork.timeout(() => calls.push("second"), 10, "adaptiveRender");

        expect(timeouts.size).toBe(1);
        expect(scheduledWork.has("adaptiveRender")).toBe(true);
        staleCallback();
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
        const staleCallback = Array.from(frames.values())[0]!;
        scheduledWork.frame(() => calls.push("second"), "mvcpRecalculate");

        expect(frames.size).toBe(1);
        staleCallback(0);
        Array.from(frames.values())[0](0);

        expect(calls).toEqual(["second"]);
        expect(scheduledWork.has("mvcpRecalculate")).toBe(false);
    });

    it("registers arbitrary cleanup with the same replacement lifecycle", () => {
        const calls: string[] = [];
        scheduledWork.register("platformScrollCompletion", () => calls.push("first"));
        scheduledWork.register("platformScrollCompletion", () => calls.push("second"));

        scheduledWork.cancel("platformScrollCompletion");

        expect(calls).toEqual(["first", "second"]);
        expect(scheduledWork.has("platformScrollCompletion")).toBe(false);
    });

    it("cancels native work without rebinding the global timer receiver", () => {
        // Browsers reject `clearTimeout` / `cancelAnimationFrame` when the receiver is not the
        // global object, so cancel() must not invoke the stored canceller as a property of its
        // own bookkeeping tuple. Chrome reports that as "TypeError: Illegal invocation".
        const receivers: unknown[] = [];
        const assertGlobalReceiver = function (this: unknown) {
            if (this !== undefined && this !== globalThis) {
                throw new TypeError("Illegal invocation");
            }
            receivers.push(this);
        };
        globalThis.clearTimeout = function (this: unknown, handle: number) {
            assertGlobalReceiver.call(this);
            timeouts.delete(handle);
        } as typeof clearTimeout;
        globalThis.cancelAnimationFrame = function (this: unknown, handle: number) {
            assertGlobalReceiver.call(this);
            frames.delete(handle);
        } as typeof cancelAnimationFrame;

        scheduledWork.timeout(() => {}, 10, "adaptiveRender");
        scheduledWork.frame(() => {}, "mvcpRecalculate");

        expect(() => scheduledWork.cancel("adaptiveRender")).not.toThrow();
        expect(() => scheduledWork.cancel("mvcpRecalculate")).not.toThrow();

        expect(receivers).toEqual([undefined, undefined]);
        expect(timeouts.size).toBe(0);
        expect(frames.size).toBe(0);
    });

    it("cancels every kind of pending work on dispose", () => {
        const calls: string[] = [];
        scheduledWork.timeout(() => calls.push("anonymous timeout"), 10);
        scheduledWork.timeout(() => calls.push("named timeout"), 10, "adaptiveRender");
        scheduledWork.frame(() => calls.push("frame"), "mvcpRecalculate");
        const lateTimeouts = Array.from(timeouts.values());
        const lateFrames = Array.from(frames.values());
        const cleanupCalls: string[] = [];
        scheduledWork.register("platformScrollCompletion", () => cleanupCalls.push("cleanup"));

        scheduledWork.dispose();
        for (const callback of lateTimeouts) {
            callback();
        }
        for (const callback of lateFrames) {
            callback(0);
        }

        expect(timeouts.size).toBe(0);
        expect(frames.size).toBe(0);
        expect(calls).toEqual([]);
        expect(scheduledWork.has("adaptiveRender")).toBe(false);
        expect(scheduledWork.has("mvcpRecalculate")).toBe(false);
        expect(cleanupCalls).toEqual(["cleanup"]);
    });
});
