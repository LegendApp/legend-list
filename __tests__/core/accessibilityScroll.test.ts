import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { Platform } from "@/platform/Platform";
import { checkResetContainers } from "../../src/core/checkResetContainers";
import { doMaintainScrollAtEnd } from "../../src/core/doMaintainScrollAtEnd";
import { finishMaintainScrollAtEnd, interruptMaintainScrollAtEnd } from "../../src/core/finishMaintainScrollAtEnd";
import { onScroll } from "../../src/core/onScroll";
import { updateItemSizes } from "../../src/core/updateItemSizes";
import * as screenReader from "../../src/platform/screenReader";
import { peek$ } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("screen reader scroll ownership", () => {
    const originalPlatform = Platform.OS;
    let enabled = true;
    beforeEach(() => {
        Platform.OS = "android";
        enabled = true;
        spyOn(screenReader, "isScreenReaderEnabled").mockImplementation(() => enabled);
    });
    afterEach(() => {
        Platform.OS = originalPlatform;
    });
    function setup(horizontal = false, rtl = false) {
        const callback = mock(() => {});
        const ctx = createMockContext(
            { isFollowingEnd: true },
            {
                didFinishInitialScroll: true,
                props: { horizontal, maintainScrollAtEnd: { animated: true }, onUserScroll: callback, rtl },
                scroll: 700,
                scrollLength: 300,
                totalSize: 1000,
                triggerCalculateItemsInView: () => {},
            },
        );
        const scroll = (offset: number, content = ctx.state.totalSize, length = ctx.state.scrollLength) =>
            onScroll(ctx, {
                nativeEvent: {
                    contentOffset: { x: horizontal ? (rtl ? -offset : offset) : 0, y: horizontal ? 0 : offset },
                    contentSize: { height: horizontal ? 300 : content, width: horizontal ? content : 300 },
                    layoutMeasurement: { height: horizontal ? 300 : length, width: horizontal ? length : 300 },
                },
            } as any);
        return { callback, ctx, scroll };
    }
    for (const [horizontal, rtl] of [
        [false, false],
        [true, false],
        [true, true],
    ]) {
        it(`releases a quiet scroll away once per burst (${horizontal}, ${rtl})`, () => {
            const { ctx, callback, scroll } = setup(horizontal, rtl);
            scroll(700);
            scroll(650);
            scroll(600);
            scroll(550);
            expect(peek$(ctx, "isFollowingEnd")).toBe(false);
            expect(callback).toHaveBeenCalledTimes(1);
            ctx.state.scheduledWork.dispose();
        });
    }
    it("reports a quiet accessibility gesture toward the end", () => {
        const { ctx, callback, scroll } = setup();
        scroll(400);
        scroll(450);
        scroll(500);
        expect(callback).toHaveBeenCalledTimes(1);
        ctx.state.scheduledWork.dispose();
    });
    it("starts another burst after idle or reversal", () => {
        let time = 1000;
        spyOn(Date, "now").mockImplementation(() => time);
        const { ctx, callback, scroll } = setup();
        scroll(700);
        scroll(650);
        time += 100;
        scroll(600);
        expect(callback).toHaveBeenCalledTimes(1);
        time += 251;
        scroll(550);
        scroll(600);
        expect(callback).toHaveBeenCalledTimes(3);
        ctx.state.scheduledWork.dispose();
    });
    it("clears observations when a screen reader is disabled", () => {
        const { ctx, callback, scroll } = setup();
        scroll(700);
        enabled = false;
        scroll(650);
        enabled = true;
        scroll(600);
        expect(callback).not.toHaveBeenCalled();
        scroll(550);
        expect(callback).toHaveBeenCalledTimes(1);
        ctx.state.scheduledWork.dispose();
    });
    it("releases following without reporting accessibility input while a screen reader is off", () => {
        enabled = false;
        const { ctx, callback, scroll } = setup();
        scroll(700);
        scroll(650);
        scroll(600);
        expect(peek$(ctx, "isFollowingEnd")).toBe(false);
        expect(callback).not.toHaveBeenCalled();
        ctx.state.scheduledWork.dispose();
    });
    it("keeps unclassified native input silent until screen-reader detection is enabled", () => {
        enabled = false;
        const { ctx, callback, scroll } = setup();
        scroll(700);
        scroll(650);
        scroll(600);
        expect(callback).not.toHaveBeenCalled();
        enabled = true;
        scroll(550);
        scroll(500);
        expect(callback).toHaveBeenCalledTimes(1);
        ctx.state.scheduledWork.dispose();
    });

    for (const alreadyMeasured of [false, true]) {
        it(`accepts accessibility input after an append is measured (cached: ${alreadyMeasured})`, () => {
            const { ctx, callback, scroll } = setup();
            const state = ctx.state;
            state.props.maintainScrollAtEnd = { animated: true, on: { dataChange: true } };
            state.previousData = Array.from({ length: 9 }, (_, id) => ({ id }));
            state.props.data = [...state.previousData, { id: 9 }];
            state.props.estimatedItemSize = 100;
            state.indexByKey.set("item_9", 9);
            if (alreadyMeasured) state.sizesKnown.set("item_9", 100);
            checkResetContainers(ctx, state.props.data);
            expect(state.pendingEndMeasurements?.size).toBe(alreadyMeasured ? 0 : 1);
            if (!alreadyMeasured) {
                scroll(700);
                scroll(650);
                expect(callback).not.toHaveBeenCalled();
                expect(peek$(ctx, "isFollowingEnd")).toBe(true);
                updateItemSizes(ctx, { itemKey: "item_9", size: { height: 100, width: 300 } });
                expect(state.pendingEndMeasurements?.size).toBe(0);
            }
            // The append follow has settled; only completed measurement state remains.
            finishMaintainScrollAtEnd(ctx);
            scroll(600);
            scroll(550);
            expect(callback).toHaveBeenCalledTimes(1);
            expect(peek$(ctx, "isFollowingEnd")).toBe(false);
            state.scheduledWork.dispose();
        });
    }
    for (const retainUnmeasuredRow of [false, true]) {
        it(`retires removed append measurements without releasing retained rows (retained: ${retainUnmeasuredRow})`, () => {
            const { ctx, callback, scroll } = setup();
            const state = ctx.state;
            state.props.maintainScrollAtEnd = { animated: true, on: { dataChange: true } };
            state.props.estimatedItemSize = 100;
            state.previousData = Array.from({ length: 9 }, (_, id) => ({ id }));
            state.props.data = [...state.previousData, { id: 9 }, { id: 10 }];
            state.indexByKey.set("item_9", 9);
            state.indexByKey.set("item_10", 10);
            try {
                checkResetContainers(ctx, state.props.data);
                expect(state.pendingEndMeasurements).toEqual(new Set(["item_9", "item_10"]));
                state.previousData = state.props.data;
                state.props.data = state.props.data.slice(0, retainUnmeasuredRow ? 10 : 9);
                checkResetContainers(ctx, state.props.data);
                if (retainUnmeasuredRow) state.containerItemKeys.set("item_9", 0);
                finishMaintainScrollAtEnd(ctx);
                expect(state.pendingEndMeasurements).toEqual(new Set(retainUnmeasuredRow ? ["item_9"] : []));
                scroll(600);
                scroll(550);
                scroll(500);
                expect(callback).toHaveBeenCalledTimes(retainUnmeasuredRow ? 0 : 1);
                if (retainUnmeasuredRow) {
                    updateItemSizes(ctx, { itemKey: "item_9", size: { height: 100, width: 300 } });
                    finishMaintainScrollAtEnd(ctx);
                    scroll(450);
                    scroll(400);
                    scroll(350);
                    expect(callback).toHaveBeenCalledTimes(1);
                }
            } finally {
                state.scheduledWork.dispose();
            }
        });
    }
    for (const lateRenderedMeasurement of [false, true]) {
        it(`prunes unrendered append measurements at settle (late rendered measurement: ${lateRenderedMeasurement})`, () => {
            const { ctx, callback, scroll } = setup();
            const state = ctx.state;
            state.props.maintainScrollAtEnd = { animated: true, on: { dataChange: true } };
            state.props.estimatedItemSize = 100;
            state.scroll = state.scrollPending = 5700;
            state.totalSize = 6000;
            state.previousData = Array.from({ length: 10 }, (_, id) => ({ id }));
            state.props.data = Array.from({ length: 60 }, (_, id) => ({ id }));
            for (let index = 0; index < 60; index++) state.indexByKey.set(`item_${index}`, index);
            try {
                checkResetContainers(ctx, state.props.data);
                expect(state.pendingEndMeasurements?.size).toBe(50);
                // Virtualization skips the middle of the append and renders only its tail.
                for (let index = 57; index < 60; index++) state.containerItemKeys.set(`item_${index}`, index - 57);
                for (let index = lateRenderedMeasurement ? 58 : 57; index < 60; index++) {
                    updateItemSizes(ctx, { itemKey: `item_${index}`, size: { height: 100, width: 300 } });
                }
                finishMaintainScrollAtEnd(ctx);
                const pending = [...(state.pendingEndMeasurements ?? [])];
                scroll(5700);
                if (!lateRenderedMeasurement) {
                    scroll(5690);
                    scroll(5680);
                }
                expect(state.scrollingTo).toBeUndefined();
                expect(state.pendingScrollResolve).toBeUndefined();
                expect(state.maintainingScrollAtEnd).toBeUndefined();
                expect(state.pendingMaintainScrollAtEnd).toBe(false);
                expect(pending).toEqual(lateRenderedMeasurement ? ["item_57"] : []);
                expect(callback).toHaveBeenCalledTimes(lateRenderedMeasurement ? 0 : 1);
                if (lateRenderedMeasurement) {
                    state.didContainersLayout = true;
                    updateItemSizes(ctx, { itemKey: "item_57", size: { height: 150, width: 300 } });
                    expect(state.pendingEndMeasurements?.size).toBe(0);
                    expect(state.maintainingScrollAtEnd).toBe("pending-animated");
                    finishMaintainScrollAtEnd(ctx);
                    scroll(5680);
                    scroll(5670);
                    scroll(5660);
                    expect(callback).toHaveBeenCalledTimes(1);
                }
            } finally {
                state.scheduledWork.dispose();
            }
        });
    }
    for (const interruption of ["interrupt", "drag"] as const) {
        it(`prunes unrendered measurements when a follow ends through ${interruption}`, () => {
            const { ctx } = setup();
            const state = ctx.state;
            state.pendingEndMeasurements = new Set(["unrendered", "rendered"]);
            state.containerItemKeys.set("rendered", 0);
            state.maintainingScrollAtEnd = "pending-animated";
            try {
                if (interruption === "drag") {
                    state.isDragging = true;
                    expect(doMaintainScrollAtEnd(ctx)).toBe(false);
                } else {
                    interruptMaintainScrollAtEnd(ctx);
                }
                expect(state.pendingEndMeasurements).toEqual(new Set(["rendered"]));
                expect(state.maintainingScrollAtEnd).toBeUndefined();
                expect(state.pendingMaintainScrollAtEnd).toBe(false);
            } finally {
                state.scheduledWork.dispose();
            }
        });
    }
    for (const owner of [
        "queued-follow",
        "animated-follow",
        "explicit-end",
        "queued-request",
        "native-ref",
        "initial",
        "mvcp",
        "adjust",
        "drag",
        "momentum",
        "drag-handoff",
        "end-measurements",
        "queued-end",
        "mvcp-ignore",
    ]) {
        it(`excludes ${owner} and its handoff event`, () => {
            const { ctx, callback, scroll } = setup();
            const s = ctx.state;
            scroll(700);
            if (owner === "queued-follow") s.pendingMaintainScrollAtEnd = true;
            if (owner === "animated-follow") s.maintainingScrollAtEnd = "animated";
            if (owner === "explicit-end") s.scrollingTo = { animated: true, isScrollToEnd: true, offset: 700 } as any;
            if (owner === "queued-request") s.pendingScrollResolve = () => {};
            if (owner === "native-ref") s.scheduledWork.timeout(() => {}, 500, "appScrollRearm");
            if (owner === "initial") {
                s.initialScroll = { offset: 700 } as any;
                s.didFinishInitialScroll = false;
            }
            if (owner === "mvcp") s.pendingNativeMVCPAdjust = { amount: -50, startScroll: 700 } as any;
            if (owner === "adjust") ctx.values.set("scrollAdjustPending", -50);
            if (owner === "drag") s.isDragging = true;
            if (owner === "momentum") s.isMomentumScrolling = true;
            if (owner === "drag-handoff") {
                s.userScrollContentSize = 1000;
                s.scheduledWork.timeout(() => {}, 500, "endFollowRearm");
            }
            if (owner === "end-measurements") s.pendingEndMeasurements = new Set(["unmeasured"]);
            if (owner === "queued-end") s.pendingScrollToEnd = {} as any;
            if (owner === "mvcp-ignore") s.ignoreScrollFromMVCP = { gt: 0, lt: 700 };
            scroll(650);
            scroll(600);
            expect(callback).not.toHaveBeenCalled();
            s.pendingMaintainScrollAtEnd = false;
            s.maintainingScrollAtEnd = undefined;
            s.scrollingTo = undefined;
            s.pendingScrollResolve = undefined;
            s.initialScroll = undefined;
            s.didFinishInitialScroll = true;
            s.pendingNativeMVCPAdjust = undefined;
            ctx.values.set("scrollAdjustPending", 0);
            s.isDragging = false;
            s.isMomentumScrolling = false;
            s.userScrollContentSize = undefined;
            s.pendingEndMeasurements = undefined;
            s.pendingScrollToEnd = undefined;
            s.ignoreScrollFromMVCP = undefined;
            s.scheduledWork.cancel("appScrollRearm");
            s.scheduledWork.cancel("endFollowRearm");
            scroll(550);
            expect(callback).not.toHaveBeenCalled();
            ctx.state.scheduledWork.dispose();
        });
    }
    for (const metrics of ["append", "shrink-clamp", "viewport"]) {
        for (const screenReaderEnabled of [false, true]) {
            for (const [horizontal, rtl] of [
                [false, false],
                [true, false],
                [true, true],
            ]) {
                it(`excludes ${metrics} geometry events (screen reader: ${screenReaderEnabled}, horizontal: ${horizontal}, RTL: ${rtl})`, () => {
                    enabled = screenReaderEnabled;
                    const { ctx, callback, scroll } = setup(horizontal, rtl);
                    scroll(700);
                    if (metrics === "append") {
                        ctx.state.totalSize = 1100;
                        scroll(650, 1100);
                    }
                    if (metrics === "shrink-clamp") {
                        ctx.state.totalSize = 900;
                        scroll(600, 900);
                    }
                    if (metrics === "viewport") {
                        ctx.state.scrollLength = 400;
                        scroll(600, 1000, 400);
                    }
                    expect(callback).not.toHaveBeenCalled();
                    expect(peek$(ctx, "isFollowingEnd")).toBe(true);

                    // A later command with settled geometry still releases end-follow intent.
                    scroll(100);
                    expect(peek$(ctx, "isFollowingEnd")).toBe(false);
                    ctx.state.scheduledWork.dispose();
                });
            }
        }
    }
});
