import { describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { rearmEndFollowIfSettled } from "../../src/core/finishMaintainScrollAtEnd";
import { armUserScrollSettle, settleUserScroll } from "../../src/core/userMomentum";
import { createMockContext } from "../__mocks__/createMockContext";
import { installFakeClock } from "../helpers/webScrollHarness";

function makeContext() {
    return createMockContext(
        { totalSize: 1000 },
        {
            endFollowInterrupted: true,
            lastNativeScrollTime: 0,
            props: { data: [0], maintainScrollAtEnd: {}, maintainScrollAtEndThreshold: 0.25 },
            queuedInitialLayout: true,
            scroll: 690,
            scrollLength: 300,
            userScrollContentSize: 1000,
        },
    );
}

describe("user scroll settlement", () => {
    it.each([false, true])("waits for native quiet (momentum: %s)", (momentum) => {
        const clock = installFakeClock();
        const ctx = makeContext();
        let now = 0;
        const date = spyOn(Date, "now").mockImplementation(() => now);
        try {
            ctx.state.isMomentumScrolling = momentum;
            armUserScrollSettle(ctx);
            for (now = 100; now <= 600; now += 100) {
                ctx.state.lastNativeScrollTime = now - 50;
                clock.advance(100);
                expect(ctx.values.get("isFollowingEnd")).not.toBe(true);
            }
            const quiet = momentum ? 500 : 100;
            now = 600 + quiet;
            clock.advance(quiet);
            expect(ctx.values.get("isFollowingEnd")).toBe(true);
        } finally {
            ctx.state.scheduledWork.dispose();
            date.mockRestore();
            clock.restore();
        }
    });

    it("uses fresh geometry even when following and threshold intent are latched", () => {
        const ctx = makeContext();
        ctx.values.set("isFollowingEnd", true);
        ctx.values.set("isWithinMaintainScrollAtEndThreshold", true);
        ctx.state.scroll = 500;
        settleUserScroll(ctx);
        expect(ctx.values.get("isFollowingEnd")).toBe(false);
    });

    it("keeps a new drag in control when an old momentum end arrives", () => {
        const ctx = makeContext();
        ctx.state.isDragging = true;
        settleUserScroll(ctx);
        expect(ctx.values.get("isFollowingEnd")).not.toBe(true);
    });

    it.each([
        { contentSize: 1000, near: true, scroll: 690 },
        { contentSize: 1150, near: true, scroll: 690 },
        { contentSize: 1150, near: false, scroll: 400 },
    ])("settles baseline-free momentum without catching up at $scroll with content $contentSize", (scenario) => {
        const ctx = makeContext();
        const scrollToEnd = mock(() => Promise.resolve());
        ctx.scrollToEnd = scrollToEnd;
        ctx.state.userScrollContentSize = undefined;
        ctx.state.isMomentumScrolling = true;
        ctx.state.scroll = scenario.scroll;
        ctx.values.set("totalSize", scenario.contentSize);
        ctx.values.set("isScrollActive", true);
        ctx.values.set("isFollowingEnd", false);
        ctx.values.set("isWithinMaintainScrollAtEndThreshold", scenario.near);
        armUserScrollSettle(ctx);
        try {
            settleUserScroll(ctx);

            expect(ctx.values.get("isFollowingEnd")).toBe(scenario.near);
            expect(ctx.state.endFollowInterrupted).toBe(!scenario.near);
            expect(ctx.state.scroll).toBe(scenario.scroll);
            expect(ctx.state.userScrollContentSize).toBeUndefined();
            expect(ctx.state.isMomentumScrolling).toBe(false);
            expect(ctx.values.get("isScrollActive")).toBe(false);
            expect(ctx.state.scheduledWork.has("endFollowRearm")).toBe(false);
            expect(ctx.state.scheduledWork.has("maintainScrollAtEnd")).toBe(false);
            expect(scrollToEnd.mock.calls).toEqual([]);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it.each(["drag", "request", "completion", "app native scroll", "reader anchor"] as const)(
        "does not rearm through %s ownership when the baseline-free watchdog fires",
        (owner) => {
            const clock = installFakeClock();
            const date = spyOn(Date, "now").mockImplementation(() => clock.now);
            const ctx = makeContext();
            const resolve = mock(() => {});
            const scrollToEnd = mock(() => Promise.resolve());
            ctx.scrollToEnd = scrollToEnd;
            ctx.state.userScrollContentSize = undefined;
            ctx.state.isMomentumScrolling = true;
            ctx.values.set("isScrollActive", true);
            ctx.values.set("isFollowingEnd", false);
            ctx.values.set("isWithinMaintainScrollAtEndThreshold", true);
            if (owner === "drag") ctx.state.isDragging = true;
            if (owner === "request") ctx.state.scrollingTo = { offset: 690 } as any;
            if (owner === "completion") ctx.state.pendingScrollResolve = resolve;
            if (owner === "app native scroll") {
                ctx.state.scheduledWork.timeout(() => {}, 2000, "appScrollRearm");
            }
            if (owner === "reader anchor") ctx.state.visibleContentAnchor = { key: "reader", offset: 10 };
            const request = ctx.state.scrollingTo;
            const completion = ctx.state.pendingScrollResolve;
            try {
                armUserScrollSettle(ctx);
                clock.advance(700);

                expect(ctx.values.get("isFollowingEnd")).toBe(false);
                expect(ctx.state.endFollowInterrupted).toBe(true);
                expect(ctx.state.scrollingTo).toBe(request);
                expect(ctx.state.pendingScrollResolve).toBe(completion);
                expect(resolve).not.toHaveBeenCalled();
                expect(scrollToEnd.mock.calls).toEqual([]);
                expect(ctx.state.scroll).toBe(690);
                if (owner === "request" || owner === "completion") {
                    expect(ctx.values.get("isScrollActive")).toBe(true);
                }

                ctx.state.isDragging = false;
                ctx.state.isMomentumScrolling = false;
                ctx.state.scrollingTo = undefined;
                ctx.state.pendingScrollResolve = undefined;
                ctx.state.visibleContentAnchor = undefined;
                ctx.state.scheduledWork.cancel("appScrollRearm");
                rearmEndFollowIfSettled(ctx);
                expect(ctx.values.get("isFollowingEnd")).toBe(true);
                expect(scrollToEnd.mock.calls).toEqual([]);
            } finally {
                ctx.state.scheduledWork.dispose();
                date.mockRestore();
                clock.restore();
            }
        },
    );
});
