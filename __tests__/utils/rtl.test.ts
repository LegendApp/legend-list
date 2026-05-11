import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { I18nManager } from "react-native";

import { Platform } from "../../src/platform/Platform";
import type { InternalState } from "../../src/types.internal";
import {
    isHorizontalRTL,
    toLogicalHorizontalOffset,
    toNativeHorizontalOffset,
    toPhysicalHorizontalItemPosition,
} from "../../src/utils/rtl";
import { createMockState } from "../__mocks__/createMockState";

describe("rtl horizontal coordinate helpers", () => {
    let state: InternalState;
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        state = createMockState({
            props: {
                horizontal: true,
                rtl: true,
            },
            scrollLength: 300,
        });
        I18nManager.isRTL = false;
        Platform.OS = "ios";
    });

    afterEach(() => {
        I18nManager.isRTL = false;
        Platform.OS = originalPlatform;
    });

    it("respects list-level rtl overrides instead of only global I18nManager state", () => {
        I18nManager.isRTL = false;
        expect(isHorizontalRTL(state)).toBe(true);

        state.props.rtl = false;
        I18nManager.isRTL = true;
        expect(isHorizontalRTL(state)).toBe(false);
    });

    it("normalizes negative native offsets into logical offsets", () => {
        expect(toLogicalHorizontalOffset(state, -120, 1000)).toBe(120);
        expect(state.horizontalRTLScrollType).toBe("negative");
    });

    it("detects inverted native offsets from the first scroll sample", () => {
        expect(toLogicalHorizontalOffset(state, 700, 1000)).toBe(0);
        expect(state.horizontalRTLScrollType).toBe("inverted");
    });

    it("does not classify positive native offsets without content size", () => {
        Platform.OS = "android";

        expect(toLogicalHorizontalOffset(state, 125, undefined)).toBe(125);
        expect(state.horizontalRTLScrollType).toBeUndefined();
    });

    it("uses platform defaults for native offsets before a scroll sample classifies the mode", () => {
        Platform.OS = "android";
        expect(toNativeHorizontalOffset(state, 100, 1000)).toBe(600);
        expect(state.horizontalRTLScrollType).toBeUndefined();

        Platform.OS = "ios";
        expect(toNativeHorizontalOffset(state, 100, 1000)).toBe(600);
        expect(state.horizontalRTLScrollType).toBeUndefined();
    });

    it("uses the detected mode once one has been observed", () => {
        state.horizontalRTLScrollType = "inverted";
        expect(toNativeHorizontalOffset(state, 100, 1000)).toBe(600);

        state.horizontalRTLScrollType = "negative";
        expect(toNativeHorizontalOffset(state, 100, 1000)).toBe(-100);
    });

    it("mirrors logical item positions for physical horizontal rendering", () => {
        expect(toPhysicalHorizontalItemPosition(state, 200, 50, 1000)).toBe(750);

        state.props.rtl = false;
        expect(toPhysicalHorizontalItemPosition(state, 200, 50, 1000)).toBe(200);
    });
});
