import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { getCurrentTargetOffset } from "@/core/checkFinishedScroll";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { scrollToEnd } from "@/core/scrollToEnd";
import { Platform } from "@/platform/Platform";
import {
    createWebScrollHarness,
    flushMicrotasks,
    trackScroll,
    type WebScrollHarness,
} from "../helpers/webScrollHarness";

let harness: WebScrollHarness | undefined;

function setup(options?: Parameters<typeof createWebScrollHarness>[0]) {
    harness = createWebScrollHarness(options);
    return harness;
}

/** Lets the simulated browser and timers run until the scroll promise resolves or time runs out. */
async function runUntilResolved(h: WebScrollHarness, scroll: { resolved: boolean }, maxMs = 10000, px = 400) {
    for (let elapsed = 0; elapsed < maxMs && !scroll.resolved; elapsed += 16) {
        h.browser.step(px);
        h.clock.tick();
        await flushMicrotasks();
    }
}

/** Steps the smooth scroll until it first reaches `offset`, without following later retries. */
function stepUntil(h: WebScrollHarness, offset: number) {
    for (let i = 0; i < 100 && h.browser.offset !== offset; i++) {
        h.browser.step(400);
        h.clock.tick();
    }
}

/** Offset that puts `index` at `viewPosition` within the viewport, clamped to the content. */
function alignedOffset(h: WebScrollHarness, index: number, viewPosition = 0) {
    const size = h.state.sizes.get(`item_${index}`)!;
    return h.targetOffsetForIndex(index) === 0 && viewPosition === 0
        ? 0
        : Math.max(
              0,
              Math.min(
                  h.state.positions[index]! - viewPosition * (h.state.scrollLength - size),
                  h.ctx.state.totalSize - h.state.scrollLength,
              ),
          );
}

beforeEach(() => {
    Platform.OS = "web";
});

afterEach(() => {
    harness?.restore();
    harness = undefined;
});

