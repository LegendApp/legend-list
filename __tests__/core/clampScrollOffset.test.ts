import { beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { clampScrollOffset } from "../../src/core/clampScrollOffset";
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

    it("extends the max offset for negative viewOffset", () => {
        expect(clampScrollOffset(mockCtx, 620, { viewOffset: -120 })).toBe(620);
        expect(clampScrollOffset(mockCtx, 700, { viewOffset: -120 })).toBe(620);
    });

    it("does not extend max offset for positive viewOffset", () => {
        expect(clampScrollOffset(mockCtx, 550, { viewOffset: 120 })).toBe(500);
    });

    it("extends the logical max for end-anchored initial scroll targets while scrollAdjust is negative", () => {
        mockCtx.state.props.data = Array.from({ length: 5 }, (_value, index) => ({ id: index }));
        mockCtx.state.scrollAdjustHandler = {
            getAdjust: () => -120,
            requestAdjust: () => {},
            setMounted: () => {},
        } as any;

        expect(clampScrollOffset(mockCtx, 620, { index: 4, isInitialScroll: true, viewPosition: 1 })).toBe(620);
        expect(clampScrollOffset(mockCtx, 700, { index: 4, isInitialScroll: true, viewPosition: 1 })).toBe(620);
    });

    it("does not extend the logical max for non-terminal initial scroll targets", () => {
        mockCtx.state.props.data = Array.from({ length: 5 }, (_value, index) => ({ id: index }));
        mockCtx.state.scrollAdjustHandler = {
            getAdjust: () => -120,
            requestAdjust: () => {},
            setMounted: () => {},
        } as any;

        expect(clampScrollOffset(mockCtx, 620, { index: 3, isInitialScroll: true, viewPosition: 1 })).toBe(500);
    });

    it("still clamps to zero at the lower bound", () => {
        expect(clampScrollOffset(mockCtx, -20, { viewOffset: -120 })).toBe(0);
    });
});
