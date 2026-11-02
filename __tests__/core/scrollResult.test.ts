import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { calculateItemsInView } from "@/core/calculateItemsInView";
import { cancelImperativeScroll } from "@/core/cancelImperativeScroll";
import { interruptUserScroll } from "@/core/cancelScroll";
import { checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import { finishInitialScroll } from "@/core/finishInitialScroll";
import { interruptMaintainScrollAtEnd } from "@/core/finishMaintainScrollAtEnd";
import { handleLayout } from "@/core/handleLayout";
import { resetLayoutCachesForDataChange } from "@/core/resetLayoutCachesForDataChange";
import { updateItemPositions } from "@/core/updateItemPositions";
import * as platform from "@/platform/Platform";
import { Platform } from "@/platform/Platform";
import { createImperativeHandle } from "@/utils/createImperativeHandle";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import { requestAdjust } from "@/utils/requestAdjust";
import {
    createWebScrollHarness,
    flushMicrotasks,
    trackScroll,
    type WebScrollHarness,
} from "../helpers/webScrollHarness";

let harness: WebScrollHarness | undefined;

beforeEach(() => {
    Platform.OS = "web";
    harness = createWebScrollHarness();
});

afterEach(() => {
    harness?.restore();
    harness = undefined;
});

describe("imperative scroll results", () => {
    it("does not stop an animation that a dispatching animated request supersedes", async () => {
        const h = harness!;
        const old = trackScroll(h.ref.scrollToIndex({ animated: true, index: 40 }));
        h.browser.step(100);
        const next = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
        await flushMicrotasks();
        expect(old.resolved).toBe(true);
        expect(h.scrollToCalls.some((call) => !call.animated)).toBe(false);
        expect(h.scrollToCalls.at(-1)).toMatchObject({ animated: true, y: 5000 });
        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(next.resolved).toBe(true);
    });

    describe("with deferred adjustments", () => {
        beforeEach(async () => {
            mock.module("@/platform/Platform", () => ({ ...platform, PlatformAdjustBreaksScroll: true }));
            const { ScrollAdjustHandler } = await import("../../src/core/ScrollAdjustHandler?deferred");
            harness!.state.scrollAdjustHandler = new ScrollAdjustHandler(harness!.ctx);
            harness!.ctx.values.set("readyToRender", true);
        });

        afterEach(() => {
            mock.module("@/platform/Platform", () => platform);
        });

        for (const [first, replacement, landing] of [
            ["scrollToIndex", { animated: true, index: 50 }, 5000],
            ["scrollToEnd", { animated: true, index: 10 }, 1000],
            ["scrollToIndex", { animated: true, offset: 500 }, 500],
        ] as const) {
            it(`leaves a superseded ${first}'s deferred adjustment to a ${"index" in replacement ? "scrollToIndex" : "scrollToOffset"} replacement's own target`, async () => {
                const h = harness!;
                trackScroll(
                    first === "scrollToEnd"
                        ? h.ref.scrollToEnd({ animated: true })
                        : h.ref.scrollToIndex({ animated: true, index: 40 }),
                );
                h.browser.step(100);
                requestAdjust(h.ctx, 100, "item-size");
                const next = trackScroll(
                    "index" in replacement ? h.ref.scrollToIndex(replacement) : h.ref.scrollToOffset(replacement),
                );
                await flushMicrotasks();
                // Applying an adjust moves Android's ScrollAdjust anchor, which cancels the replacement's animation.
                expect(h.ctx.values.get("scrollAdjustPending")).toBe(100);
                expect(h.scrollToCalls.at(-1)).toMatchObject({ animated: true });
                const calls = h.scrollToCalls.length;
                h.browser.runToEnd();
                h.clock.advance(100);
                await flushMicrotasks();
                expect(next.resolved).toBe(true);
                // The replacement's destination already accounts for the superseded adjustment.
                expect(h.scrollToCalls.length).toBe(calls);
                expect(h.ctx.values.get("scrollAdjustPending")).toBe(0);
                expect(h.state.scroll).toBe(landing);
            });
        }

        it("lands an animated scrollToIndex without retrying when the deferred adjustment already holds its target", async () => {
            const h = harness!;
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.browser.step(1000);
            // Rows above the target measure 500 px taller mid-scroll. The deferred adjustment keeps them
            // rendered 500 px higher, so index 50 is already at the native offset the browser is heading to.
            h.measure({ 30: 300, 31: 300, 32: 200 });
            requestAdjust(h.ctx, 500, "item-size");
            expect(h.ctx.values.get("scrollAdjustPending")).toBe(500);

            for (let i = 0; i < 100 && !scroll.resolved; i++) {
                h.browser.step(400);
                h.clock.tick();
                await flushMicrotasks();
            }
            expect(scroll.resolved).toBe(true);
            expect(h.scrollToCalls).toEqual([{ animated: true, y: 5000 }]);
            expect(h.browser.offset).toBe(5000);
            expect(h.ctx.values.get("scrollAdjustPending")).toBe(0);
            expect(h.state.scroll).toBe(5500);
        });

        it("lands when the deferred adjustment exceeds the target's offset", async () => {
            const h = harness!;
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 5 }));
            h.browser.step(100);
            requestAdjust(h.ctx, 4000, "item-size");

            for (let i = 0; i < 100 && !scroll.resolved; i++) {
                h.browser.step(400);
                h.clock.tick();
                await flushMicrotasks();
            }
            expect(scroll.resolved).toBe(true);
            expect(h.scrollToCalls.length).toBeLessThanOrEqual(2);
            expect(h.ctx.values.get("scrollAdjustPending")).toBe(0);
        });

        it("retries a short landing toward the target's rendered offset while an adjustment is deferred", async () => {
            const h = harness!;
            const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
            h.browser.step(1000);
            // Rows above grow 500 px but only 300 px of it is deferred, so index 50 renders at 5200.
            h.measure({ 30: 300, 31: 300, 32: 200 });
            requestAdjust(h.ctx, 300, "item-size");

            for (let i = 0; i < 100 && !scroll.resolved; i++) {
                h.browser.step(400);
                h.clock.tick();
                await flushMicrotasks();
            }
            expect(scroll.resolved).toBe(true);
            expect(h.scrollToCalls).toEqual([
                { animated: true, y: 5000 },
                { animated: true, y: 5200 },
            ]);
            expect(h.state.scroll).toBe(5500);
        });

        it("commits a superseded animation's deferred adjustments when its replacement stops it", async () => {
            const h = harness!;
            trackScroll(h.ref.scrollToIndex({ animated: true, index: 40 }));
            h.browser.step(100);
            requestAdjust(h.ctx, 100, "item-size");
            trackScroll(createImperativeHandle(h.ctx).scrollIndexIntoView({ index: 2 }));
            await flushMicrotasks();
            expect(h.ctx.values.get("scrollAdjustPending")).toBe(0);
            expect(h.ctx.values.get("scrollAdjust")).toBe(100);
        });

        for (const [replacement, landing] of [
            [{ animated: true, index: 50 }, 5000],
            [{ animated: true, offset: 800 }, 800],
        ] as const) {
            it(`lands a twice-superseded animation's ${"index" in replacement ? "scrollToIndex" : "scrollToOffset"} replacement on its own target`, async () => {
                const h = harness!;
                trackScroll(h.ref.scrollToIndex({ animated: true, index: 40 }));
                h.browser.step(100);
                requestAdjust(h.ctx, 100, "item-size");
                trackScroll(h.ref.scrollToOffset({ animated: true, offset: 500 }));
                await flushMicrotasks();
                h.browser.step(100);
                requestAdjust(h.ctx, 50, "item-size");
                const next = trackScroll(
                    "index" in replacement ? h.ref.scrollToIndex(replacement) : h.ref.scrollToOffset(replacement),
                );
                await flushMicrotasks();
                h.browser.runToEnd();
                h.clock.advance(100);
                await flushMicrotasks();
                expect(next.resolved).toBe(true);
                expect(h.ctx.values.get("scrollAdjustPending")).toBe(0);
                expect(h.state.scroll).toBe(landing);
            });
        }

        for (const [dataLength, adjust] of [
            [100, 100],
            // Empty data clamps the adjusted target (100 + 100) to the max offset 0.
            [0, -100],
        ] as const) {
            it(`commits a superseded animation's deferred adjustment${dataLength ? "" : ", clamped to empty data,"} when its replacement is unreachable`, async () => {
                const h = harness!;
                trackScroll(h.ref.scrollToEnd({ animated: true }));
                h.browser.step(100);
                requestAdjust(h.ctx, 100, "item-size");
                if (!dataLength) h.setData(0);
                const next = trackScroll(h.ref.scrollToItem({ animated: true, item: "missing" as never }));
                await flushMicrotasks();
                expect(next.resolved).toBe(true);
                expect(h.ctx.values.get("scrollAdjustPending")).toBe(0);
                expect(h.ctx.values.get("scrollAdjust")).toBe(adjust);
            });
        }
    });

    it("stops a superseded animation when cancelled before its replacement runs", async () => {
        const h = harness!;
        const old = trackScroll(h.ref.scrollToIndex({ animated: true, index: 40 }));
        h.browser.step(100);
        h.state.didDataChange = true;
        const next = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
        const atCancel = h.browser.offset;
        h.ref.cancelScroll();
        await flushMicrotasks();
        expect(old.resolved).toBe(true);
        expect(next.resolved).toBe(true);
        expect(h.browser.destination).toBeUndefined();
        h.browser.runToEnd();
        expect(h.browser.offset).toBe(atCancel);
    });

    for (const following of [false, true]) {
        for (const method of ["scrollIndexIntoView", "scrollItemIntoView"] as const) {
            it(`stops superseded ${following ? "end-follow" : "explicit"} motion for an already-visible ${method} target`, async () => {
                const h = harness!;
                const old = trackScroll(
                    following
                        ? h.ref.scrollToEnd({ animated: true })
                        : h.ref.scrollToIndex({ animated: true, index: 50 }),
                );
                h.browser.step(100);
                if (following) h.state.maintainingScrollAtEnd = "animated";
                const ref = createImperativeHandle(h.ctx);
                const result = trackScroll(
                    method === "scrollIndexIntoView"
                        ? ref.scrollIndexIntoView({ index: 2 })
                        : ref.scrollItemIntoView({ item: h.state.props.data[2] }),
                );
                await flushMicrotasks();
                expect(old.value).toBeUndefined();
                expect(result.resolved).toBe(true);
                expect(result.value).toBeUndefined();
                h.browser.runToEnd();
                h.clock.advance(100);
                expect(h.browser.offset).toBeLessThanOrEqual(200);
                expect(h.browser.offset + h.state.scrollLength).toBeGreaterThanOrEqual(300);
                expect(h.state.scrollingTo).toBeUndefined();
            });
        }
    }

    it("dispatches a fresh web RTL request using negative browser offsets", async () => {
        harness!.restore();
        harness = createWebScrollHarness({
            horizontal: true,
            horizontalRTLScrollType: "negative",
            rtl: true,
        });
        const h = harness;
        h.state.horizontalRTLScrollType = undefined;
        const result = trackScroll(h.ref.scrollToIndex({ animated: false, index: 20 }));
        h.clock.advance(1000);
        await flushMicrotasks();
        expect(h.browser.offset).toBe(2000);
        expect(result.resolved).toBe(true);
        expect(result.value).toBeUndefined();
    });

    it("keeps offset initial-scroll completion in logical RTL coordinates", () => {
        harness!.restore();
        harness = createWebScrollHarness({
            horizontal: true,
            horizontalRTLScrollType: "negative",
            rtl: true,
        });
        const h = harness;
        h.browser.moveTo(500);
        h.state.initialScrollSession = { kind: "offset" } as any;
        finishInitialScroll(h.ctx, { syncObservedOffset: true });
        expect(h.state.scroll).toBe(500);
        expect(h.state.scrollPending).toBe(500);
        expect(h.state.scrollPrev).toBe(500);
    });

    it("settles a key still missing after the settle window without dispatch", async () => {
        const h = harness!;
        spyOn(Date, "now").mockImplementation(() => h.clock.now);
        const result = trackScroll(h.ref.scrollToKey({ animated: true, key: "absent" }));
        await flushMicrotasks();
        expect(result.resolved).toBe(false);
        h.clock.advance(1000);
        await flushMicrotasks();
        expect(result.resolved).toBe(true);
        expect(result.value).toBeUndefined();
        expect(h.scrollToCalls).toHaveLength(0);
    });

    it("retargets scrollToEnd when rows are appended during the animation", async () => {
        const h = harness!;
        const result = trackScroll(h.ref.scrollToEnd({ animated: true }));
        h.browser.step(400);
        h.setData(110);
        updateItemPositions(h.ctx, true);
        await flushMicrotasks();
        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(result.resolved).toBe(true);
        expect(result.value).toBeUndefined();
        expect(h.browser.offset).toBe(10500);
    });

    it("retries the new native end after rows are appended", async () => {
        const h = harness!;
        Platform.OS = "ios";
        h.state.didContainersLayout = h.state.didFinishInitialScroll = true;
        const result = trackScroll(h.ref.scrollToEnd({ animated: false }));
        h.state.scroll = h.state.scrollPending = 9500;
        h.setData(110);
        updateItemPositions(h.ctx, true);
        checkFinishedScrollFallback(h.ctx);
        await flushMicrotasks();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(h.scrollToCalls.at(-1)?.y).toBe(10500);
        h.state.scroll = h.state.scrollPending = 10500;
        h.clock.advance(100);
        await flushMicrotasks();
        expect(result.resolved).toBe(true);
        expect(result.value).toBeUndefined();
    });

    it("lands on a key that arrives in the render after the call", async () => {
        const h = harness!;
        const result = trackScroll(h.ref.scrollToKey({ animated: true, key: "item_100" }));
        h.setData(101);
        h.clock.advance(32);
        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(result.resolved).toBe(true);
        expect(result.value).toBeUndefined();
        expect(h.browser.offset).toBe(9600);
    });

    for (const queued of [true, false]) {
        it(`settles a deleted ${queued ? "queued" : "active"} keyed target`, async () => {
            const h = harness!;
            h.ctx.values.set("numContainers", 10);
            h.ctx.values.set("readyToRender", true);
            h.state.didContainersLayout = true;
            h.state.didFinishInitialScroll = true;
            h.state.props.keyExtractor = (item: { id: number }) => `item_${item.id}`;
            h.state.didDataChange = queued;
            spyOn(Date, "now").mockImplementation(() => h.clock.now);
            const result = trackScroll(h.ref.scrollToKey({ animated: true, key: "item_50" }));
            if (!queued) h.browser.step(400);
            const calls = h.scrollToCalls.length;
            h.setData(10);
            calculateItemsInView(h.ctx, { dataChanged: true, doMVCP: true });
            h.state.didDataChange = false;
            h.clock.advance(1000);
            await flushMicrotasks();
            expect(result.resolved).toBe(true);
            expect(result.value).toBeUndefined();
            expect(h.state.scrollingTo).toBeUndefined();
            expect(h.scrollToCalls.length).toBeLessThanOrEqual(calls + 1);
        });
    }

    for (const method of ["scrollToItem", "scrollItemIntoView"] as const) {
        it(`settles a missing ${method} item`, async () => {
            const h = harness!;
            const result = trackScroll(h.ref[method]({ animated: true, item: { id: -1 } }));
            await flushMicrotasks();
            expect(result.resolved).toBe(true);
            expect(result.value).toBeUndefined();
        });
        it(`settles a deleted active ${method} item`, async () => {
            const h = harness!;
            const result = trackScroll(h.ref[method]({ animated: true, item: h.state.props.data[50] }));
            h.browser.step(400);
            h.setData(10);
            updateItemPositions(h.ctx, true);
            await flushMicrotasks();
            expect(result.value).toBeUndefined();
            expect(h.state.scrollingTo).toBeUndefined();
        });
        it(`retains ${method} through an immutable same-key update and prepend`, async () => {
            const h = harness!;
            h.state.props.keyExtractor = (item: { id: number }) => `item_${item.id}`;
            const result = trackScroll(h.ref[method]({ animated: true, item: h.state.props.data[50] }));
            h.browser.step(400);
            h.state.props.data = [{ id: -1 }, ...h.state.props.data.map((item: { id: number }) => ({ ...item }))];
            resetLayoutCachesForDataChange(h.state);
            updateItemPositions(h.ctx, true);
            expect(h.state.scrollingTo?.index).toBe(51);
            expect(result.resolved).toBe(false);
            h.browser.runToEnd();
            h.clock.advance(100);
            await flushMicrotasks();
            expect(result.resolved).toBe(true);
            expect(result.value).toBeUndefined();
            expect(h.browser.offset).toBe(method === "scrollToItem" ? 5100 : 4700);
        });
    }

    it("retains an item key when viewport resize retargets navigation", async () => {
        const h = harness!;
        h.state.props.keyExtractor = (entry: { id: number }) => `item_${entry.id}`;
        h.state.lastLayout = { height: 500, width: 400, x: 0, y: 0 };
        h.state.otherAxisSize = 400;
        const item = h.state.props.data[50];
        const result = trackScroll(h.ref.scrollItemIntoView({ animated: true, item }));
        await flushMicrotasks();
        h.browser.step(400);
        const key = h.state.scrollingTo?.key;
        expect(key).toBe("item_50");
        handleLayout(h.ctx, { height: 450, width: 400, x: 0, y: 0 }, () => {});
        const resizedKey = h.state.scrollingTo?.key;
        h.state.props.data = h.state.props.data.filter((entry: { id: number }) => entry !== item);
        resetLayoutCachesForDataChange(h.state);
        updateItemPositions(h.ctx, true);
        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(resizedKey).toBe(key);
        expect(result.resolved).toBe(true);
        expect(result.value).toBeUndefined();
        expect(h.state.scrollingTo).toBeUndefined();
    });

    it("keeps index ownership for item navigation without a key extractor", async () => {
        const h = harness!;
        const result = trackScroll(h.ref.scrollToItem({ animated: true, item: h.state.props.data[50] }));
        h.browser.step(400);
        h.state.props.data = h.state.props.data.map((item: { id: number }) => ({ ...item }));
        updateItemPositions(h.ctx, true);
        expect(h.state.scrollingTo?.index).toBe(50);
        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(result.value).toBeUndefined();
        expect(h.browser.offset).toBe(5000);
    });

    it("stops once without duplicate MVCP writes when the active target and an earlier row are deleted", async () => {
        const h = harness!;
        h.ctx.values.set("numContainers", 10);
        h.ctx.values.set("readyToRender", true);
        h.state.didContainersLayout = h.state.didFinishInitialScroll = true;
        h.state.props.keyExtractor = (item: { id: number }) => `item_${item.id}`;
        h.state.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
        const result = trackScroll(h.ref.scrollToKey({ animated: true, key: "item_50" }));
        h.browser.step(400);
        h.state.props.data = h.state.props.data.filter((item: { id: number }) => item.id !== 0 && item.id !== 50);
        const calls = h.scrollToCalls.length;
        calculateItemsInView(h.ctx, { dataChanged: true, doMVCP: true });
        h.clock.advance(100);
        await flushMicrotasks();
        expect(result.value).toBeUndefined();
        // The removed scroll target owned MVCP; its obsolete correction must be abandoned.
        expect(h.state.scroll).toBe(400);
        expect(h.browser.offset).toBe(400);
        expect(h.scrollToCalls.slice(calls).map(({ y }) => y)).toEqual([400]);
    });

    it("keeps an already visible row successful", async () => {
        const result = trackScroll(harness!.ref.scrollIndexIntoView({ index: 0 }));
        await flushMicrotasks();
        expect(result.resolved).toBe(true);
        expect(result.value).toBeUndefined();
    });

    for (const method of ["scrollIndexIntoView", "scrollItemIntoView"] as const) {
        it(`aligns the start of an oversized row entering the viewport with ${method}`, async () => {
            const h = harness!;
            h.measure({ 2: 800 });
            const result = trackScroll(
                method === "scrollIndexIntoView"
                    ? h.ref.scrollIndexIntoView({ index: 2 })
                    : h.ref.scrollItemIntoView({ item: h.state.props.data[2] }),
            );
            h.browser.runToEnd();
            h.clock.advance(100);
            await flushMicrotasks();

            expect(result.resolved).toBe(true);
            expect(result.value).toBeUndefined();
            expect(h.browser.offset).toBe(200);
        });
    }

    for (const method of ["scrollIndexIntoView", "scrollItemIntoView"] as const) {
        for (const animated of [false, true]) {
            it(`resolves ${method} at the content end when its region margin exceeds the max offset (animated: ${animated})`, async () => {
                const h = harness!;
                const index = h.state.props.data.length - 1;
                const options = { animated, itemLength: 20, itemOffset: 80, viewportMargin: { end: 20 } };
                const result = trackScroll(
                    method === "scrollIndexIntoView"
                        ? h.ref.scrollIndexIntoView({ ...options, index })
                        : h.ref.scrollItemIntoView({ ...options, item: h.state.props.data[index] }),
                );
                await flushMicrotasks();
                expect(result.resolved).toBe(false);
                h.browser.runToEnd();
                h.clock.advance(100);
                await flushMicrotasks();
                expect(h.browser.offset).toBe(9500);
                expect(h.state.scroll).toBe(9500);
                expect(result.resolved).toBe(true);
                expect(result.value).toBeUndefined();
            });

            it(`resolves ${method} for an inner region after landing (animated: ${animated})`, async () => {
                const h = harness!;
                h.measure({ 2: 1000 });
                const options = { animated, itemLength: 50, itemOffset: 700, viewportMargin: { end: 20, start: 10 } };
                const result = trackScroll(
                    method === "scrollIndexIntoView"
                        ? h.ref.scrollIndexIntoView({ ...options, index: 2 })
                        : h.ref.scrollItemIntoView({ ...options, item: h.state.props.data[2] }),
                );
                await flushMicrotasks();
                expect(result.resolved).toBe(false);
                h.browser.runToEnd();
                h.clock.advance(100);
                await flushMicrotasks();
                expect(h.browser.offset).toBe(470);
                expect(result.resolved).toBe(true);
                expect(result.value).toBeUndefined();

                const calls = h.scrollToCalls.length;
                const visible = trackScroll(h.ref.scrollIndexIntoView({ ...options, index: 2 }));
                await flushMicrotasks();
                expect(visible.resolved).toBe(true);
                expect(h.scrollToCalls).toHaveLength(calls);
            });
        }
    }

    for (const offset of [0, 250, 500]) {
        it(`leaves an oversized row covering the viewport in place (offset: ${offset})`, async () => {
            const h = harness!;
            h.measure({ 0: 1000 });
            h.browser.moveTo(offset);
            for (let i = 0; i < 2; i++) {
                const result = trackScroll(h.ref.scrollIndexIntoView({ index: 0 }));
                h.browser.runToEnd();
                h.clock.advance(100);
                await flushMicrotasks();
                expect(result.resolved).toBe(true);
                expect(result.value).toBeUndefined();
                expect(h.browser.offset).toBe(offset);
            }
            expect(h.scrollToCalls).toHaveLength(0);
        });
    }

    it("settles a missing reveal index", async () => {
        const result = trackScroll(harness!.ref.scrollIndexIntoView({ index: 100 }));
        await flushMicrotasks();
        expect(result.value).toBeUndefined();
    });

    for (const index of [-1, 200]) {
        it(`clamps scrollToIndex to existing data after settling (index: ${index})`, async () => {
            const h = harness!;
            spyOn(Date, "now").mockImplementation(() => h.clock.now);
            h.browser.moveTo(500);
            const result = trackScroll(h.ref.scrollToIndex({ animated: true, index }));
            h.clock.advance(1000);
            h.browser.runToEnd();
            h.clock.advance(100);
            await flushMicrotasks();
            expect(result.resolved).toBe(true);
            expect(result.value).toBeUndefined();
            expect(h.browser.offset).toBe(index < 0 ? 0 : 9500);
        });
    }

    for (const headerSize of [0, 1200]) {
        it(`settles scrollToEnd on empty data (header: ${headerSize})`, async () => {
            const h = harness!;
            h.setData(0);
            h.ctx.values.set("headerSize", headerSize);
            const result = trackScroll(h.ref.scrollToEnd({ animated: true }));
            await flushMicrotasks();
            expect(result.resolved).toBe(true);
            expect(result.value).toBeUndefined();
            expect(h.scrollToCalls).toHaveLength(0);
            expect(h.browser.offset).toBe(0);
        });
    }

    it("settles scrollToIndex on empty data", async () => {
        const h = harness!;
        h.setData(0);
        spyOn(Date, "now").mockImplementation(() => h.clock.now);
        const result = trackScroll(h.ref.scrollToIndex({ index: 0 }));
        h.clock.advance(1000);
        await flushMicrotasks();
        expect(result.value).toBeUndefined();
        expect(h.scrollToCalls).toHaveLength(0);
    });

    it("settles an active index removed by truncation", async () => {
        const h = harness!;
        const result = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
        h.browser.step(400);
        h.setData(10);
        updateItemPositions(h.ctx, true);
        await flushMicrotasks();
        expect(result.value).toBeUndefined();
        expect(h.state.scrollingTo).toBeUndefined();
    });

    it("waits for observed landing with scrollToKey", async () => {
        const h = harness!;
        const result = trackScroll(h.ref.scrollToKey({ animated: true, key: "item_50" }));
        await flushMicrotasks();
        expect(result.resolved).toBe(false);
        h.browser.step(100);
        await flushMicrotasks();
        expect(result.resolved).toBe(false);
        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(h.browser.offset).toBe(5000);
        expect(result.resolved).toBe(true);
        expect(result.value).toBeUndefined();
    });

    it("waits for clamped landing with scrollToOffset", async () => {
        const h = harness!;
        h.browser.moveTo(500);
        spyOn(Date, "now").mockImplementation(() => h.clock.now);
        const result = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 20000 }));
        await flushMicrotasks();
        expect(result.resolved).toBe(false);
        h.clock.advance(1000);
        await flushMicrotasks();
        expect(result.resolved).toBe(false);
        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(h.browser.offset).toBe(9500);
        expect(result.resolved).toBe(true);
    });

    for (const edge of ["start", "end", "inset"] as const) {
        it(`reveals a normal row clipped at the ${edge} boundary despite an inclusive render range`, async () => {
            const h = harness!;
            const offset = edge === "start" ? 210 : edge === "inset" ? 100 : 90;
            const index = edge === "start" ? 2 : 5;
            h.browser.moveTo(offset);
            h.state.startNoBuffer = 0;
            h.state.endNoBuffer = 10;
            if (edge === "inset") h.state.contentInsetOverride = { bottom: 10 };
            const result = trackScroll(h.ref.scrollIndexIntoView({ index }));
            h.browser.runToEnd();
            h.clock.advance(100);
            await flushMicrotasks();
            expect(h.browser.offset).toBe(edge === "start" ? 200 : edge === "inset" ? 110 : 100);
            expect(result.resolved).toBe(true);
            const calls = h.scrollToCalls.length;
            await h.ref.scrollIndexIntoView({ index });
            expect(h.scrollToCalls).toHaveLength(calls);
        });
    }

    for (const extent of ["headerSize", "footerSize"] as const) {
        for (const method of [
            "scrollToIndex",
            "scrollToItem",
            "scrollToKey",
            "scrollToEnd",
            "scrollIndexIntoView",
            "scrollItemIntoView",
        ] as const) {
            it(`settles empty ${method} without transport with ${extent}`, async () => {
                const h = harness!;
                h.setData(0);
                h.ctx.values.set(extent, 1200);
                spyOn(Date, "now").mockImplementation(() => h.clock.now);
                const result = trackScroll(h.ref[method]({ index: 0, item: { id: 0 }, key: "item_0" }));
                h.clock.advance(1000);
                await flushMicrotasks();
                expect(result.resolved).toBe(true);
                expect(result.value).toBeUndefined();
                expect(h.scrollToCalls).toHaveLength(0);
            });
        }
    }

    it("emits public following transitions until unsubscribe", async () => {
        const h = harness!;
        h.state.props.maintainScrollAtEnd = { animated: false };
        const values: boolean[] = [];
        const unsubscribe = h.ref.getState().listen("isFollowingEnd", (value) => values.push(value));
        const end = h.ref.scrollToEnd({ animated: false });
        h.clock.advance(100);
        await end;
        interruptMaintainScrollAtEnd(h.ctx);
        const next = h.ref.scrollToEnd({ animated: false });
        h.clock.advance(100);
        await next;
        expect(values).toEqual([false, true, false, true]);
        unsubscribe();
        interruptMaintainScrollAtEnd(h.ctx);
        expect(values).toEqual([false, true, false, true]);
    });

    it("resolves a landed scroll", async () => {
        const h = harness!;
        const scroll = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 1200 }));

        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();

        expect(scroll.resolved).toBe(true);
        expect(scroll.value).toBeUndefined();
        expect(h.browser.offset).toBe(1200);
    });

    it("settles a superseded scrollToIndex and lands the newer one", async () => {
        const h = harness!;
        const first = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
        h.browser.step(400);

        const second = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 300 }));
        await flushMicrotasks();
        expect(first.resolved).toBe(true);
        expect(first.value).toBeUndefined();
        expect(second.resolved).toBe(false);

        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(second.resolved).toBe(true);
        expect(second.value).toBeUndefined();
        expect(h.browser.offset).toBe(300);
    });

    it("settles a scroll waiting for data to settle when replaced", async () => {
        const h = harness!;
        h.state.didDataChange = true;
        const first = trackScroll(h.ref.scrollToIndex({ animated: true, index: 20 }));
        const second = trackScroll(h.ref.scrollToIndex({ animated: true, index: 30 }));
        await flushMicrotasks();

        expect(first.value).toBeUndefined();
        expect(second.resolved).toBe(false);
    });

    it("settles when user input stops an end-follow scroll", async () => {
        const h = harness!;
        const scroll = trackScroll(h.ref.scrollToEnd({ animated: true }));
        h.clock.tick();
        h.state.maintainingScrollAtEnd = "animated";
        h.browser.step(400);

        interruptMaintainScrollAtEnd(h.ctx);
        expect(h.state.scrollingTo).toBeUndefined();
        await flushMicrotasks();
        expect(scroll.value).toBeUndefined();
    });

    it("supersedes active end following when a newer explicit request takes ownership", async () => {
        const h = harness!;
        const first = trackScroll(h.ref.scrollToEnd({ animated: true }));
        h.clock.tick();
        h.state.maintainingScrollAtEnd = "animated";
        h.browser.step(400);

        const second = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 300 }));
        await flushMicrotasks();
        expect(first.value).toBeUndefined();
        expect(second.resolved).toBe(false);

        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(second.resolved).toBe(true);
        expect(second.value).toBeUndefined();
        expect(h.browser.offset).toBe(300);
    });

    for (const maintaining of [false, true]) {
        it(`settles user cancellation (end following: ${maintaining})`, async () => {
            const h = harness!;
            const scroll = trackScroll(h.ref.scrollToEnd({ animated: true }));
            h.clock.tick();
            if (maintaining) h.state.maintainingScrollAtEnd = "animated";
            h.browser.step(400);

            interruptUserScroll(h.ctx);
            await flushMicrotasks();
            expect(scroll.value).toBeUndefined();
            expect(h.browser.destination).toBeUndefined();
            expect(h.state.scrollingTo).toBeUndefined();
        });

        it(`settles programmatic cancellation (end following: ${maintaining})`, async () => {
            const h = harness!;
            const scroll = trackScroll(h.ref.scrollToEnd({ animated: true }));
            h.clock.tick();
            if (maintaining) h.state.maintainingScrollAtEnd = "animated";
            h.browser.step(400);

            h.ref.cancelScroll();
            await flushMicrotasks();
            expect(scroll.value).toBeUndefined();
            expect(h.browser.destination).toBeUndefined();
            expect(h.state.scrollingTo).toBeUndefined();
        });
    }

    it("settles a queued request when user input cancels it", async () => {
        const h = harness!;
        h.state.didDataChange = true;
        const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 20 }));
        expect(h.state.scrollingTo).toBeUndefined();

        interruptUserScroll(h.ctx);
        h.state.didDataChange = false;
        h.clock.advance(2000);
        await flushMicrotasks();
        expect(scroll.value).toBeUndefined();
        expect(h.scrollToCalls).toHaveLength(0);
    });

    it("settles on programmatic teardown", async () => {
        const h = harness!;
        const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
        h.browser.step(400);

        cancelImperativeScroll(h.state);
        await flushMicrotasks();
        expect(scroll.value).toBeUndefined();
        expect(scroll.rejected).toBe(false);
    });
});

// Apps place a DOM range by scrolling to its key, measuring, then scrolling to a precise offset.
describe("scrollToOffset as a list-owned scroll", () => {
    it("replaces an in-flight keyed scroll and settles when the offset lands", async () => {
        const h = harness!;
        h.state.props.keyExtractor = (item: { id: number }) => `item_${item.id}`;
        const keyed = trackScroll(h.ref.scrollToKey({ animated: true, key: "item_50" }));
        h.clock.tick();
        h.browser.step(400);
        expect(h.browser.destination).toBe(h.targetOffsetForIndex(50));

        const placed = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 1234 }));
        await flushMicrotasks();
        expect(keyed.resolved).toBe(true);
        expect(placed.resolved).toBe(false);
        expect(h.state.scrollingTo?.index).toBeUndefined();
        expect(h.browser.destination).toBe(1234);

        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(placed.resolved).toBe(true);
        expect(h.browser.offset).toBe(1234);
        expect(h.scrollToCalls.at(-1)?.y).toBe(1234);
    });
});
