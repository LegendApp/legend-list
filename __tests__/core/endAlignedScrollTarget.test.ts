import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { maybeCorrectEndAlignedScrollAfterCommit } from "../../src/core/endAlignedScrollTarget";
import {
    createEndAlignedScrollContext,
    createEndAlignedScrollTarget,
    type RecordedScrollTo,
} from "../__mocks__/createEndAlignedScrollContext";

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

    it("glides a large remainder when the finished session was animated", () => {
        const scrollToCalls: RecordedScrollTo[] = [];
        const ctx = createEndAlignedScrollContext(393753, scrollToCalls);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, createEndAlignedScrollTarget(true));

        expect(scrollToCalls).toEqual([{ animated: true, x: 0, y: 393999 }]);
    });

    it("snaps a small residue instantly even when the finished session was animated", () => {
        const scrollToCalls: RecordedScrollTo[] = [];
        const ctx = createEndAlignedScrollContext(393969, scrollToCalls);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, createEndAlignedScrollTarget(true));

        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 393999 }]);
    });

    it("corrects unanimated sessions without animation", () => {
        const scrollToCalls: RecordedScrollTo[] = [];
        const ctx = createEndAlignedScrollContext(393753, scrollToCalls);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, createEndAlignedScrollTarget(false));

        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 393999 }]);
    });

    it("does not dispatch when already at the corrected target", () => {
        const scrollToCalls: RecordedScrollTo[] = [];
        const ctx = createEndAlignedScrollContext(393999, scrollToCalls);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, createEndAlignedScrollTarget(true));

        expect(scrollToCalls).toEqual([]);
    });

    it("bails when a new scroll session started before the correction frame", () => {
        const scrollToCalls: RecordedScrollTo[] = [];
        const ctx = createEndAlignedScrollContext(393753, scrollToCalls);
        ctx.state.scrollingTo = createEndAlignedScrollTarget(true);

        maybeCorrectEndAlignedScrollAfterCommit(ctx, createEndAlignedScrollTarget(true));

        expect(scrollToCalls).toEqual([]);
    });
});
