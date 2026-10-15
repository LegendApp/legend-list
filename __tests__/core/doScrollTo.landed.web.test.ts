import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

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

describe("animated web scrolls resolve only once landed", () => {
    describe("late measurement", () => {
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
                expect(h.scrollToCalls).toHaveLength(1);
                expect(h.browser.offset).toBe(1000);
            });
        }

        it("treats scrolling away from the destination as user input", async () => {
            const h = setup();
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            h.browser.step(1000);
            h.browser.step(1000);
            // Scrollbar drag or keyboard scrolling moves back toward the start.
            h.browser.interruptByUser("none");
            h.browser.moveTo(1500);
            await flushMicrotasks();
            expect(scroll.value).toEqual({ reason: "interrupted" });

            h.clock.advance(3000);
            expect(h.scrollToCalls).toHaveLength(1);
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
            expect(h.scrollToCalls).toHaveLength(2);
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
                // Every frame mounts another row above the target that measures taller.
                growth += 50;
                h.measure({ 10: growth });
            };
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));

            await runUntilResolved(h, scroll, 20000, 300);
            expect(scroll.resolved).toBe(true);
            expect(scroll.rejected).toBe(false);
            expect(h.scrollToCalls.length).toBeLessThanOrEqual(4);
            expect(h.scrollToCalls.at(-1)?.animated).toBe(false);

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