describe("instant web scroll completion", () => {
    it("lands a cold RTL initial target on the first frame without fallback dispatches", async () => {
        const h = setup({ horizontal: true, horizontalRTLScrollType: "negative", rtl: true });
        // The browser uses negative coordinates before the list has observed any scroll event.
        h.state.horizontalRTLScrollType = undefined;
        h.state.didContainersLayout = true;
        h.state.didFinishInitialScroll = false;
        h.state.hasScrolled = false;
        h.state.initialScroll = { contentOffset: 1500, index: 15 };
        h.state.initialScrollSession = { kind: "bootstrap", previousDataLength: 100 };
        h.state.scrollingTo = {
            animated: false,
            index: 15,
            isInitialScroll: true,
            offset: 1500,
            targetOffset: 1500,
        };
        h.state.scrollPending = 1500;
        const { doScrollTo } = await import("@/core/doScrollTo");
        doScrollTo(h.ctx, { animated: false, horizontal: true, isInitialScroll: true, offset: 1500 });

        h.clock.tick();
        expect(h.browser.rawOffset).toBe(-1500);
        expect(h.state.scroll).toBe(1500);
        expect(h.state.didFinishInitialScroll).toBe(true);
        expect(h.state.scheduledWork.has("checkFinishedScrollFallback")).toBe(false);
        h.clock.advance(3000);
        expect(h.scrollToCalls).toEqual([{ animated: false, x: -1500, y: 0 }]);
    });

    for (const mode of ["vertical", "horizontal", "negative RTL", "inverted RTL"] as const) {
        const options = {
            horizontal: mode !== "vertical",
            horizontalRTLScrollType: mode === "negative RTL" ? "negative" : "inverted",
            rtl: mode.endsWith("RTL"),
        } as const;

        it(`confirms the observed ${mode} offset on the next frame`, async () => {
            const h = setup(options);
            const scroll = trackScroll(h.ref.scrollToOffset({ animated: false, offset: 1500 }));
            expect(scroll.resolved).toBe(false);

            h.clock.tick();
            await flushMicrotasks();

            expect(h.clock.now).toBe(16);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(1500);
        });

        it(`keeps the fallback when the ${mode} DOM offset does not confirm the request`, async () => {
            const h = setup(options);
            h.state.didContainersLayout = true;
            h.state.hasScrolled = true;
            h.state.refScroller.current!.scrollTo = () => {};
            const scroll = trackScroll(h.ref.scrollToOffset({ animated: false, offset: 1500 }));

            h.clock.tick();
            await flushMicrotasks();

            expect(h.browser.offset).toBe(0);
            expect(scroll.resolved).toBe(false);
            expect(h.state.scheduledWork.has("checkFinishedScrollFallback")).toBe(true);
            h.clock.advance(99);
            await flushMicrotasks();
            expect(scroll.resolved).toBe(false);
            h.clock.advance(1);
            await flushMicrotasks();
            expect(scroll.resolved).toBe(true);
        });
    }

    it("does not finish an unconfirmed offset initial scroll from optimistic state", async () => {
        const h = setup();
        h.state.didContainersLayout = true;
        h.state.didFinishInitialScroll = false;
        h.state.initialScroll = { contentOffset: 1500 };
        h.state.initialScrollSession = { kind: "offset", previousDataLength: 100 };
        h.state.scrollingTo = {
            animated: false,
            isInitialScroll: true,
            offset: 1500,
            targetOffset: 1500,
            waitForInitialScrollCompletionFrame: true,
        };
        h.state.scrollPending = 1500;
        h.state.refScroller.current!.scrollTo = () => {};
        const { doScrollTo } = await import("@/core/doScrollTo");
        doScrollTo(h.ctx, { animated: false, isInitialScroll: true, offset: 1500 });

        h.clock.tick();
        expect(h.browser.offset).toBe(0);
        expect(h.state.scrollingTo).toBeDefined();
        expect(h.state.scheduledWork.has("checkFinishedScrollFallback")).toBe(true);
        h.clock.advance(99);
        expect(h.state.scrollingTo).toBeDefined();
    });

    for (const mode of ["negative", "inverted"] as const) {
        it(`retries a near-landed initial scroll using ${mode} RTL coordinates`, async () => {
            const h = setup({ horizontal: true, horizontalRTLScrollType: mode, rtl: true });
            h.state.didContainersLayout = true;
            h.state.didFinishInitialScroll = false;
            h.state.hasScrolled = false;
            h.state.initialScroll = { contentOffset: 1500 };
            h.state.initialScrollSession = { kind: "offset", previousDataLength: 100 };
            h.state.scrollingTo = {
                animated: false,
                isInitialScroll: true,
                offset: 1500,
                targetOffset: 1500,
                waitForInitialScrollCompletionFrame: true,
            };
            h.state.scrollPending = 1500;
            const scroller = h.state.refScroller.current!;
            const scrollTo = scroller.scrollTo;
            scroller.scrollTo = (params) => {
                // The first dispatch lands two pixels short; subsequent requests land exactly.
                scrollTo(h.scrollToCalls.length === 0 ? { ...params, x: mode === "negative" ? -1498 : 8002 } : params);
            };
            const { doScrollTo } = await import("@/core/doScrollTo");
            doScrollTo(h.ctx, { animated: false, horizontal: true, isInitialScroll: true, offset: 1500 });

            h.clock.tick();
            expect(h.browser.offset).toBe(1498);
            expect(h.state.scrollingTo).toBeDefined();
            expect(h.state.scheduledWork.has("checkFinishedScrollFallback")).toBe(true);
            h.clock.advance(1100);

            expect(h.browser.offset).toBe(1500);
            expect(h.scrollToCalls).toHaveLength(2);
            expect(h.scrollToCalls[1]).toEqual({ animated: false, x: mode === "negative" ? -1500 : 8000, y: 0 });
            expect(h.state.scrollingTo).toBeUndefined();
            expect(h.state.didFinishInitialScroll).toBe(true);
        });
    }

    it("retains next-frame completion for custom scrollers without offset observation", async () => {
        const h = setup();
        h.state.refScroller.current!.getCurrentScrollOffset = undefined;
        const scroll = trackScroll(h.ref.scrollToOffset({ animated: false, offset: 1500 }));

        h.clock.tick();
        await flushMicrotasks();

        expect(scroll.resolved).toBe(true);
        expect(scroll.value).toBeUndefined();
        expect(h.state.scroll).toBe(1500);
        expect(h.state.scrollPending).toBe(1500);
    });

    it("rechecks a clamped offset after the footer shrinks before the completion frame", async () => {
        const h = setup();
        h.ctx.values.set("footerSize", 120);
        let observedOffset = 0;
        const scroller = h.state.refScroller.current!;
        scroller.getCurrentScrollOffset = () => observedOffset;
        scroller.scrollTo = ({ y }) => {
            observedOffset = y!;
        };
        const scroll = trackScroll(h.ref.scrollToOffset({ animated: false, offset: 12000 }));
        expect(observedOffset).toBe(9620);
        h.ctx.values.set("footerSize", 0);

        h.clock.tick();
        await flushMicrotasks();
        expect(getCurrentTargetOffset(h.ctx, h.state.scrollingTo!)).toBe(9500);
        expect(scroll.resolved).toBe(false);
        expect(h.state.scheduledWork.has("checkFinishedScrollFallback")).toBe(true);

        observedOffset = 9500;
        h.browser.moveTo(observedOffset);
        h.clock.tick();
        await flushMicrotasks();
        expect(scroll.resolved).toBe(true);
    });

    it("rechecks an end target after the width changes before the completion frame", async () => {
        const h = setup({ horizontal: true });
        const scroll = trackScroll(h.ref.scrollToIndex({ animated: false, index: 99, viewPosition: 1 }));
        expect(h.browser.offset).toBe(9500);
        h.state.scrollLength = 400;
        const target = getCurrentTargetOffset(h.ctx, h.state.scrollingTo!);
        expect(target).toBe(9600);

        h.clock.tick();
        await flushMicrotasks();
        expect(scroll.resolved).toBe(false);
        expect(h.state.scheduledWork.has("checkFinishedScrollFallback")).toBe(true);

        h.browser.moveTo(target);
        h.clock.tick();
        await flushMicrotasks();
        expect(scroll.resolved).toBe(true);
        expect(h.browser.offset).toBe(target);
    });

    it("settles from the observed offset when width moves the target before any scroll event", async () => {
        const h = setup({ horizontal: true });
        let observedOffset = 0;
        const scroller = h.state.refScroller.current!;
        scroller.getCurrentScrollOffset = () => observedOffset;
        scroller.scrollTo = ({ x }) => {
            observedOffset = x!;
        };
        const scroll = trackScroll(h.ref.scrollToIndex({ animated: false, index: 99, viewPosition: 1 }));
        expect(observedOffset).toBe(9500);
        h.state.scrollLength = 400;
        observedOffset = 9600;

        h.clock.tick();
        await flushMicrotasks();

        expect(scroll.resolved).toBe(true);
        expect(h.state.scroll).toBe(observedOffset);
        expect(h.state.scrollPending).toBe(observedOffset);
    });
});

