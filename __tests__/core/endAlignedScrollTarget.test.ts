import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { maybeCorrectEndAlignedScrollAfterCommit } from "../../src/core/endAlignedScrollTarget";
import { createMockContext } from "../__mocks__/createMockContext";

describe("maybeCorrectEndAlignedScrollAfterCommit", () => {
    let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;

    beforeEach(() => {
        originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        }) as typeof globalThis.requestAnimationFrame;
    });

    afterEach(() => {
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    });

    // End content at 394259 + 441 = 394700, scrollLength 701 → end target 393999.
    const createEndAlignedContext = (
        scroll: number,
        scrollToCalls: Array<{ animated: boolean; x: number; y: number }>,
    ) => {
        const data = Array.from({ length: 1000 }, (_, index) => ({ id: index }));
        const positions = Array.from({ length: 1000 }, (_, index) => index * 401);
        positions[999] = 394259;

        return createMockContext(
            { totalSize: 394700 },
            {
                didContainersLayout: true,
                hasScrolled: true,
                positions,
                props: {
                    data,
                    estimatedItemSize: 401,
                } as any,
                refScroller: {
                    current: {
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scroll,
                scrollLength: 701,
                scrollPending: scroll,
                sizesKnown: new Map([["item_999", 441]]),
            },
        );
    };

    const endAlignedTarget = (animated: boolean) =>
        ({
            animated,
            index: 999,
            offset: 397479,
            targetOffset: 397179,
            viewOffset: 0,
            viewPosition: 1,
        }) as any;

    it("glides a large remainder when the finished session was animated", () => {
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createEndAlignedContext(393753, scrollToCalls);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, endAlignedTarget(true));

        expect(scrollToCalls).toEqual([{ animated: true, x: 0, y: 393999 }]);
    });

    it("snaps a small residue instantly even when the finished session was animated", () => {
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createEndAlignedContext(393969, scrollToCalls);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, endAlignedTarget(true));

        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 393999 }]);
    });

    it("corrects unanimated sessions without animation", () => {
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createEndAlignedContext(393753, scrollToCalls);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, endAlignedTarget(false));

        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 393999 }]);
    });

    it("does not dispatch when already at the corrected target", () => {
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createEndAlignedContext(393999, scrollToCalls);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, endAlignedTarget(true));

        expect(scrollToCalls).toEqual([]);
    });

    it("bails when a new scroll session started before the correction frame", () => {
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createEndAlignedContext(393753, scrollToCalls);
        ctx.state.scrollingTo = endAlignedTarget(true);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, endAlignedTarget(true));

        expect(scrollToCalls).toEqual([]);
    });
});
