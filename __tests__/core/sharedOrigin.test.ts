import {
    canUseSharedContainerOrigin,
    getSharedOriginFlushReason,
    shouldUseDeferredSharedOriginVisualAdjust,
} from "@/core/sharedOrigin";
import { Platform } from "@/platform/Platform";
import { afterEach, describe, expect, it } from "bun:test";
import { createMockState } from "../__mocks__/createMockState";

describe("sharedOrigin", () => {
    const originalPlatform = Platform.OS;

    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    it("enables shared container origin on supported mobile platforms after initial scroll", () => {
        Platform.OS = "ios";
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: undefined,
            scrollingTo: undefined,
        });

        expect(canUseSharedContainerOrigin(state, 1)).toBe(true);
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(true);
    });

    it("disables shared container origin while initial scroll is active", () => {
        Platform.OS = "web";
        const state = createMockState({
            didFinishInitialScroll: false,
            initialScroll: {
                contentOffset: 100,
            },
        });

        expect(canUseSharedContainerOrigin(state, 1)).toBe(false);
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(false);
    });

    it("allows deferred shared-origin visual adjust on supported platforms after initial scroll", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: undefined,
            scrollingTo: undefined,
        });

        Platform.OS = "web";
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(true);

        Platform.OS = "android";
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(true);
    });

    it("disables shared container origin when the layout shape is unsupported", () => {
        Platform.OS = "web";
        const state = createMockState({
            props: {
                stickyIndicesArr: [0],
            },
        });

        expect(canUseSharedContainerOrigin(state, 1)).toBe(false);
        expect(canUseSharedContainerOrigin(state, 2)).toBe(false);
    });

    it("uses the centralized flush policy for deferred visual adjust", () => {
        Platform.OS = "web";
        const state = createMockState({
            scrollPrev: 100,
        });

        expect(
            getSharedOriginFlushReason({
                pendingSharedOriginOffset: 500,
                scrollLength: 300,
                scrollState: 80,
                state,
            }),
        ).toBe("top-cap");

        state.sharedContainerFlushPending = true;

        expect(
            getSharedOriginFlushReason({
                pendingSharedOriginOffset: 20,
                scrollLength: 300,
                scrollState: 80,
                state,
            }),
        ).toBe("momentum-end");
    });
});
