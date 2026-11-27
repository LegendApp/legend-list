import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { checkFinishedScroll } from "../../src/core/checkFinishedScroll";
import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { advanceCurrentInitialScrollSession } from "../../src/core/initialScroll";
import { onScroll } from "../../src/core/onScroll";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";

// KeyboardAwareLegendList reports keyboard insets through
// reportContentInsetForScrollInternal and lets the keyboard controller shift
// the content. Ten 100pt rows in a 300pt viewport end at 700 without the
// keyboard and at 1000 with a 300pt keyboard inset.
describe("keyboard insets during initialScrollAtEnd", () => {
    const keepAtEnd = { keepInitialScrollAtEnd: true };
    let frames: FrameRequestCallback[];
    let contexts: StateContext[];
    let now: number;
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        Platform.OS = "ios";
        contexts = [];
        frames = [];
        now = 1_000_000;
        spyOn(Date, "now").mockImplementation(() => now);
        spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
            frames.push(callback);
            return frames.length;
        });
        spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    });

    afterEach(() => {
        for (const ctx of contexts) ctx.state.scheduledWork.dispose();
        Platform.OS = originalPlatform;
        mock.restore();
    });

    function frame() {
        now += 16;
        const pending = frames.splice(0);
        for (const callback of pending) callback(0);
    }

    function flushFrames() {
        for (let i = 0; i < 5 && frames.length > 0; i++) frame();
    }

    function land(ctx: StateContext, offset: number) {
        now += 1;
        onScroll(ctx, { nativeEvent: { contentOffset: { x: 0, y: offset } } } as any);
        checkFinishedScroll(ctx);
    }

    function finishAt700() {
        const result = setup();
        advanceCurrentInitialScrollSession(result.ctx, { forceScroll: true });
        land(result.ctx, 700);
        flushFrames();
        result.scrollTo.mockClear();
        return result;
    }

    function setup() {
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                didFinishInitialScroll: false,
                initialScroll: { index: 9, preserveForBottomPadding: true, viewPosition: 1 },
                initialScrollSession: { kind: "bootstrap", previousDataLength: 10 },
                lastLayout: { height: 300, width: 400, x: 0, y: 0 },
                positions: Array.from({ length: 10 }, (_, i) => i * 100),
                props: {
                    data: Array.from({ length: 10 }, (_, i) => ({ id: i })),
                    getFixedItemSize: () => 100,
                },
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 300,
                scrollPending: 0,
                totalSize: 1000,
            },
        );
        for (let i = 0; i < 10; i++) {
            ctx.state.sizes.set(`item_${i}`, 100);
            ctx.state.sizesKnown.set(`item_${i}`, 100);
            ctx.state.indexByKey.set(`item_${i}`, i);
        }
        const scrollTo = mock((_point: { animated: boolean; x: number; y: number }) => {});
        ctx.state.refScroller.current = { scrollTo } as any;
        contexts.push(ctx);
        return { ctx, handle: createImperativeHandle(ctx), scrollTo };
    }

    const toEnd = [{ animated: false, x: 0, y: 1000 }];

    it("moves an unfinished initial end scroll to the end with the keyboard inset", () => {
        const { ctx, handle, scrollTo } = setup();
        advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
        expect(scrollTo).toHaveBeenLastCalledWith({ animated: false, x: 0, y: 700 });

        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);

        expect(scrollTo).toHaveBeenLastCalledWith(toEnd[0]);
        land(ctx, 1000);
        flushFrames();
        expect(ctx.state.didFinishInitialScroll).toBe(true);
        expect(ctx.state.scroll).toBe(1000);
    });

    it("retargets an unfinished initial end scroll after the controller's scroll event", () => {
        const { ctx, handle, scrollTo } = setup();
        advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
        // The controller already moved the content to 1000, but the scroll to 700 is still
        // active and would keep retrying 700.
        onScroll(ctx, { nativeEvent: { contentOffset: { x: 0, y: 1000 } } } as any);
        scrollTo.mockClear();

        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);

        expect(scrollTo.mock.calls).toEqual([[{ animated: false, x: 0, y: 1000 }]]);
        expect(ctx.state.scrollingTo?.targetOffset).toBe(1000);
    });

    it("holds the keyboard end after a retargeted initial scroll finishes", () => {
        const { ctx, handle, scrollTo } = setup();
        advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        land(ctx, 1000);
        frame();
        expect(ctx.state.didFinishInitialScroll).toBe(true);
        scrollTo.mockClear();

        // The controller's own move, from the offset it saw, lands after the list's scroll.
        land(ctx, 700);
        frame();

        expect(scrollTo.mock.calls).toEqual([toEnd]);
    });

    it("moves a finished initial end to the keyboard end when the controller does not", () => {
        const { handle, scrollTo } = finishAt700();

        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        frame();

        expect(scrollTo.mock.calls).toEqual([toEnd]);
    });

    it("sends the end again when the controller had not applied its inset yet", () => {
        const { handle, scrollTo } = finishAt700();

        // Native clamps the first scroll to the old range and emits no scroll event.
        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        frame();
        frame();

        expect(scrollTo.mock.calls).toEqual([toEnd, toEnd]);
    });

    it("stops sending once the controller has settled and nothing moves", () => {
        const { ctx, handle, scrollTo } = finishAt700();
        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        frame();
        scrollTo.mockClear();

        now += 200;
        flushFrames();

        expect(scrollTo).not.toHaveBeenCalled();
        expect(ctx.state.preservedEndAnchorCorrection).toBeUndefined();
    });

    it("corrects a controller move from a stale offset that lands after the report", () => {
        const { ctx, handle, scrollTo } = finishAt700();
        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        frame();
        land(ctx, 1000);
        scrollTo.mockClear();

        land(ctx, 950);
        frame();

        expect(ctx.state.initialScroll).toBeDefined();
        expect(scrollTo.mock.calls).toEqual([toEnd]);
    });

    it("corrects a retry that lands after the controller's move, once the list looked aligned", () => {
        const { ctx, handle, scrollTo } = finishAt700();
        // The controller shifted the content to 1000 and its scroll event is in.
        land(ctx, 1000);
        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        frame();
        expect(scrollTo).not.toHaveBeenCalled();

        // A retry the list sent to 700 before the shift was still queued natively.
        land(ctx, 700);
        frame();

        expect(scrollTo.mock.calls).toEqual([toEnd]);
    });

    it("releases the end once the controller has settled", () => {
        const { ctx, handle, scrollTo } = finishAt700();
        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        frame();
        land(ctx, 1000);
        scrollTo.mockClear();
        now += 200;
        frame();
        expect(ctx.state.preservedEndAnchorCorrection).toBeUndefined();

        land(ctx, 400);
        flushFrames();

        expect(scrollTo).not.toHaveBeenCalled();
        expect(ctx.state.initialScroll).toBeUndefined();
    });

    it("lets go as soon as the reader drags", () => {
        const { ctx, handle, scrollTo } = finishAt700();
        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        frame();
        land(ctx, 1000);
        scrollTo.mockClear();

        ctx.state.isDragging = true;
        land(ctx, 900);
        flushFrames();

        expect(scrollTo).not.toHaveBeenCalled();
        expect(ctx.state.preservedEndAnchorCorrection).toBeUndefined();
    });

    it("leaves the initial end to an owner that does not ask to keep it", () => {
        const settling = setup();
        advanceCurrentInitialScrollSession(settling.ctx, { forceScroll: true });
        settling.scrollTo.mockClear();
        const finished = finishAt700();

        settling.handle.reportContentInsetForScrollInternal!({ bottom: 300 });
        finished.handle.reportContentInsetForScrollInternal!({ bottom: 300 });
        flushFrames();

        expect(settling.scrollTo).not.toHaveBeenCalled();
        expect(finished.scrollTo).not.toHaveBeenCalled();
    });

    it("leaves a finished initial end the reader scrolled away from", () => {
        const { ctx, handle, scrollTo } = finishAt700();
        land(ctx, 200);

        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        flushFrames();

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("leaves a bottom-aligned initial index that is not the last row in place", () => {
        const { ctx, handle, scrollTo } = setup();
        ctx.state.initialScroll = { index: 4, viewPosition: 1 };
        advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
        scrollTo.mockClear();

        handle.reportContentInsetForScrollInternal!({ bottom: 300 }, keepAtEnd);
        flushFrames();

        expect(scrollTo).not.toHaveBeenCalled();
    });
});
