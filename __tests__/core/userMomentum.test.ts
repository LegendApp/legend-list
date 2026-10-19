import { describe, expect, it } from "bun:test";
import "../setup";

import { armUserMomentumStallCheck } from "../../src/core/userMomentum";
import { createMockContext } from "../__mocks__/createMockContext";

function makeStallContext() {
    const timeouts: Array<{ callback: () => void; delay: number }> = [];
    const ctx = createMockContext(
        {},
        {
            isMomentumScrolling: true,
            lastNativeScrollTime: 0,
            releasedFromUserDrag: true,
        },
    );
    ctx.state.scheduledWork.timeout = (callback, delay) => {
        timeouts.push({ callback, delay });
    };
    return { ctx, timeouts };
}

describe("user momentum stall check", () => {
    it("re-arms instead of finishing when the timer fires late", () => {
        const { ctx, timeouts } = makeStallContext();
        const realNow = Date.now;
        const t0 = realNow();

        try {
            Date.now = () => t0;
            armUserMomentumStallCheck(ctx);

            // A blocked JS thread fires the check past its due time while
            // scroll events may still be queued behind the block. Finishing
            // now would resume following mid-flick; re-arm one more window.
            Date.now = () => t0 + 650;
            timeouts[0].callback();
            expect(ctx.state.isMomentumScrolling).toBe(true);
            expect(timeouts.length).toBe(2);

            // With the thread healthy again, an on-time check over a silent
            // native scroll still recovers the settled flick.
            Date.now = () => t0 + 1150;
            timeouts[1].callback();
            expect(ctx.state.isMomentumScrolling).toBe(false);
            expect(ctx.state.releasedFromUserDrag).toBe(false);
        } finally {
            Date.now = realNow;
        }
    });

    it("finishes an on-time check once native scroll activity has stopped", () => {
        const { ctx, timeouts } = makeStallContext();
        const realNow = Date.now;
        const t0 = realNow();

        try {
            Date.now = () => t0;
            ctx.state.lastNativeScrollTime = t0;
            armUserMomentumStallCheck(ctx);

            // On time, with scroll events still fresh inside the window: the
            // flick is live, so the check waits another window.
            Date.now = () => t0 + 500;
            ctx.state.lastNativeScrollTime = t0 + 400;
            timeouts[0].callback();
            expect(ctx.state.isMomentumScrolling).toBe(true);

            // On time again with the native scroll silent past the window:
            // the settled flick recovers and ownership releases.
            Date.now = () => t0 + 1000;
            timeouts[1].callback();
            expect(ctx.state.isMomentumScrolling).toBe(false);
            expect(ctx.state.releasedFromUserDrag).toBe(false);
            expect(ctx.state.momentumStallFirstLateFireAt).toBeUndefined();
        } finally {
            Date.now = realNow;
        }
    });

    it("bounds recovery when every check fires late", () => {
        const { ctx, timeouts } = makeStallContext();
        const realNow = Date.now;
        const t0 = realNow();

        try {
            Date.now = () => t0;
            armUserMomentumStallCheck(ctx);

            // Every check arrives ~150ms too late to trust, so re-arms
            // continue while the late-fire run stays inside the ceiling.
            for (const fireAt of [650, 1300, 1950, 2600]) {
                Date.now = () => t0 + fireAt;
                timeouts.at(-1)!.callback();
                expect(ctx.state.isMomentumScrolling).toBe(true);
            }

            // The run has now outlived the ceiling: a permanently starved
            // timer still recovers rather than suspend following forever.
            Date.now = () => t0 + 3250;
            timeouts.at(-1)!.callback();
            expect(ctx.state.isMomentumScrolling).toBe(false);
        } finally {
            Date.now = realNow;
        }
    });
});
