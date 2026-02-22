import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import { Platform } from "react-native";

import type { StateContext } from "../../src/state/state";
import * as stateModule from "../../src/state/state";
import type { InternalState } from "../../src/types";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

/**
 * Regression test for https://github.com/LegendApp/legend-list/issues/392
 *
 * On iOS, when `maintainVisibleContentPosition` is enabled (default in v2) and
 * `contentContainerStyle` has `paddingTop`, the first render incorrectly calls
 * `requestAdjust` because `prevPaddingTop` is `0` (the initial value) rather
 * than `undefined`. The fix adds a `state.hasScrolled` guard so the MVCP
 * padding adjustment is skipped until the user has actually scrolled.
 */
describe("initializeStateVars MVCP padding adjustment (issue #392)", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let requestAdjustSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        mockCtx = createMockContext({
            stylePaddingTop: 0,
        });

        mockState = createMockState({
            hasScrolled: false,
            props: {
                maintainVisibleContentPosition: true,
                stylePaddingTop: 0,
            },
            scroll: 0,
            scrollAdjustHandler: {
                requestAdjust: () => {},
            } as any,
        });

        requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
    });

    afterEach(() => {
        requestAdjustSpy.mockRestore();
    });

    /**
     * Simulates the MVCP padding adjustment logic from `initializeStateVars`
     * in LegendList.tsx. This is extracted here because the function is a
     * closure inside the component and cannot be imported directly.
     */
    function simulateMVCPPaddingAdjust(
        ctx: StateContext,
        state: InternalState,
        stylePaddingTopState: number,
        maintainVisibleContentPosition: boolean,
    ) {
        const prevPaddingTop = stateModule.peek$(ctx, "stylePaddingTop");
        stateModule.set$(ctx, "stylePaddingTop", stylePaddingTopState);

        let paddingDiff = stylePaddingTopState - prevPaddingTop;
        if (
            maintainVisibleContentPosition &&
            paddingDiff &&
            prevPaddingTop !== undefined &&
            state.hasScrolled &&
            Platform.OS === "ios"
        ) {
            if (state.scroll < 0) {
                paddingDiff += state.scroll;
            }
            requestAdjustModule.requestAdjust(ctx, state, paddingDiff);
        }
    }

    it("should NOT call requestAdjust on first render with paddingTop (hasScrolled=false)", () => {
        // Simulates first render: prevPaddingTop=0, new paddingTop=100, hasScrolled=false
        simulateMVCPPaddingAdjust(mockCtx, mockState, 100, true);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockState.scroll).toBe(0); // scroll unchanged
    });

    it("should call requestAdjust after user has scrolled and padding changes", () => {
        // Set up state as if user has scrolled and padding was previously set
        mockCtx.values.set("stylePaddingTop", 50);
        mockState.hasScrolled = true;
        mockState.scroll = 200;

        simulateMVCPPaddingAdjust(mockCtx, mockState, 100, true);

        expect(requestAdjustSpy).toHaveBeenCalledTimes(1);
        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, mockState, 50); // 100 - 50
    });

    it("should NOT call requestAdjust when maintainVisibleContentPosition is false", () => {
        mockState.hasScrolled = true;
        mockCtx.values.set("stylePaddingTop", 50);

        simulateMVCPPaddingAdjust(mockCtx, mockState, 100, false);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
    });

    it("should NOT call requestAdjust when paddingDiff is zero", () => {
        mockState.hasScrolled = true;
        mockCtx.values.set("stylePaddingTop", 100);

        simulateMVCPPaddingAdjust(mockCtx, mockState, 100, true);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
    });

    it("should NOT call requestAdjust when prevPaddingTop is undefined", () => {
        mockState.hasScrolled = true;
        mockCtx.values.delete("stylePaddingTop");

        simulateMVCPPaddingAdjust(mockCtx, mockState, 100, true);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
    });

    it("should adjust paddingDiff when scroll is negative", () => {
        mockState.hasScrolled = true;
        mockState.scroll = -20;
        mockCtx.values.set("stylePaddingTop", 50);

        simulateMVCPPaddingAdjust(mockCtx, mockState, 100, true);

        // paddingDiff = 100 - 50 = 50, then += scroll(-20) = 30
        expect(requestAdjustSpy).toHaveBeenCalledTimes(1);
        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, mockState, 30);
    });

    it("should handle ListHeaderComponent scenario (paddingTop from 0 to non-zero on first render)", () => {
        // This is the exact reproduction case from the issue:
        // paddingTop starts at 0, header adds padding, first render
        mockCtx.values.set("stylePaddingTop", 0);
        mockState.hasScrolled = false;

        simulateMVCPPaddingAdjust(mockCtx, mockState, 150, true);

        // Must NOT adjust — this is the bug fix
        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockState.scroll).toBe(0);
    });
});
