import { afterEach, expect, it } from "bun:test";
import "../setup";

import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { dispatchInitialScroll } from "@/core/initialScroll";
import { prepareMVCP } from "@/core/mvcp";
import { scrollToEnd } from "@/core/scrollToEnd";
import { updateItemPositions } from "@/core/updateItemPositions";
import { updateItemSizes } from "@/core/updateItemSizes";
import { Platform } from "@/platform/Platform";
import { normalizeMaintainScrollAtEnd } from "@/utils/normalizeMaintainScrollAtEnd";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import { createWebScrollHarness, type WebScrollHarness } from "../helpers/webScrollHarness";

const originalPlatform = Platform.OS;
let harness: WebScrollHarness | undefined;

afterEach(() => {
    harness?.ctx.state.scheduledWork.dispose();
    harness?.restore();
    harness = undefined;
    Platform.OS = originalPlatform;
});

function setup() {
    Platform.OS = "web";
    const h = createWebScrollHarness();
    harness = h;
    h.state.props.maintainScrollAtEnd = normalizeMaintainScrollAtEnd(true);
    h.state.didContainersLayout = true;
    h.state.queuedInitialLayout = true;
    h.state.initialScroll = { index: 99, viewPosition: 1 };
    h.state.didFinishInitialScroll = false;
    dispatchInitialScroll(h.ctx, { forceScroll: true, resolvedOffset: 9500, target: h.state.initialScroll });
    // Observe the end, but jump before the initial completion frame and late measurements.
    h.browser.moveTo(9500);
    h.ctx.values.set("isFollowingEnd", true);
    return h;
}

it.each([
    "initial request",
    "between initial requests",
    "pending follow",
    "animated follow",
    "measurement adjust",
] as const)("keeps an external jump to the top during %s after late measurements", (phase) => {
    const h = setup();
    if (phase !== "initial request") h.state.scrollingTo = undefined;
    if (phase === "pending follow") h.state.pendingMaintainScrollAtEnd = true;
    if (phase === "animated follow") {
        h.state.scrollingTo = { animated: true, isScrollToEnd: true, offset: 9700, targetOffset: 9700 };
    }
    if (phase === "measurement adjust") h.state.lastScrollAdjustForHistory = -100;
    h.browser.moveTo(0);
    expect(h.ctx.values.get("isFollowingEnd")).toBe(false);
    expect(h.state.endFollowInterrupted).toBe(true);
    expect(h.state.initialScroll).toBeUndefined();
    expect(h.state.scrollingTo).toBeUndefined();
    h.measure({ 98: 200, 99: 300 });
    expect(doMaintainScrollAtEnd(h.ctx)).toBe(false);
    h.clock.advance(1000);
    expect(h.browser.offset).toBe(0);
    expect(h.ctx.values.get("isFollowingEnd")).toBe(false);
});

it("preserves initial end alignment while the list corrects its measured target", () => {
    const h = setup();
    h.measure({ 99: 300 });
    dispatchInitialScroll(h.ctx, { forceScroll: true, resolvedOffset: 9700, target: h.state.initialScroll! });
    h.clock.advance(100);
    expect(h.browser.offset).toBe(9700);
    expect(h.ctx.values.get("isFollowingEnd")).toBe(true);
    expect(h.state.endFollowInterrupted).not.toBe(true);
});

it("preserves following when shrinking content clamps the browser during initial settling", () => {
    const h = setup();
    h.measure({ 98: 50, 99: 50 });
    h.browser.moveTo(9400);
    expect(h.ctx.values.get("isFollowingEnd")).toBe(true);
    expect(h.state.endFollowInterrupted).not.toBe(true);
});

it("preserves an owned backward animation toward a shrinking end", () => {
    const h = setup();
    h.state.scrollingTo = { animated: true, isScrollToEnd: true, offset: 9000, targetOffset: 9000 };
    h.browser.moveTo(9200);
    expect(h.ctx.values.get("isFollowingEnd")).toBe(true);
    expect(h.state.endFollowInterrupted).not.toBe(true);
});

it("cancels a measurement follow before the browser delivers the external jump event", () => {
    const h = setup();
    // The DOM moved, but onScroll has not run and still reports the previous end.
    h.state.refScroller.current!.getCurrentScrollOffset = () => 0;
    const calls = h.scrollToCalls.length;
    h.measure({ 99: 300 });
    expect(doMaintainScrollAtEnd(h.ctx, { immediate: true })).toBe(false);
    h.clock.advance(1000);
    expect(h.ctx.values.get("isFollowingEnd")).toBe(false);
    expect(h.state.initialScroll).toBeUndefined();
    expect(h.state.scrollingTo).toBeUndefined();
    expect(h.scrollToCalls).toHaveLength(calls);
});

it("cancels an end landing retry before the browser delivers the external jump event", async () => {
    const { doScrollTo } = await import("../../src/core/doScrollTo?web-external-settle");
    const h = setup();
    h.state.didFinishInitialScroll = true;
    h.state.scrollingTo = { animated: false, isScrollToEnd: true, offset: 9500, targetOffset: 9500 };
    doScrollTo(h.ctx, { animated: false, offset: 9500 });
    h.state.refScroller.current!.getCurrentScrollOffset = () => 0;
    const calls = h.scrollToCalls.length;
    h.clock.tick();
    expect(h.ctx.values.get("isFollowingEnd")).toBe(false);
    expect(h.state.scrollingTo).toBeUndefined();
    expect(h.scrollToCalls).toHaveLength(calls);
});

