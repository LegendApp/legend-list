import { Platform } from "react-native";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { scheduleInitialScrollAfterLayout } from "../../src/core/scheduleInitialScrollAfterLayout";
import { createMockState } from "../__mocks__/createMockState";

describe("scheduleInitialScrollAfterLayout", () => {
    const originalPlatform = Platform.OS;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const animationFrames: FrameRequestCallback[] = [];

    beforeEach(() => {
        Platform.OS = "android";
        animationFrames.length = 0;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            animationFrames.push(callback);
            return animationFrames.length;
        }) as typeof requestAnimationFrame;
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    });

    it("reapplies the resolved horizontal offset on the frame after layout", () => {
        const scrollCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const state = createMockState({
            props: {
                data: Array.from({ length: 20 }, (_, index) => ({ id: index })),
                getFixedItemSize: () => 360,
                horizontal: true,
            },
            refScroller: {
                current: {
                    scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollCalls.push(params),
                } as any,
            },
            scrollLength: 360,
        });

        const frame = scheduleInitialScrollAfterLayout(state, { index: 9, viewOffset: 0 }, 3240);

        expect(frame).toBe(1);
        expect(scrollCalls).toHaveLength(0);

        animationFrames[0](0);

        expect(scrollCalls).toEqual([{ animated: false, x: 3240, y: 0 }]);
        expect(state.scroll).toBe(3240);
    });
});
