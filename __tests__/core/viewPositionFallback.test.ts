import { describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { calculateOffsetWithOffsetPosition } from "../../src/core/calculateOffsetWithOffsetPosition";
import { dispatchInitialScroll, resolveInitialScrollOffset } from "../../src/core/initialScroll";
import { prepareMVCP } from "../../src/core/mvcp";
import { scrollToIndex } from "../../src/core/scrollToIndex";
import { Platform } from "../../src/platform/Platform";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

function context(size: number, horizontal = false) {
    return createMockContext(
        { totalSize: 5000 },
        {
            positions: [0, 1000, 3000],
            props: {
                data: [0, 1, 2],
                estimatedItemSize: 100,
                horizontal,
                keyExtractor: (_, index) => `item_${index}`,
            },
            scrollLength: 600,
            sizesKnown: new Map([["item_1", size]]),
            totalSize: 5000,
        },
    );
}

describe("viewPositionFallback", () => {
    for (const platform of ["web", "ios", "android"] as const) {
        for (const [before, after] of [
            [100, 1000],
            [1000, 100],
            [1000, 1400],
        ]) {
            for (const fallback of ["start", "end"] as const) {
                it(`corrects ${platform} measurement ${before}→${after} with ${fallback} alignment`, () => {
                    const originalPlatform = Platform.OS;
                    Platform.OS = platform;
                    const ctx = context(before);
                    ctx.state.idCache = ["item_0", "item_1", "item_2"];
                    ctx.state.indexByKey = new Map(ctx.state.idCache.map((key, index) => [key, index]));
                    ctx.state.scrollingTo = {
                        index: 1,
                        itemSize: before,
                        offset: 1000,
                        viewPosition: 0.5,
                        viewPositionFallback: fallback,
                    };
                    const requested = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});
                    try {
                        const adjust = prepareMVCP(ctx, false, "size");
                        ctx.state.sizesKnown.set("item_1", after);
                        adjust?.();
                        const alignment = (size: number) => (size > 600 ? (fallback === "start" ? 0 : 1) : 0.5);
                        const expected = -alignment(after) * (600 - after) + alignment(before) * (600 - before);
                        if (expected === 0) {
                            expect(requested).not.toHaveBeenCalled();
                        } else {
                            expect(requested).toHaveBeenCalledWith(ctx, expected, "size");
                        }
                        expect(ctx.state.scrollingTo?.itemSize).toBe(after);
                    } finally {
                        requested.mockRestore();
                        Platform.OS = originalPlatform;
                    }
                });
            }
        }
    }
    for (const horizontal of [false, true]) {
        for (const size of [0, 100, 599, 600, 601, 2400]) {
            for (const fallback of [undefined, "start", "end"] as const) {
                it(`resolves ${horizontal ? "horizontal" : "vertical"} size ${size}, fallback ${fallback}`, () => {
                    const ctx = context(size, horizontal);
                    const position = size > 600 && fallback ? (fallback === "start" ? 0 : 1) : 0.5;
                    expect(
                        calculateOffsetWithOffsetPosition(ctx, 1000, {
                            index: 1,
                            viewPosition: 0.5,
                            viewPositionFallback: fallback,
                        }),
                    ).toBe(1000 - position * (600 - size));
                });
            }
        }
    }

    it("preserves viewOffset, header and padding while excluding the row gap", () => {
        const ctx = context(610);
        ctx.scrollAxisGap = 20;
        ctx.values.set("headerSize", 40);
        ctx.values.set("stylePaddingTop", 10);
        expect(
            calculateOffsetWithOffsetPosition(ctx, 1000, {
                index: 1,
                viewOffset: 25,
                viewPosition: 0.5,
                viewPositionFallback: "start",
            }),
        ).toBe(1020);
    });

    it("uses the available viewport after the trailing inset", () => {
        const ctx = context(580);
        ctx.state.props.contentInset = { bottom: 40, left: 0, right: 0, top: 0 };
        expect(
            calculateOffsetWithOffsetPosition(ctx, 1000, {
                index: 1,
                viewPosition: 0.5,
                viewPositionFallback: "start",
            }),
        ).toBe(1000);
    });

    it("re-evaluates initial alignment when the estimate or viewport changes", () => {
        const ctx = context(100);
        const target = { index: 1, viewPosition: 0.5, viewPositionFallback: "start" as const };
        expect(resolveInitialScrollOffset(ctx, target)).toBe(750);
        ctx.state.sizesKnown.set("item_1", 1000);
        expect(resolveInitialScrollOffset(ctx, target)).toBe(1000);
        ctx.state.scrollLength = 1200;
        expect(resolveInitialScrollOffset(ctx, target)).toBe(900);
    });

    it("retains the fallback through imperative and initial dispatch", () => {
        const ctx = context(1000);
        scrollToIndex(ctx, { animated: false, index: 1, viewPosition: 0.5, viewPositionFallback: "start" });
        expect(ctx.state.scrollingTo?.viewPositionFallback).toBe("start");
        expect(ctx.state.scrollingTo?.targetOffset).toBe(1000);
        dispatchInitialScroll(ctx, {
            forceScroll: true,
            resolvedOffset: 1000,
            target: { index: 1, viewPosition: 0.5, viewPositionFallback: "end" },
        });
        expect(ctx.state.scrollingTo?.viewPositionFallback).toBe("end");
    });
});
