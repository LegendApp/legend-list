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
});
