import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as initialScrollLifecycleModule from "../../src/core/initialScrollLifecycle";
import { updateContentInsetEndAdjustment } from "../../src/core/updateContentInsetEndAdjustment";
import { Platform } from "../../src/platform/Platform";
import { getContentInsetEnd } from "../../src/state/getContentInsetEnd";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateContentInsetEndAdjustment", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        Platform.OS = "web";
        mockCtx = createMockContext(
            {
                isWithinMaintainScrollAtEndThreshold: true,
                readyToRender: true,
            },
            {
                props: {
                    data: [1, 2, 3],
                },
                scroll: 100,
            },
        );
        mockState = mockCtx.state;
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    it("adds contentInsetEndAdjustment to the base end inset", () => {
        mockState.props.contentInset = { bottom: 24, left: 0, right: 0, top: 0 };
        mockState.props.contentInsetEndAdjustment = 48;

        expect(getContentInsetEnd(mockCtx)).toBe(72);

        mockState.contentInsetOverride = { bottom: 72 };

        expect(getContentInsetEnd(mockCtx)).toBe(120);
    });

    it("adjusts scroll by the effective inset increase when the list is end-pinned", () => {
        mockState.props.contentInsetEndAdjustment = 64;

        updateContentInsetEndAdjustment(mockCtx, 24);

        expect(mockState.scroll).toBe(140);
    });

    it("does not manually adjust web scroll when the effective inset decreases", () => {
        mockState.props.contentInsetEndAdjustment = 20;

        updateContentInsetEndAdjustment(mockCtx, 70);

        expect(mockState.scroll).toBe(100);
    });

    it("does not adjust scroll when the list is away from the end", () => {
        mockCtx.values.set("isWithinMaintainScrollAtEndThreshold", false);
        mockState.props.contentInsetEndAdjustment = 64;

        updateContentInsetEndAdjustment(mockCtx, 24);

        expect(mockState.scroll).toBe(100);
    });

    it("does not update when the effective end inset is unchanged", () => {
        mockState.props.contentInset = { bottom: 20, left: 0, right: 0, top: 0 };
        mockState.props.contentInsetEndAdjustment = 60;
        mockState.props.anchoredEndSpace = { anchorIndex: 1, includeInEndInset: true };
        mockCtx.values.set("anchoredEndSpaceSize", 100);

        updateContentInsetEndAdjustment(mockCtx, 40);

        expect(mockState.scroll).toBe(100);
    });

    it("adjusts by the additive effective inset delta", () => {
        mockState.props.contentInset = { bottom: 50, left: 0, right: 0, top: 0 };
        mockState.props.contentInsetEndAdjustment = 70;

        updateContentInsetEndAdjustment(mockCtx, 20);

        expect(mockState.scroll).toBe(150);
    });

    it("retargets active bottom initial scrolls when the end adjustment changes", () => {
        const retargetSpy = spyOn(initialScrollLifecycleModule, "retargetActiveInitialScrollAtEnd");
        retargetSpy.mockImplementation(() => true);
        mockState.props.contentInsetEndAdjustment = 64;

        updateContentInsetEndAdjustment(mockCtx, 24);

        expect(retargetSpy).toHaveBeenCalledWith(mockCtx);
        expect(mockState.scroll).toBe(100);

        retargetSpy.mockRestore();
    });
});
