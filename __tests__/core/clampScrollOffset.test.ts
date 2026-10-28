import { beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { clampScrollOffset } from "../../src/core/clampScrollOffset";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("clampScrollOffset", () => {
    let mockCtx: StateContext;

    beforeEach(() => {
        mockCtx = createMockContext(
            {
                footerSize: 0,
                headerSize: 0,
                stylePaddingTop: 0,
                totalSize: 1000,
            },
            {
                props: {
                    contentInset: { bottom: 0, left: 0, right: 0, top: 0 },
                    stylePaddingBottom: 0,
                },
                scrollLength: 500,
            },
        );
    });

    it("clamps to the base max offset when no target is provided", () => {
        expect(clampScrollOffset(mockCtx, 550)).toBe(500);
    });

    it.each([350, 800, 900])("adds the bottom inset after applying minHeight over %i points of content", (size) => {
        Platform.OS = "ios";
        mockCtx.state.totalSize = size;
        mockCtx.state.scrollLength = 874;
        mockCtx.state.props.contentContainerMinSize = 861.667;
        mockCtx.state.props.contentInset = { bottom: 86, left: 0, right: 0, top: 116 };
        const target = { clampToContentContainerMinSize: true };
        expect(clampScrollOffset(mockCtx, 0, target)).toBe(0);
        expect(clampScrollOffset(mockCtx, Infinity, target)).toBeCloseTo(Math.max(size, 861.667) + 86 - 874, 6);
        expect(clampScrollOffset(mockCtx, -1000, target)).toBe(-116);
    });

    it("ignores negative viewOffset only during web initial placement", () => {
        const previous = Platform.OS;
        Platform.OS = "web";
        try {
            expect(clampScrollOffset(mockCtx, 620, { isInitialScroll: true, viewOffset: -120 })).toBe(500);
            expect(clampScrollOffset(mockCtx, 620, { isInitialScroll: false, viewOffset: -120 })).toBe(620);
        } finally {
            Platform.OS = previous;
        }
    });

    it("extends the max offset for negative viewOffset", () => {
        expect(clampScrollOffset(mockCtx, 620, { viewOffset: -120 })).toBe(620);
        expect(clampScrollOffset(mockCtx, 700, { viewOffset: -120 })).toBe(620);
    });

    it("does not extend max offset for positive viewOffset", () => {
        expect(clampScrollOffset(mockCtx, 550, { viewOffset: 120 })).toBe(500);
    });

    it("still clamps to zero at the lower bound", () => {
        expect(clampScrollOffset(mockCtx, -20, { viewOffset: -120 })).toBe(0);
    });

    it.each([
        { base: 60, expected: -20, native: 60, reported: 20 },
        { base: undefined, expected: -20, native: 60, reported: 20 },
        { base: undefined, expected: -20, native: undefined, reported: 20 },
        { base: 60, expected: -60, native: undefined, reported: undefined },
        { base: -60, expected: -20, native: undefined, reported: 20 },
        { base: 60, expected: 0, native: undefined, reported: 0 },
        { base: 60, expected: 0, native: undefined, reported: -20 },
        { base: -60, expected: 0, native: undefined, reported: undefined },
    ])("uses the iOS top inset without double-counting native reports: %j", ({ base, native, reported, expected }) => {
        Platform.OS = "ios";
        mockCtx.state.props.contentInset = base === undefined ? undefined : { bottom: 0, left: 0, right: 0, top: base };
        mockCtx.state.nativeContentInset =
            native === undefined ? undefined : { bottom: 0, left: 0, right: 0, top: native };
        mockCtx.state.contentInsetOverride = reported === undefined ? undefined : { top: reported };
        expect(clampScrollOffset(mockCtx, -1000)).toBe(expected);
        expect(clampScrollOffset(mockCtx, -10)).toBe(Math.max(expected, -10));
        expect(clampScrollOffset(mockCtx, 1000)).toBe(500);
    });

    it("falls back to the base top when an override only reports the bottom", () => {
        Platform.OS = "ios";
        mockCtx.state.props.contentInset = { bottom: 0, left: 0, right: 0, top: 60 };
        mockCtx.state.contentInsetOverride = { bottom: 300 };
        expect(clampScrollOffset(mockCtx, -1000)).toBe(-60);
    });

    it("keeps horizontal iOS targets at zero despite a top inset", () => {
        Platform.OS = "ios";
        mockCtx.state.props.horizontal = true;
        mockCtx.state.props.contentInset = { bottom: 0, left: 40, right: 0, top: 60 };
        mockCtx.state.contentInsetOverride = { top: 20 };
        expect(clampScrollOffset(mockCtx, -100)).toBe(0);
    });
});
