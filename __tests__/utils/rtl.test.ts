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

    it("treats a negative native offset as overscroll bounce and clamps it", () => {
        // Was pinned to "negative" mode before; a transient bounce frame must not switch modes.
        expect(toLogicalHorizontalOffset(state, -120, 1000)).toBe(700);
        expect(state.horizontalRTLScrollType).toBe("inverted");
    });

    it("converts native offsets with the pinned inverted mode on native", () => {
        expect(toLogicalHorizontalOffset(state, 700, 1000)).toBe(0);
        expect(state.horizontalRTLScrollType).toBe("inverted");
    });

    it("uses the native RTL default (inverted) deterministically", () => {
        expect(toLogicalHorizontalOffset(state, 0, 1000)).toBe(700);
        expect(state.horizontalRTLScrollType).toBe("inverted");
    });

    it("stays pinned to inverted across frames instead of reclassifying (regression: blank on scroll)", () => {
        state.hasScrolled = true;
        state.scroll = 0;
        // A sequence that the old distance heuristic would have flipped to "normal" mid-scroll.
        expect(toLogicalHorizontalOffset(state, 700, 1000)).toBe(0);
        expect(toLogicalHorizontalOffset(state, 690, 1000)).toBe(10);
        expect(toLogicalHorizontalOffset(state, 0, 1000)).toBe(700);
        expect(state.horizontalRTLScrollType).toBe("inverted");
    });

    it("does not classify offsets without content size", () => {
        Platform.OS = "android";

        expect(toLogicalHorizontalOffset(state, 125, undefined)).toBe(125);
        expect(state.horizontalRTLScrollType).toBeUndefined();
    });

    it("still normalizes negative scroll offsets on web (RTL scroll root reports negative scrollLeft)", () => {
        Platform.OS = "web";
        expect(toLogicalHorizontalOffset(state, -120, 1000)).toBe(120);
        expect(state.horizontalRTLScrollType).toBe("negative");
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

    it("does not mirror item positions when the native tree is actually RTL (RN swaps left->start)", () => {
        I18nManager.isRTL = true;
        // Native + global RTL: return the logical position unchanged; mirroring here double-mirrors (#477).
        expect(toPhysicalHorizontalItemPosition(state, 200, 50, 1000)).toBe(200);

        state.props.rtl = false;
        expect(toPhysicalHorizontalItemPosition(state, 200, 50, 1000)).toBe(200);
    });

    it("mirrors item positions for a prop-forced rtl list on an LTR native tree", () => {
        // rtl prop, global I18nManager.isRTL === false: no native swap, so the JS mirror is needed.
        expect(toPhysicalHorizontalItemPosition(state, 200, 50, 1000)).toBe(750);

        state.props.rtl = false;
        expect(toPhysicalHorizontalItemPosition(state, 200, 50, 1000)).toBe(200);
    });

    it("mirrors item positions on web (container is forced direction: ltr there)", () => {
        Platform.OS = "web";
        expect(toPhysicalHorizontalItemPosition(state, 200, 50, 1000)).toBe(750);

        state.props.rtl = false;
        expect(toPhysicalHorizontalItemPosition(state, 200, 50, 1000)).toBe(200);
    });
});
