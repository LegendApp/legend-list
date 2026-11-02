import { afterEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import { ScrollAdjust } from "../../src/components/ScrollAdjust?wheel-pending";
import { interruptUserScroll } from "../../src/core/cancelScroll";
import { doMaintainScrollAtEnd } from "../../src/core/doMaintainScrollAtEnd";
import { scrollToEnd } from "../../src/core/scrollToEnd";
import { Platform } from "../../src/platform/Platform";
import { StateProvider, useStateContext } from "../../src/state/state";
import { normalizeMaintainScrollAtEnd } from "../../src/utils/normalizeMaintainScrollAtEnd";
import { requestAdjust } from "../../src/utils/requestAdjust";
import TestRenderer, { act } from "../helpers/testRenderer";
import { createWebScrollHarness, type WebScrollHarness } from "../helpers/webScrollHarness";

// Repro: a web wheel toward the start during an animated maintainScrollAtEnd follow. Chromium lets the
// smooth scroll override the wheel, so the listener's instant stop write must include the wheel delta;
// stopping at the pre-wheel offset discarded the wheel and, near the end, let following re-arm. WebKit and
// Firefox still apply the wheel natively, which doubled it unless the listener cancels the native scroll.
// A touch drag keeps scrolling natively after the stop.

const originalPlatform = Platform.OS;
let harness: WebScrollHarness | undefined;

afterEach(() => {
    harness?.restore();
    harness = undefined;
    Platform.OS = originalPlatform;
});

function startAnimatedEndFollow(os: typeof Platform.OS = "web") {
    Platform.OS = os;
    const h = createWebScrollHarness();
    harness = h;
    h.ctx.scrollToEnd = (options) => scrollToEnd(h.ctx, options);
    h.state.props.maintainScrollAtEnd = normalizeMaintainScrollAtEnd({ animated: true });
    h.state.props.maintainScrollAtEndThreshold = 0.1;
    h.state.didFinishInitialScroll = true;
    h.state.didContainersLayout = true;
    h.browser.moveTo(9500);
    h.clock.advance(100);
    expect(h.ctx.values.get("isFollowingEnd")).toBe(true);
    // The scroll view keeps its wheel listener passive unless a scroll is active.
    expect(h.ctx.values.get("isScrollActive")).toBeFalsy();

    h.setData(110);
    doMaintainScrollAtEnd(h.ctx);
    h.clock.tick();
    expect(h.scrollToCalls).toEqual([{ animated: true, y: 10500 }]);
    expect(h.ctx.values.get("isScrollActive")).toBe(true);
    h.browser.step(300);
    h.clock.tick();
    expect(h.browser.offset).toBe(9800);
    return h;
}

/**
 * Calls the scroll view's listener interrupt the way each input does. A "wheel" is lost to the smooth
 * scroll (Chromium); a "native wheel" still scrolls unless the listener cancels it (WebKit, Firefox).
 */
function userScrollTo(h: WebScrollHarness, input: "wheel" | "native wheel" | "touch", offset: number) {
    const from = h.browser.offset;
    const cancelsNative = interruptUserScroll(h.ctx, input === "touch" ? 0 : offset - from);
    if (input === "native wheel" && !cancelsNative) h.browser.moveTo(h.browser.offset + offset - from);
    if (input === "touch") {
        for (let i = 1; i <= 4; i++) h.browser.moveTo(from + ((offset - from) * i) / 4);
    }
    h.clock.tick();
}

describe("web user scroll during an animated end follow", () => {
    for (const input of ["wheel", "native wheel", "touch"] as const) {
        it(`keeps the ${input} offset and stops following`, () => {
            const h = startAnimatedEndFollow();
            userScrollTo(h, input, 9000);
            h.clock.advance(3000);

            expect(h.browser.offset).toBe(9000);
            expect(h.scrollToCalls).toEqual([
                { animated: true, y: 10500 },
                { animated: false, y: input === "touch" ? 9800 : 9000 },
            ]);
            expect(h.state.scrollingTo).toBeUndefined();
            expect(h.ctx.values.get("isScrollActive")).toBe(false);
            expect(h.ctx.values.get("isFollowingEnd")).toBe(false);

            h.setData(120);
            doMaintainScrollAtEnd(h.ctx);
            h.clock.advance(3000);
            expect(h.browser.offset).toBe(9000);
            expect(h.scrollToCalls).toHaveLength(2);
        });
    }

    it("re-arms following once the user scrolls back to the end", () => {
        const h = startAnimatedEndFollow();
        userScrollTo(h, "wheel", 9000);
        h.clock.advance(3000);
        expect(h.ctx.values.get("isFollowingEnd")).toBe(false);

        h.browser.moveTo(10500);
        h.clock.advance(3000);
        expect(h.ctx.values.get("isFollowingEnd")).toBe(true);

        h.setData(120);
        doMaintainScrollAtEnd(h.ctx);
        h.clock.tick();
        expect(h.scrollToCalls.at(-1)).toEqual({ animated: true, y: 11500 });
    });

    for (const input of ["wheel", "native wheel"] as const)
        it(`does not re-arm following after a small ${input} near the end`, () => {
            const h = startAnimatedEndFollow();
            h.browser.step(650);
            h.clock.tick();
            expect(h.browser.offset).toBe(10450);
            userScrollTo(h, input, 10350);
            h.clock.advance(3000);
            expect(h.browser.offset).toBe(10350);
            expect(h.ctx.values.get("isFollowingEnd")).toBe(false);

            h.setData(120);
            doMaintainScrollAtEnd(h.ctx);
            h.clock.advance(3000);
            expect(h.browser.offset).toBe(10350);
        });

    it("still stops at the observed offset for other interrupts", () => {
        const h = startAnimatedEndFollow();
        interruptUserScroll(h.ctx);
        expect(h.scrollToCalls.at(-1)).toEqual({ animated: false, y: 9800 });
        expect(h.ctx.values.get("isFollowingEnd")).toBe(false);
    });

    it("does not write an offset on native", () => {
        const h = startAnimatedEndFollow("ios");
        interruptUserScroll(h.ctx, -800);
        expect(h.scrollToCalls).toHaveLength(1);
        expect(h.state.scrollingTo).toBeUndefined();
        expect(h.ctx.values.get("isFollowingEnd")).toBe(false);
    });
    it.each([
        { delta: -40, expected: 9860, pending: 100 },
        { delta: -40, expected: 9660, pending: -100 },
        { delta: -10000, expected: 100, pending: 100 },
    ])("keeps a wheel delta across a deferred adjustment %j", async ({ delta, expected, pending }) => {
        mock.module("@/platform/Platform", () => ({ Platform, PlatformAdjustBreaksScroll: true }));
        const { ScrollAdjustHandler } = await import("../../src/core/ScrollAdjustHandler?wheel-pending");
        const h = startAnimatedEndFollow();
        h.ctx.values.set("readyToRender", true);
        h.state.scrollAdjustHandler = new ScrollAdjustHandler(h.ctx);
        const scroller = h.state.refScroller.current!;
        const content = {
            isConnected: true,
            parentElement: null as unknown,
            scrollHeight: 20000,
            style: { paddingBottom: "0px" },
        };
        const element = {
            clientHeight: 500,
            querySelector: () => content,
            scrollBy: ({ top }: { top: number }) => {
                // The browser transport queues the native scroll event for the next frame.
                scroller.scrollTo({ animated: false, x: 0, y: h.browser.offset + top });
            },
            get scrollTop() {
                return h.browser.offset;
            },
        };
        content.parentElement = element;
        scroller.getScrollableNode = () => element as unknown as HTMLElement;
        function Setup() {
            Object.assign(useStateContext(), h.ctx, { state: h.state });
            return React.createElement(ScrollAdjust);
        }
        let rendered: ReturnType<typeof TestRenderer.create> | undefined;
        act(() => {
            rendered = TestRenderer.create(React.createElement(StateProvider, null, React.createElement(Setup)));
        });
        try {
            h.measure({ 0: 100 + pending });
            requestAdjust(h.ctx, pending, "item-size");
            expect(h.ctx.values.get("scrollAdjustPending")).toBe(pending);
            act(() => {
                expect(interruptUserScroll(h.ctx, delta)).toBe(true);
            });
            expect(h.browser.offset).toBe(expected);
            h.clock.advance(3000);
            expect(h.browser.offset).toBe(expected);
            expect(h.state.scroll).toBe(expected);
            expect(h.state.scrollPending).toBe(expected);
            expect(h.ctx.values.get("scrollAdjustPending")).toBe(0);
        } finally {
            act(() => rendered?.unmount());
        }
    });
});