it("keeps measured streaming growth with animated following between requests", async () => {
    Platform.OS = "web";
    const h = createWebScrollHarness();
    harness = h;
    h.state.props.maintainScrollAtEnd = normalizeMaintainScrollAtEnd({ animated: true });
    h.state.didContainersLayout = true;
    h.state.didFinishInitialScroll = true;
    h.state.queuedInitialLayout = true;
    h.ctx.values.set("numContainers", 10);
    h.ctx.values.set("readyToRender", true);
    h.state.startBuffered = 0;
    h.state.endBuffered = 99;
    h.state.idsInView = ["item_95", "item_96", "item_97", "item_98", "item_99"];
    h.ctx.scrollToEnd = (options) => scrollToEnd(h.ctx, options);
    h.browser.moveTo(9500);
    h.ctx.values.set("isFollowingEnd", true);
    h.state.userScrollAnchorReset = undefined;
    expect(h.state.maintainingScrollAtEnd).toBeUndefined();

    updateItemSizes(h.ctx, { itemKey: "item_0", size: { height: 400, width: 400 } });
    // Measurements publish positions before React commits and before follow's microtask.
    // An instant MVCP here would change the scroll owner and create temporary scroll range.
    expect(h.state.scroll).toBe(9500);
    expect(h.state.positions[99]).toBe(10200);
    await Promise.resolve();
    h.clock.tick();
    h.browser.runToEnd();
    h.clock.advance(100);
    expect(h.browser.offset).toBe(9800);
    expect(h.ctx.values.get("isFollowingEnd")).toBe(true);
});

for (const [active, commitOnPublish] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
]) {
    it(`retains a browser end clamp before committing a growing tail measurement (active: ${active}, synchronous commit: ${commitOnPublish})`, async () => {
        Platform.OS = "web";
        const h = createWebScrollHarness();
        harness = h;
        h.state.props.maintainScrollAtEnd = normalizeMaintainScrollAtEnd({ animated: true });
        h.state.didContainersLayout = true;
        h.state.didFinishInitialScroll = true;
        h.state.queuedInitialLayout = true;
        h.state.startBuffered = 0;
        h.state.endBuffered = 99;
        h.ctx.values.set("numContainers", 10);
        h.ctx.values.set("readyToRender", true);
        h.browser.moveTo(9500);
        h.ctx.values.set("isFollowingEnd", true);
        h.state.userScrollAnchorReset = undefined;
        if (active) {
            h.state.maintainingScrollAtEnd = "animated";
            h.state.scrollingTo = { animated: true, isScrollToEnd: true, offset: 9500, targetOffset: 9500 };
        }
        // Removing a trailing row clamps the browser before the retained tail measures.
        const scroller = h.state.refScroller.current!;
        let nativeMax = 9480;
        scroller.getCurrentScrollOffset = () => 9480;
        scroller.getMaxScrollOffset = () => nativeMax;
        if (commitOnPublish) {
            h.ctx.listeners.set(
                "totalSize",
                new Set([
                    () => {
                        nativeMax = 9518;
                    },
                ]),
            );
        }
        updateItemSizes(h.ctx, { itemKey: "item_99", size: { height: 138, width: 400 } });
        // React now commits the larger measured height, before the browser's scroll event.
        nativeMax = 9518;
        await Promise.resolve();
        h.browser.moveTo(9480);
        expect(h.state.endFollowInterrupted).not.toBe(true);
        expect(h.ctx.values.get("isFollowingEnd")).toBe(true);
    });
}

it("commits instant web following before the next animation frame", async () => {
    Platform.OS = "web";
    const h = createWebScrollHarness();
    harness = h;
    h.state.props.maintainScrollAtEnd = normalizeMaintainScrollAtEnd(true);
    h.state.didContainersLayout = true;
    h.state.didFinishInitialScroll = true;
    h.state.queuedInitialLayout = true;
    h.state.startBuffered = 0;
    h.state.endBuffered = 99;
    h.ctx.values.set("numContainers", 10);
    h.ctx.values.set("readyToRender", true);
    h.ctx.scrollToEnd = (options) => scrollToEnd(h.ctx, options);
    h.browser.moveTo(9500);
    h.ctx.values.set("isFollowingEnd", true);
    h.state.userScrollAnchorReset = undefined;
    updateItemSizes(h.ctx, { itemKey: "item_99", size: { height: 138, width: 400 } });
    await Promise.resolve();
    expect(h.scrollToCalls.at(-1)).toEqual({ animated: false, y: 9538 });
});

it("keeps the full content size when the previous end target disappears before data MVCP", () => {
    Platform.OS = "web";
    const h = createWebScrollHarness();
    harness = h;
    h.state.didContainersLayout = true;
    h.state.didFinishInitialScroll = true;
    h.state.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
    h.state.scrollingTo = {
        animated: true,
        index: 99,
        isScrollToEnd: true,
        itemSize: 100,
        offset: 9900,
        viewPosition: 1,
    };
    // React has committed the shorter data before the end request is retargeted.
    h.setData(99);
    const published: number[] = [];
    h.ctx.listeners.set("totalSize", new Set([(size) => published.push(size!)]));
    const applyMVCP = prepareMVCP(h.ctx, true);
    updateItemPositions(h.ctx, true);
    expect(h.state.scrollingTo?.index).toBe(98);
    applyMVCP!();
    // A missing captured key must never be treated as addTotalSize's null reset key.
    expect(h.state.totalSize).toBe(9900);
    expect(h.ctx.values.get("totalSize")).toBe(9900);
    expect(published.every((size) => size === 9900)).toBe(true);
    expect(h.state.sizes.has(null as any)).toBe(false);
    expect(h.state.scrollingTo?.itemSize).toBe(100);
});
