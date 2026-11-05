import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("native geometry velocity", () => {
    let ctx: StateContext;
    let time: ReturnType<typeof spyOn>;
    let now: number;

    beforeEach(() => {
        Platform.OS = "ios";
        now = 1000;
        time = spyOn(Date, "now").mockImplementation(() => now);
        ctx = createMockContext(
            {},
            {
                lastScrollAdjustForHistory: 0,
                scroll: 4010,
                scrollHistory: [{ scroll: 4010, time: now }],
                scrollLength: 700,
                triggerCalculateItemsInView: () => {},
            },
        );
    });

    afterEach(() => {
        ctx.state.scheduledWork.dispose();
        time.mockRestore();
    });

    it.each([4010, 4020])("does not project native anchor correction after geometry changes at %ipx", (scroll) => {
        const calculate = spyOn(ctx.state, "triggerCalculateItemsInView");
        ctx.state.scrollLastCalculate = 4010;
        ctx.state.scrollForNextCalculateItemsInView = { bottom: 5000, top: 3000 };
        updateScroll(ctx, scroll, false, { fromNativeScrollEvent: true, nativeGeometryChanged: true });
        expect(ctx.state.scrollHistory).toEqual([]);
        expect(ctx.state.scrollForNextCalculateItemsInView).toBeUndefined();
        expect(calculate.mock.calls.at(-1)?.[0]?.scrollVelocity).toBe(0);
        now++;
        updateScroll(ctx, 4048, true, { fromNativeScrollEvent: true, nativeGeometryChanged: false });
        expect(calculate.mock.calls.at(-1)?.[0]?.scrollVelocity).toBe(0);
        expect(ctx.state.scroll).toBe(4048);
    });

    it("keeps real velocity when geometry is unchanged", () => {
        const calculate = spyOn(ctx.state, "triggerCalculateItemsInView");
        now++;
        updateScroll(ctx, 4048, true, { fromNativeScrollEvent: true, nativeGeometryChanged: false });
        expect(calculate.mock.calls.at(-1)?.[0]?.scrollVelocity).toBeGreaterThan(0);
    });
});