describe("animated web scrolls resolve only once landed", () => {
    describe("late measurement", () => {
        it("does not resolve while passing a recomputed target on the way to the issued destination", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.measure({ 20: 0, 21: 0, 22: 0, 23: 0, 24: 0 });
            h.browser.step(3500);
            h.clock.tick();
            await flushMicrotasks();
            expect(h.browser.offset).toBe(4500);
            expect(h.browser.destination).toBe(5000);
            expect(scroll.resolved).toBe(false);

            await runUntilResolved(h, scroll);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(4500);
            expect(h.browser.destination).toBeUndefined();
        });

        it("rechecks an already aligned request when measurement moves its target before the next frame", async () => {
            const h = setup();
            h.browser.moveTo(5000);
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.measure({ 20: 600 });

            await runUntilResolved(h, scroll);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5500);
        });

        it("stops the old animation when idle fires while it is passing the recomputed target", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.measure({ 20: 0, 21: 0, 22: 0, 23: 0, 24: 0 });
            h.browser.step(3500);
            h.clock.advance(200);
            await flushMicrotasks();

            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(4500);
            expect(h.browser.destination).toBeUndefined();
            expect(h.scrollToCalls.at(-1)).toEqual({ animated: false, y: 4500 });
        });

        it("retargets when rows above the target measure taller mid-scroll", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            expect(h.browser.destination).toBe(5000);

            h.browser.step(1000);
            h.browser.step(1000);
            h.measure({ 30: 300, 31: 300, 32: 200 });
            expect(h.targetOffsetForIndex(50)).toBe(5500);

            // The browser lands on the offset requested before the rows measured.
            stepUntil(h, 5000);
            await flushMicrotasks();
            expect(h.browser.offset).toBe(5000);
            expect(scroll.resolved).toBe(false);
            expect(h.scrollToCalls.at(-1)).toEqual({ animated: true, y: 5500 });

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5500);
            expect(h.state.scrollingTo).toBeUndefined();
        });

        it("retargets back up when rows above the target measure shorter and the scroll overshoots", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.measure(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [20 + i, 50])));
            expect(h.targetOffsetForIndex(50)).toBe(4500);

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(4500);
            expect(h.scrollToCalls).toEqual([
                { animated: true, y: 5000 },
                { animated: true, y: 4500 },
            ]);
        });

        it("does not retry when only rows below the target measure late", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.measure(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [60 + i, 250])));

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5000);
            expect(h.scrollToCalls).toHaveLength(1);
        });

        it("snaps instantly when the remaining correction is small", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.measure({ 30: 130 });

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5030);
            expect(h.scrollToCalls.at(-1)).toEqual({ animated: false, y: 5030 });
        });

        it("rechecks an instant landing when measurement changes before its completion frame", async () => {
            const h = setup();
            let landed: { offset: number; target: number } | undefined;
            const scroll = trackScroll(
                h.ref.scrollToIndex({ animated: true, index: 50 }).then((result) => {
                    landed = { offset: h.browser.offset, target: h.targetOffsetForIndex(50) };
                    return result;
                }),
            );

            h.browser.step(1000);
            h.measure({ 30: 130 });
            h.browser.settle();
            await flushMicrotasks();

            expect(h.scrollToCalls.at(-1)).toEqual({ animated: false, y: 5030 });
            expect(scroll.resolved).toBe(false);
            h.measure({ 30: 330 });
            await runUntilResolved(h, scroll);
            await flushMicrotasks();

            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(landed?.offset).toBe(landed?.target);
            expect(h.state.scrollingTo).toBeUndefined();
        });

        it("tracks a variable-height target that measures late with viewPosition 1", async () => {
            const h = setup({ itemSize: (index) => 50 + (index % 5) * 30 });
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 40, viewPosition: 1 }));
            const initialTarget = alignedOffset(h, 40, 1);
            expect(h.browser.destination).toBe(initialTarget);

            h.browser.step(600);
            h.measure({ 12: 400, 40: 320 });
            const landed = alignedOffset(h, 40, 1);
            expect(landed).not.toBe(initialTarget);

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(landed);
        });
    });

    describe("targets near the edges", () => {
        it("retargets a target near the start when the first row measures late", async () => {
            const h = setup();
            h.browser.moveTo(3000);
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 1 }));
            expect(h.browser.destination).toBe(100);

            h.browser.step(1000);
            h.measure({ 0: 300 });

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(300);
        });

        it("lands index 0 at the top regardless of late measurement", async () => {
            const h = setup();
            h.browser.moveTo(3000);
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 0 }));

            h.browser.step(1000);
            h.measure({ 0: 300, 1: 300 });

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(0);
            expect(h.scrollToCalls).toHaveLength(1);
        });

        it("follows the end when rows above the last item grow during the scroll", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 99 }));
            expect(h.browser.destination).toBe(9500);

            h.browser.step(2000);
            h.measure({ 10: 300, 11: 300, 12: 300, 13: 300, 14: 300 });

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(10500);
        });

        it("lands scrollToEnd on the grown end", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToEnd({ animated: true }));
            h.clock.tick();

            h.browser.step(2000);
            h.measure({ 20: 600 });

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(10000);
        });

        it("reaches a scrollToOffset target that was clamped until content grew", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 12000 }));
            expect(h.browser.destination).toBe(9500);

            h.browser.step(2000);
            h.measure(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 400])));

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(12000);
        });
    });

    describe("settling short of the target", () => {
        it("retries when the idle timer fires while the smooth scroll is stalled", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(500);
            h.browser.step(500);
            // A long main-thread task (mounting rows) delays scroll events past the idle window.
            h.clock.advance(100);
            await flushMicrotasks();
            expect(scroll.resolved).toBe(false);
            expect(h.scrollToCalls).toEqual([
                { animated: true, y: 5000 },
                { animated: true, y: 5000 },
            ]);

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5000);
        });

        it("retries at the max timeout instead of resolving short", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            // A slow smooth scroll keeps emitting events, so idle never fires before the max timeout.
            while (h.clock.now < 1600) {
                h.browser.step(20);
                h.clock.advance(48);
            }
            await flushMicrotasks();
            expect(h.browser.offset).toBeLessThan(5000);
            expect(scroll.resolved).toBe(false);
            expect(h.scrollToCalls).toHaveLength(2);

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5000);
        });

        it("ignores an early scrollend that fires before the smooth scroll settles", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.browser.scrollEnd();
            await flushMicrotasks();
            expect(scroll.resolved).toBe(false);
            expect(h.scrollToCalls).toHaveLength(1);

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5000);
        });
    });

    describe("interruption and supersession", () => {
        it("detects keyboard scrolling toward the target before any animation progress", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.interruptByUser("keyboard");
            h.browser.interruptByUser("none");
            h.browser.moveTo(500);
            h.clock.advance(3000);
            await flushMicrotasks();

            expect(scroll.value).toEqual({ reason: "interrupted" });
            expect(h.scrollToCalls).toHaveLength(2);
        });

        it("clears queued end-follow work when touch input interrupts an active end scroll", async () => {
            const h = setup();
            h.ctx.scrollToEnd = (options) => scrollToEnd(h.ctx, options);
            h.state.props.maintainScrollAtEnd = { animated: true } as any;
            h.state.didFinishInitialScroll = true;
            h.state.didContainersLayout = true;
            const scroll = trackScroll(h.ref.scrollToEnd({ animated: true }));
            h.browser.step(1000);
            h.state.pendingMaintainScrollAtEnd = true;
            h.state.maintainingScrollAtEnd = "animated";

            h.browser.interruptByUser("touchstart");
            await flushMicrotasks();
            expect(scroll.value).toEqual({ reason: "interrupted" });
            expect(h.state.pendingMaintainScrollAtEnd).toBe(false);
            expect(h.state.maintainingScrollAtEnd).toBeUndefined();
            expect(h.state.endFollowInterrupted).toBe(true);
            expect(h.ctx.values.get("isFollowingEnd")).toBe(false);

            h.measure({ 30: 300 });
            doMaintainScrollAtEnd(h.ctx);
            h.clock.advance(3000);
            expect(h.scrollToCalls).toHaveLength(2);
        });

        for (const input of ["wheel", "touchstart"]) {
            it(`resolves interrupted without retrying when ${input} input stops the scroll`, async () => {
                const h = setup();
                const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

                h.browser.step(1000);
                h.measure({ 30: 300 });
                h.browser.interruptByUser(input);
                await flushMicrotasks();
                expect(scroll.value).toEqual({ reason: "interrupted" });
                expect(h.state.scrollingTo).toBeUndefined();

                h.clock.advance(3000);
                expect(h.scrollToCalls).toHaveLength(2);
                expect(h.browser.offset).toBe(1000);
            });
        }

        it("does not cancel a queued replacement when an older instant landing cannot reach its target", async () => {
            const h = setup();
            const scroller = h.state.refScroller.current!;
            const originalScrollTo = scroller.scrollTo;
            scroller.scrollTo = (options) => originalScrollTo({ ...options, y: Math.round(options.y! / 1000) * 1000 });
            const first = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 1250 }));
            while (h.scrollToCalls.length < 3) {
                h.browser.settle();
                h.clock.tick();
            }
            expect(h.scrollToCalls).toHaveLength(3);
            h.state.didDataChange = true;
            const replacement = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 2000 }));
            h.clock.tick();
            await flushMicrotasks();
            expect(first.value).toEqual({ reason: "superseded" });
            expect(replacement.resolved).toBe(false);
            h.state.didDataChange = false;
            await runUntilResolved(h, replacement);
            expect(replacement.resolved).toBe(true);
            expect(replacement.value).toBeUndefined();
            expect(h.browser.offset).toBe(2000);
        });

        it("does not treat the previous animation's last frame after a reversing retry as user input", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            // A slow scroll down is still short of 5000 when rows above shrink and the max timeout retries upward.
            while (h.clock.now < 1400) {
                h.browser.step(130);
                h.clock.advance(48);
            }
            h.measure(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i, 50])));
            while (h.scrollToCalls.length < 2) {
                h.browser.step(130);
                h.clock.advance(48);
            }
            const reversedFrom = h.browser.offset;
            expect(h.scrollToCalls.at(-1)?.y).toBeLessThan(reversedFrom);

            // Chrome can carry the old downward velocity into the first frame of the reissued scroll.
            h.browser.moveTo(reversedFrom + 30);
            await flushMicrotasks();
            expect(scroll.resolved).toBe(false);

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(h.targetOffsetForIndex(50));
        });

        it("resolves interrupted when user input arrives during a landing retry", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.measure({ 30: 600 });
            stepUntil(h, 5000);
            expect(h.scrollToCalls).toHaveLength(2);

            h.browser.step(100);
            h.browser.interruptByUser();
            await flushMicrotasks();
            expect(scroll.value).toEqual({ reason: "interrupted" });
            h.clock.advance(3000);
            expect(h.scrollToCalls).toHaveLength(3);
        });

        it("resolves superseded when a newer scroll replaces one that is retrying", async () => {
            const h = setup();
            const first = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.measure({ 30: 600 });
            stepUntil(h, 5000);
            expect(h.scrollToCalls).toHaveLength(2);

            const second = trackScroll(h.ref.scrollToIndex({ animated: true, index: 10 }));
            await flushMicrotasks();
            expect(first.value).toEqual({ reason: "superseded" });

            await runUntilResolved(h, second);
            expect(second.value).toBeUndefined();
            expect(h.browser.offset).toBe(1000);
        });
    });

    describe("data changes during the scroll", () => {
        it("retries against the clamped index and preserves alignment after data shrinks", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50, viewOffset: 600 }));

            h.browser.step(1000);
            h.setData(40);

            await runUntilResolved(h, scroll);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(3300);
            expect(h.scrollToCalls.at(-1)?.y).toBe(3300);
        });

        it("clamps to the new last row when data shrinks below the target index", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.setData(40);

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(3500);
        });

        it("keeps the target when rows append after it", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.setData(150);

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5000);
            expect(h.scrollToCalls).toHaveLength(1);
        });

        it("retargets when replaced data measures differently above the target", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.setData(120);
            h.measure({ 5: 900 });

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5800);
        });
    });

    describe("browsers without scrollend", () => {
        it("lands via idle settling when there is nothing to correct", async () => {
            const h = setup({ supportsScrollEnd: false });
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5000);
            expect(h.scrollToCalls).toHaveLength(1);
        });

        it("retargets after idle settling when rows above measure late", async () => {
            const h = setup({ supportsScrollEnd: false });
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.measure({ 30: 300, 31: 300, 32: 200 });
            stepUntil(h, 5000);
            h.clock.advance(100);
            await flushMicrotasks();
            expect(scroll.resolved).toBe(false);
            expect(h.scrollToCalls.at(-1)).toEqual({ animated: true, y: 5500 });

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5500);
        });
    });

    describe("bounded retries", () => {
        it("keeps finishing an animated initial scroll when it settles, without retrying", async () => {
            const h = setup();
            h.state.scrollingTo = { animated: true, index: 50, isInitialScroll: true, offset: 5000, viewPosition: 0 };
            const { doScrollTo } = await import("@/core/doScrollTo");
            doScrollTo(h.ctx, { animated: true, isInitialScroll: true, offset: 5000 });

            h.browser.step(1000);
            h.clock.advance(100);
            expect(h.state.scrollingTo).toBeUndefined();
            expect(h.scrollToCalls).toHaveLength(1);
        });

        it("stops retrying a target that keeps moving and lands with one instant scroll", async () => {
            const h = setup();
            let growth = 100;
            h.hooks.onScrollEvent = () => {
                // Measurements keep moving the target throughout the smooth retries.
                if (h.scrollToCalls.at(-1)?.animated) {
                    growth += 50;
                    h.measure({ 10: growth });
                }
            };
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            await runUntilResolved(h, scroll, 20000, 300);
            expect(scroll.resolved).toBe(true);
            expect(scroll.rejected).toBe(false);
            expect(h.scrollToCalls.length).toBeLessThanOrEqual(4);
            expect(h.scrollToCalls.at(-1)?.animated).toBe(false);
            expect(h.browser.offset).toBe(h.targetOffsetForIndex(50));

            const calls = h.scrollToCalls.length;
            h.hooks.onScrollEvent = undefined;
            h.clock.advance(10000);
            expect(h.scrollToCalls).toHaveLength(calls);
            expect(h.state.scrollingTo).toBeUndefined();
        });

        it("snaps instantly once a retry makes no progress", async () => {
            const h = setup();
            h.hooks.ignoreAnimatedScrolls = true;
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            await runUntilResolved(h, scroll);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5000);
            expect(h.scrollToCalls).toEqual([
                { animated: true, y: 5000 },
                { animated: true, y: 5000 },
                { animated: false, y: 5000 },
            ]);
        });
    });
});

