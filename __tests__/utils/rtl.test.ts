import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { I18nManager } from "react-native";

import { getNativeScrollPoint } from "../../src/core/doScrollParams";
import { handleLayout } from "../../src/core/handleLayout";
import { onScroll } from "../../src/core/onScroll";
import { Platform } from "../../src/platform/Platform";
import type { InternalState } from "../../src/types.internal";
import {
    getStylePaddingEnd,
    isHorizontalRTL,
    peekLogicalHorizontalOffset,
    toLogicalHorizontalOffset,
    toNativeHorizontalOffset,
    toPhysicalHorizontalItemPosition,
} from "../../src/utils/rtl";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("rtl horizontal coordinate helpers", () => {
    let state: InternalState;
    const originalPlatform = Platform.OS;
    const originalGetComputedStyle = globalThis.getComputedStyle;

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
        globalThis.getComputedStyle = originalGetComputedStyle;
    });

    it("respects list-level rtl overrides instead of only global I18nManager state", () => {
        I18nManager.isRTL = false;
        expect(isHorizontalRTL(state)).toBe(true);

        state.props.rtl = false;
        I18nManager.isRTL = true;
        expect(isHorizontalRTL(state)).toBe(false);
    });

    it("preserves the native minWidth origin when the end inset extends a short container", () => {
        const ctx = createMockContext(
            { totalSize: 350 },
            {
                props: {
                    contentContainerMinSize: 861.667,
                    contentInset: { bottom: 0, left: 86, right: 0, top: 0 },
                    horizontal: true,
                    rtl: true,
                },
                scrollLength: 874,
            },
        );
        expect(getNativeScrollPoint(ctx, 0).x).toBe(0);
        expect(getNativeScrollPoint(ctx, 861.667 + 86 - 874).x).toBe(0);
    });

    it.each(["ios", "android"] as const)("round trips a minWidth RTL offset through %s scroll events", (platform) => {
        Platform.OS = platform;
        const ctx = createMockContext(
            { totalSize: 350 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                hasScrolled: true,
                horizontalRTLScrollType: "inverted",
                props: {
                    contentContainerMinSize: 1000,
                    contentInset: { bottom: 0, left: 86, right: 0, top: 0 },
                    horizontal: true,
                    rtl: true,
                },
                queuedInitialLayout: true,
                scrollLength: 600,
            },
        );
        try {
            const point = getNativeScrollPoint(ctx, 300);
            onScroll(ctx, {
                nativeEvent: {
                    contentInset: { bottom: 0, left: platform === "ios" ? 86 : 0, right: 0, top: 0 },
                    contentOffset: point,
                    contentSize: { height: 100, width: 1000 },
                    layoutMeasurement: { height: 100, width: 600 },
                },
            } as any);
            expect(ctx.state.scroll).toBe(300);
            expect(point.x).toBe(100);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("resolves style padding from the logical scroll end", () => {
        const paddings = {
            stylePaddingBottom: 10,
            stylePaddingLeft: 20,
            stylePaddingRight: 30,
        };

        expect(getStylePaddingEnd(paddings)).toBe(10);
        expect(getStylePaddingEnd({ ...paddings, horizontal: true, rtl: false })).toBe(30);
        expect(getStylePaddingEnd({ ...paddings, horizontal: true, rtl: true })).toBe(20);
    });

    it("keeps fresh web RTL observations and dispatch in the negative convention", () => {
        Platform.OS = "web";
        expect(toLogicalHorizontalOffset(state, 0, 1000)).toBe(0);
        expect(state.horizontalRTLScrollType).toBe("negative");
        expect(toNativeHorizontalOffset(state, 200, 1000)).toBe(-200);
        // A positive offset is overscroll beyond the logical start.
        state.hasScrolled = true;
        expect(toLogicalHorizontalOffset(state, 10, 1000)).toBe(0);
        expect(state.horizontalRTLScrollType).toBe("negative");
    });

    it("uses an LTR scroll owner for RTL dispatch and observation", () => {
        Platform.OS = "web";
        const owner = {} as HTMLElement;
        state.refScroller.current = { getScrollableNode: () => owner } as any;
        globalThis.getComputedStyle = ((element) => {
            expect(element).toBe(owner);
            return { direction: "ltr" } as CSSStyleDeclaration;
        }) as typeof getComputedStyle;

        expect(toNativeHorizontalOffset(state, 200, 1000)).toBe(200);
        expect(toLogicalHorizontalOffset(state, 0, 1000)).toBe(0);
        expect(state.horizontalRTLScrollType).toBe("normal");
        state.hasScrolled = true;
        state.horizontalRTLScrollType = "negative";
        expect(toLogicalHorizontalOffset(state, 650, 1000)).toBe(650);
        expect(peekLogicalHorizontalOffset(state, 650, 700)).toBe(650);
        expect(peekLogicalHorizontalOffset(state, -10, 700)).toBe(0);
        expect(toNativeHorizontalOffset(state, 650, 1000)).toBe(650);
    });

    it("uses the LTR document scroll owner for an RTL list", () => {
        Platform.OS = "web";
        state.horizontalRTLScrollType = "negative";
        const previousDocument = globalThis.document;
        const owner = {} as HTMLElement;
        globalThis.document = { documentElement: owner, scrollingElement: owner } as any;
        state.refScroller.current = { getScrollableNode: () => document.scrollingElement } as any;
        globalThis.getComputedStyle = ((element) => {
            expect(element).toBe(owner);
            return { direction: "ltr" } as CSSStyleDeclaration;
        }) as typeof getComputedStyle;
        try {
            expect(toNativeHorizontalOffset(state, 200, 1000)).toBe(200);
            expect(toLogicalHorizontalOffset(state, 200, 1000)).toBe(200);
        } finally {
            globalThis.document = previousDocument;
        }
    });

    it("places rendered RTL rows inside an LTR owner's logical viewport", () => {
        Platform.OS = "web";
        state.refScroller.current = { getScrollableNode: () => ({}) } as any;
        globalThis.getComputedStyle = (() => ({ direction: "ltr" })) as typeof getComputedStyle;
        for (const logicalOffset of [0, 1000]) {
            const rawOffset = toNativeHorizontalOffset(state, logicalOffset, 10000);
            const rowLeft = toPhysicalHorizontalItemPosition(state, logicalOffset, 100, 10000);
            expect(rowLeft).toBeGreaterThanOrEqual(rawOffset);
            expect(rowLeft + 100).toBeLessThanOrEqual(rawOffset + state.scrollLength);
        }
    });

    it("reads the owner direction once across 50 RTL scroll events", () => {
        Platform.OS = "web";
        const style = mock(() => ({ direction: "rtl" }) as CSSStyleDeclaration);
        globalThis.getComputedStyle = style as typeof getComputedStyle;
        const owner = {};
        const ctx = createMockContext(
            { totalSize: 3000 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                hasScrolled: true,
                props: { data: Array.from({ length: 30 }, (_, index) => index), horizontal: true, rtl: true },
                queuedInitialLayout: true,
                refScroller: { current: { getScrollableNode: () => owner } } as any,
                scrollLength: 300,
            },
        );
        try {
            for (let index = 1; index <= 50; index++) {
                onScroll(ctx, {
                    nativeEvent: {
                        contentOffset: { x: -index * 10, y: 0 },
                        contentSize: { height: 300, width: 3000 },
                        layoutMeasurement: { height: 300, width: 300 },
                    },
                } as any);
            }
            expect(ctx.state.scroll).toBe(500);
            expect(style).toHaveBeenCalledTimes(1);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("refreshes cached direction on layout and when the scroll owner changes", () => {
        Platform.OS = "web";
        let direction = "rtl";
        let owner = {};
        const style = mock(() => ({ direction }) as CSSStyleDeclaration);
        globalThis.getComputedStyle = style as typeof getComputedStyle;
        const layout = { height: 400, width: 300, x: 0, y: 0 };
        const ctx = createMockContext(
            {},
            {
                lastLayout: layout,
                otherAxisSize: 400,
                props: { horizontal: true, rtl: true },
                refScroller: { current: { getScrollableNode: () => owner } } as any,
                scrollLength: 300,
            },
        );
        expect(toNativeHorizontalOffset(ctx.state, 100, 1000)).toBe(-100);
        direction = "ltr";
        handleLayout(ctx, layout, () => {});
        expect(toNativeHorizontalOffset(ctx.state, 100, 1000)).toBe(100);
        direction = "rtl";
        owner = {};
        expect(toNativeHorizontalOffset(ctx.state, 100, 1000)).toBe(-100);
        expect(style).toHaveBeenCalledTimes(3);
    });

    it("normalizes negative native offsets into logical offsets", () => {
        state.horizontalRTLScrollType = "normal";
        expect(peekLogicalHorizontalOffset(state, -120, 700)).toBe(120);
        expect(toLogicalHorizontalOffset(state, -120, 1000)).toBe(120);
        expect(state.horizontalRTLScrollType).toBe("negative");
    });

    it("detects inverted native offsets from the first scroll sample", () => {
        expect(toLogicalHorizontalOffset(state, 700, 1000)).toBe(0);
        expect(state.horizontalRTLScrollType).toBe("inverted");
    });

    it("uses the native RTL default before a first scroll sample classifies the mode", () => {
        expect(toLogicalHorizontalOffset(state, 0, 1000)).toBe(700);
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