for (const mode of ["vertical LTR", "horizontal LTR", "negative RTL", "inverted RTL"] as const) {
    describe(`${mode} observed landing offsets`, () => {
        const setupMode = () =>
            setup({
                horizontal: mode !== "vertical LTR",
                horizontalRTLScrollType:
                    mode === "negative RTL" ? "negative" : mode === "inverted RTL" ? "inverted" : undefined,
                rtl: mode.endsWith("RTL"),
            });

        it("lands without treating movement toward the target as interruption", async () => {
            const h = setupMode();
            if (mode === "inverted RTL") expect(h.browser.rawOffset).toBe(9500);
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.browser.step(1000);
            h.browser.step(1000);
            await flushMicrotasks();
            expect(scroll.resolved).toBe(false);
            await runUntilResolved(h, scroll);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5000);
            if (mode === "inverted RTL") expect(h.browser.rawOffset).toBe(4500);
            expect(h.scrollToCalls).toHaveLength(1);
        });

        it("finishes an aligned request on the next frame without retrying", async () => {
            const h = setupMode();
            h.browser.moveTo(5000);
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.clock.tick();
            await flushMicrotasks();
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.scrollToCalls).toHaveLength(1);
        });

        it("rechecks the logical target after an aligned request measures late", async () => {
            const h = setupMode();
            h.browser.moveTo(5000);
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.measure({ 20: 600 });
            await runUntilResolved(h, scroll);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5500);
        });

        it("retargets after late measurement changes both the target and extent", async () => {
            const h = setupMode();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.browser.step(1000);
            h.measure({ 20: 600 });
            await runUntilResolved(h, scroll);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5500);
            expect(h.scrollToCalls).toHaveLength(2);
        });

        it("verifies an instant correction on the next frame", async () => {
            const h = setupMode();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.browser.step(1000);
            h.measure({ 20: 130 });
            h.browser.settle();
            h.clock.tick();
            await flushMicrotasks();
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5030);
            expect(h.scrollToCalls.at(-1)?.animated).toBe(false);
        });

        for (const request of ["index", "offset"] as const) {
            it(`keeps ${request} ownership through layout reversals without user input`, async () => {
                const h = setupMode();
                const scroll = trackScroll(
                    request === "index"
                        ? h.ref.scrollToIndex({ animated: true, index: 50 })
                        : h.ref.scrollToOffset({ animated: true, offset: 5000 }),
                );
                h.browser.step(1000);
                h.browser.step(1000);
                h.measure({ 20: 300 });
                h.browser.moveTo(1500);
                await flushMicrotasks();
                expect(scroll.resolved).toBe(false);
                await runUntilResolved(h, scroll);
                expect(scroll.resolved).toBe(true);
                expect(scroll.value).toBeUndefined();
                expect(h.browser.offset).toBe(request === "index" ? h.targetOffsetForIndex(50) : 5000);
            });
        }

        it("recomputes the index target when instant retry layout moves it by 103px", async () => {
            const h = setupMode();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.browser.step(1000);
            h.measure({ 20: 130 });
            h.browser.settle();
            // ResizeObserver can deliver the new width after scrollTo returns, before the next frame.
            h.measure({ 20: 233 });
            await flushMicrotasks();
            expect(h.browser.offset).toBe(5030);
            expect(h.targetOffsetForIndex(50)).toBe(5133);
            expect(scroll.resolved).toBe(false);
            await runUntilResolved(h, scroll);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(h.targetOffsetForIndex(50));
        });

        it("keeps ownership when layout reverses a successful instant correction without moving its target", async () => {
            const h = setupMode();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.browser.step(1000);
            h.measure({ 20: 130 });
            h.browser.settle();
            expect(h.browser.offset).toBe(5030);
            // A content-width/MVCP adjustment can move the DOM back after the instant scroll succeeded.
            h.browser.moveTo(5000);
            h.clock.tick();
            await flushMicrotasks();
            expect(scroll.resolved).toBe(false);
            await runUntilResolved(h, scroll);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toBeUndefined();
            expect(h.browser.offset).toBe(5030);
        });

        it("cancels an unreachable snapped offset instead of retrying forever or reporting landed", async () => {
            const h = setupMode();
            const scroller = h.state.refScroller.current!;
            const originalScrollTo = scroller.scrollTo;
            scroller.scrollTo = (options) => {
                const requested = h.state.props.horizontal ? options.x! : options.y!;
                const logical =
                    mode === "negative RTL" ? -requested : mode === "inverted RTL" ? 9500 - requested : requested;
                const snapped = Math.round(logical / 1000) * 1000;
                originalScrollTo({
                    ...options,
                    ...(h.state.props.horizontal
                        ? { x: mode === "negative RTL" ? -snapped : mode === "inverted RTL" ? 9500 - snapped : snapped }
                        : { y: snapped }),
                });
            };
            const scroll = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 1250 }));
            await runUntilResolved(h, scroll);
            expect(scroll.resolved).toBe(true);
            expect(scroll.value).toEqual({ reason: "superseded" });
            expect(h.browser.offset).toBe(1000);
            expect(h.scrollToCalls).toHaveLength(3);
            h.clock.advance(5000);
            expect(h.scrollToCalls).toHaveLength(3);
            expect(h.state.scrollingTo).toBeUndefined();
        });

        for (const input of ["wheel", "touchstart", "keyboard"]) {
            it(`preserves ${input} interruption results`, async () => {
                const h = setupMode();
                const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
                h.browser.step(1000);
                h.browser.interruptByUser(input);
                await flushMicrotasks();
                expect(scroll.resolved).toBe(true);
                expect(scroll.value).toEqual({ reason: "interrupted" });
                expect(h.browser.offset).toBe(1000);
                expect(h.state.scrollingTo).toBeUndefined();
            });
        }
    });
}
