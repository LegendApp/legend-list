import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { schedulePreservedEndAnchorCorrection } from "../../src/core/bootstrapInitialScroll";
import { checkFinishedScroll } from "../../src/core/checkFinishedScroll";
import { doMaintainScrollAtEnd } from "../../src/core/doMaintainScrollAtEnd";
import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { advanceCurrentInitialScrollSession } from "../../src/core/initialScroll";
import { prepareMVCP } from "../../src/core/mvcp";
import { onScroll } from "../../src/core/onScroll";
import { scrollTo as scrollToTarget } from "../../src/core/scrollTo";
import { scrollToEnd } from "../../src/core/scrollToEnd";
import { updateContentMetricsState } from "../../src/core/updateContentMetricsState";
import { Platform } from "../../src/platform/Platform";
import { peek$, type StateContext, set$ } from "../../src/state/state";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";

describe("negative scroll targets", () => {
    let frames: FrameRequestCallback[];
    let contexts: StateContext[];

    beforeEach(() => {
        frames = [];
        contexts = [];
        spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
            frames.push(callback);
            return frames.length;
        });
        spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    });

    afterEach(() => {
        for (const ctx of contexts) ctx.state.scheduledWork.dispose();
    });

    function flushFrames() {
        const pending = frames.splice(0);
        for (const frame of pending) frame(0);
    }

    function setup() {
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                lastLayout: { height: 300, width: 400, x: 0, y: 0 },
                positions: Array.from({ length: 10 }, (_, i) => i * 100),
                props: {
                    contentInset: { bottom: 0, left: 0, right: 0, top: 60 },
                    data: Array.from({ length: 10 }, (_, i) => ({ id: i })),
                    getFixedItemSize: () => 100,
                    maintainScrollAtEnd: true,
                    maintainVisibleContentPosition: { data: true, size: true },
                },
                queuedInitialLayout: true,
                scroll: 100,
                scrollLength: 300,
                scrollPending: 100,
                totalSize: 1000,
            },
        );
        for (let i = 0; i < 10; i++) {
            ctx.state.sizes.set(`item_${i}`, 100);
            ctx.state.sizesKnown.set(`item_${i}`, 100);
            ctx.state.indexByKey.set(`item_${i}`, i);
        }
        const scrollTo = mock(() => {});
        ctx.state.refScroller.current = { scrollTo } as any;
        contexts.push(ctx);
        const handle = createImperativeHandle(ctx);
        handle.reportContentInset({ top: 80 });
        return { ctx, handle, scrollTo };
    }

    function land(ctx: StateContext, offset: number) {
        onScroll(ctx, { nativeEvent: { contentOffset: { x: 0, y: offset } } } as any);
        checkFinishedScroll(ctx);
        flushFrames();
    }

    for (const platform of ["ios", "android", "web"] as const) {
        for (const animated of [false, true]) {
            for (const requested of [80, 800]) {
                for (const method of [
                    "scrollToIndex",
                    "scrollToOffset",
                    "scrollIndexIntoView",
                    "scrollItemIntoView",
                ] as const) {
                    it(`${platform} ${method} clamps -${requested} (animated: ${animated})`, async () => {
                        Platform.OS = platform;
                        const { ctx, handle, scrollTo } = setup();
                        const expected = platform === "ios" ? -80 : 0;
                        const request =
                            method === "scrollToOffset"
                                ? handle.scrollToOffset({ animated, offset: -requested })
                                : method === "scrollToIndex"
                                  ? handle.scrollToIndex({ animated, index: 0, viewOffset: requested })
                                  : method === "scrollIndexIntoView"
                                    ? handle.scrollIndexIntoView({
                                          animated,
                                          index: 0,
                                          viewportMargin: { start: requested },
                                      })
                                    : handle.scrollItemIntoView({
                                          animated,
                                          item: ctx.state.props.data[0],
                                          viewportMargin: { start: requested },
                                      });
                        expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
                        expect(scrollTo).toHaveBeenLastCalledWith({ animated, x: 0, y: expected });
                        land(ctx, expected);
                        await request;
                        expect(ctx.state.scrollingTo).toBeUndefined();
                        expect(ctx.state.scroll).toBe(expected);
                        expect(handle.getState().isAtStart).toBe(true);
                        expect(handle.getState().distanceFromEnd).toBe(700 - expected);
                        expect(doMaintainScrollAtEnd(ctx)).toBe(false);
                        expect(ctx.state.scroll).toBe(expected);
                    });
                }
            }
        }

        for (const method of ["scrollIndexIntoView", "scrollItemIntoView"] as const) {
            it(`${platform} ${method} clamps item regions with viewport margins`, async () => {
                Platform.OS = platform;
                const { ctx, handle } = setup();
                const options = {
                    animated: false,
                    itemLength: 30,
                    itemOffset: 20,
                    viewportMargin: { end: 10, start: 800 },
                };
                const request =
                    method === "scrollIndexIntoView"
                        ? handle.scrollIndexIntoView({ ...options, index: 0 })
                        : handle.scrollItemIntoView({ ...options, item: ctx.state.props.data[0] });
                const expected = platform === "ios" ? -80 : 0;
                expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
                land(ctx, expected);
                await request;
                expect(ctx.state.scroll).toBe(expected);
            });
        }

        for (const kind of ["offset", "bootstrap"] as const) {
            for (const requested of [80, 800]) {
                it(`${platform} initial ${kind} settles -${requested} at its lower bound`, () => {
                    Platform.OS = platform;
                    const { ctx } = setup();
                    ctx.state.didFinishInitialScroll = false;
                    ctx.state.initialScrollSession = { kind, previousDataLength: 10 };
                    ctx.state.initialScroll =
                        kind === "offset"
                            ? { contentOffset: -requested, index: 0 }
                            : { index: 0, viewOffset: requested };
                    expect(advanceCurrentInitialScrollSession(ctx, { forceScroll: true })).toBe(true);
                    const expected = platform === "ios" ? -80 : 0;
                    expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
                    land(ctx, expected);
                    expect(ctx.state.scrollingTo).toBeUndefined();
                    expect(ctx.state.scroll).toBe(expected);
                    expect(ctx.state.didFinishInitialScroll).toBe(true);
                });
            }
        }
    }

    for (const platform of ["ios", "android", "web"] as const) {
        const top = platform === "ios" ? 80 : 0;

        it.each([
            [0, 0, 0 - top],
            [3, 0, 300 - top],
            [5, 0.5, 500 - top - (200 - top) / 2],
            [5, 1, 300],
        ])(
            `${platform} scrollToIndex %p at viewPosition %p aligns below the top inset`,
            async (index, viewPosition, expected) => {
                Platform.OS = platform;
                const { ctx, handle } = setup();
                const request = handle.scrollToIndex({ animated: false, index, viewPosition });
                expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
                land(ctx, expected);
                await request;
                expect(ctx.state.scroll).toBe(expected);
            },
        );

        it(`${platform} initial index lands below the top inset`, () => {
            Platform.OS = platform;
            const { ctx } = setup();
            ctx.state.didFinishInitialScroll = false;
            ctx.state.initialScrollSession = { kind: "bootstrap", previousDataLength: 10 };
            ctx.state.initialScroll = { index: 3, viewPosition: 0 };
            expect(advanceCurrentInitialScrollSession(ctx, { forceScroll: true })).toBe(true);
            expect(ctx.state.scrollingTo?.targetOffset).toBe(300 - top);
            land(ctx, 300 - top);
            expect(ctx.state.didFinishInitialScroll).toBe(true);
            expect(ctx.state.scroll).toBe(300 - top);
        });

        it.each([0, 120, 300])(`${platform} scrollToOffset(%i) preserves absolute coordinates`, async (offset) => {
            Platform.OS = platform;
            const { ctx, handle } = setup();
            const request = handle.scrollToOffset({ animated: false, offset });
            expect(ctx.state.scrollingTo?.targetOffset).toBe(offset);
            land(ctx, offset);
            await request;
        });

        for (const method of ["scrollIndexIntoView", "scrollItemIntoView"] as const) {
            const intoView = (
                handle: ReturnType<typeof createImperativeHandle>,
                ctx: StateContext,
                index: number,
                options: Omit<Parameters<typeof handle.scrollIndexIntoView>[0], "index">,
            ) =>
                method === "scrollIndexIntoView"
                    ? handle.scrollIndexIntoView({ ...options, index })
                    : handle.scrollItemIntoView({ ...options, item: ctx.state.props.data[index] });

            it.each([
                [{}, 300 - top],
                [{ viewportMargin: { start: 10 } }, 290 - top],
                [{ itemLength: 30, itemOffset: 20 }, 320 - top],
            ])(`${platform} ${method} treats an item under the top inset as hidden (%p)`, (options, expected) => {
                Platform.OS = platform;
                const { ctx, handle } = setup();
                ctx.state.scroll = ctx.state.scrollPending = 250;
                intoView(handle, ctx, 3, { animated: false, ...options });
                if (platform === "ios") {
                    expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
                } else {
                    expect(ctx.state.scrollingTo).toBeUndefined();
                }
            });

            it(`${platform} ${method} end-aligns an item region above the bottom edge`, () => {
                Platform.OS = platform;
                const { ctx, handle } = setup();
                ctx.state.scroll = ctx.state.scrollPending = 0;
                intoView(handle, ctx, 5, { animated: false, itemLength: 30, itemOffset: 50 });
                expect(ctx.state.scrollingTo?.targetOffset).toBe(280);
            });
        }
    }

    for (const animated of [false, true]) {
        it.each([
            [0, 0, -80],
            [3, 24, 196],
            [5, -12, 432],
        ])(`iOS scrollToItem(%i), viewOffset %i (animated: ${animated})`, async (index, viewOffset, expected) => {
            Platform.OS = "ios";
            const { ctx, handle, scrollTo } = setup();
            const request = handle.scrollToItem({
                animated,
                item: ctx.state.props.data[index],
                viewOffset,
                viewPosition: 0,
            });
            expect(scrollTo).toHaveBeenLastCalledWith({ animated, x: 0, y: expected });
            expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
            land(ctx, expected);
            await request;
            expect(ctx.state.scroll).toBe(expected);
        });
    }

    it.each([-80, 0, 120])("iOS initialScrollOffset preserves absolute offset %i", (offset) => {
        Platform.OS = "ios";
        const { ctx } = setup();
        ctx.state.didFinishInitialScroll = false;
        ctx.state.initialScrollSession = { kind: "offset", previousDataLength: 10 };
        ctx.state.initialScroll = { contentOffset: offset, index: 0 };
        advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
        expect(ctx.state.scrollingTo?.targetOffset).toBe(offset);
        land(ctx, offset);
        expect(ctx.state.scroll).toBe(offset);
        expect(ctx.state.didFinishInitialScroll).toBe(true);
    });

    for (const method of ["scrollIndexIntoView", "scrollItemIntoView"] as const) {
        // Exact regions at both edges, fully visible no-ops, and whole-row targets.
        const cases = [
            { expected: 220, from: 700, options: {} },
            { expected: 208, from: 700, options: { viewportMargin: { end: 18, start: 12 } } },
            { expected: 244, from: 700, options: { itemLength: 32, itemOffset: 24 } },
            {
                expected: 232,
                from: 700,
                options: { itemLength: 32, itemOffset: 24, viewportMargin: { end: 18, start: 12 } },
            },
            { expected: 100, from: -80, options: {} },
            { expected: 118, from: -80, options: { viewportMargin: { end: 18, start: 12 } } },
            { expected: 56, from: -80, options: { itemLength: 32, itemOffset: 24 } },
            {
                expected: 74,
                from: -80,
                options: { itemLength: 32, itemOffset: 24, viewportMargin: { end: 18, start: 12 } },
            },
            { expected: 220, from: 220, options: {} },
            {
                expected: 232,
                from: 232,
                options: { itemLength: 32, itemOffset: 24, viewportMargin: { end: 18, start: 12 } },
            },
        ];
        for (const { from, options, expected } of cases) {
            it(`iOS ${method} from ${from} with ${JSON.stringify(options)} lands at ${expected}`, async () => {
                Platform.OS = "ios";
                const { ctx, handle, scrollTo } = setup();
                ctx.state.scroll = ctx.state.scrollPending = from;
                const request =
                    method === "scrollIndexIntoView"
                        ? handle.scrollIndexIntoView({ animated: false, index: 3, ...options })
                        : handle.scrollItemIntoView({ animated: false, item: ctx.state.props.data[3], ...options });
                if (from === expected) {
                    expect(scrollTo).not.toHaveBeenCalled();
                    expect(ctx.state.scrollingTo).toBeUndefined();
                } else {
                    expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
                    expect(scrollTo).toHaveBeenLastCalledWith({ animated: false, x: 0, y: expected });
                    land(ctx, expected);
                }
                await request;
                expect(ctx.state.scroll).toBe(expected);
            });
        }
    }

    for (const bottom of [0, 40]) {
        for (const header of [0, 64]) {
            it(`iOS index and end targets include header ${header} and bottom inset ${bottom}`, async () => {
                Platform.OS = "ios";
                const { ctx, handle } = setup();
                handle.reportContentInsetForScrollInternal!({ bottom, top: 80 });
                set$(ctx, "headerSize", header);
                for (const [viewPosition, expected] of [
                    [0, 300 + header - 80],
                    [0.5, 300 + header - 80 - (120 - bottom) / 2],
                    [1, 100 + header + bottom],
                ]) {
                    const request = handle.scrollToIndex({ animated: false, index: 3, viewPosition });
                    expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
                    land(ctx, expected);
                    await request;
                }
                const request = handle.scrollToEnd({ animated: false });
                const endOffset = 700 + header + bottom;
                expect(ctx.state.scrollingTo?.targetOffset).toBe(endOffset);
                land(ctx, endOffset);
                await request;
                expect(ctx.state.scroll).toBe(endOffset);
            });
        }
    }

    for (const bottom of [0, 40]) {
        for (const count of [1, 2, 10]) {
            it(`boots initialScrollAtEnd with ${count} rows and bottom inset ${bottom}`, () => {
                Platform.OS = "ios";
                const { ctx, handle } = setup();
                ctx.state.props.data = ctx.state.props.data.slice(0, count);
                ctx.state.positions = ctx.state.positions.slice(0, count);
                ctx.state.totalSize = count * 100;
                handle.reportContentInsetForScrollInternal!({ bottom, top: 80 });
                ctx.state.didFinishInitialScroll = false;
                ctx.state.initialScrollSession = { kind: "bootstrap", previousDataLength: count };
                ctx.state.initialScroll = { index: count - 1, preserveForBottomPadding: true, viewPosition: 1 };
                advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
                const expected = Math.max(-80, count * 100 + bottom - 300);
                expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
                land(ctx, expected);
                expect(ctx.state.didFinishInitialScroll).toBe(true);
                expect(ctx.state.scroll).toBe(expected);
            });
        }
    }

    for (const count of [1, 2, 3, 10]) {
        for (const bottom of [0, 40]) {
            for (const alignItemsAtEnd of [false, true]) {
                it(`iOS end: ${count} rows, bottom ${bottom}, alignItemsAtEnd ${alignItemsAtEnd}`, async () => {
                    Platform.OS = "ios";
                    const { ctx, handle } = setup();
                    ctx.state.props.data = ctx.state.props.data.slice(0, count);
                    ctx.state.positions = ctx.state.positions.slice(0, count);
                    ctx.state.totalSize = count * 100;
                    ctx.state.props.alignItemsAtEndPaddingEnabled = alignItemsAtEnd;
                    handle.reportContentInsetForScrollInternal!({ bottom, top: 80 });
                    updateContentMetricsState(ctx);
                    const expected = Math.max(-80, count * 100 + bottom - 300);
                    const request = handle.scrollToEnd({ animated: false });
                    expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
                    land(ctx, expected);
                    await request;
                    expect(ctx.state.scroll).toBe(expected);
                });
            }
        }
    }

    it("follows streaming growth from a short inset list through the viewport boundary and keyboard changes", async () => {
        Platform.OS = "ios";
        const { ctx, handle } = setup();
        ctx.scrollToEnd = (options) => scrollToEnd(ctx, options);
        ctx.state.props.alignItemsAtEndPaddingEnabled = true;
        // Each step is a committed append or keyboard bottom-inset update.
        for (const [count, bottom, expected] of [
            [1, 0, -80],
            [2, 0, -80],
            [3, 0, 0],
            [4, 0, 100],
            [4, 120, 220],
            [4, 0, 100],
        ]) {
            ctx.state.props.data = Array.from({ length: count }, (_, id) => ({ id }));
            ctx.state.positions = Array.from({ length: count }, (_, i) => i * 100);
            ctx.state.totalSize = count * 100;
            handle.reportContentInsetForScrollInternal!({ bottom, top: 80 });
            updateContentMetricsState(ctx);
            set$(ctx, "isFollowingEnd", true);
            expect(doMaintainScrollAtEnd(ctx)).toBe(true);
            flushFrames();
            expect(ctx.state.scrollingTo?.targetOffset).toBe(expected);
            land(ctx, expected);
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(ctx.state.scroll).toBe(expected);
        }
    });

    it.each([-80, 220, 700])("preserves the reader at %i across two iOS MVCP prepends", (offset) => {
        Platform.OS = "ios";
        const { ctx } = setup();
        ctx.state.scroll = ctx.state.scrollPending = offset;
        ctx.state.visibleContentAnchor = { key: "item_3", offset: offset - 300 };
        for (const shift of [100, 200]) {
            const adjust = prepareMVCP(ctx, true);
            ctx.state.positions.forEach((position, index) => {
                ctx.state.positions[index] = position! + shift;
            });
            ctx.state.totalSize += shift;
            adjust!();
            expect(ctx.state.scroll).toBe(offset + (shift === 100 ? 100 : 300));
            expect(ctx.state.scroll - ctx.state.positions[3]!).toBe(offset - 300);
        }
    });

    it("uses KeyboardAwareLegendList absolute insets that already include the static top", async () => {
        Platform.OS = "ios";
        const { ctx, handle, scrollTo } = setup();
        const staticTop = ctx.state.props.contentInset!.top;
        const effectiveTop = staticTop + 40;
        ctx.state.nativeContentInset = { bottom: 300, left: 0, right: 0, top: effectiveTop };
        handle.reportContentInsetForScrollInternal!({ bottom: 300, top: effectiveTop });
        const request = handle.scrollToOffset({ animated: false, offset: -800 });
        expect(ctx.state.scrollingTo?.targetOffset).toBe(-effectiveTop);
        expect(scrollTo).toHaveBeenLastCalledWith({ animated: false, x: 0, y: -effectiveTop });
        land(ctx, -effectiveTop);
        await request;
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.scroll).toBe(-effectiveTop);
    });

    it.each([false, true])(
        "keeps initial offset state clamped while preserving raw dispatch (forced: %s)",
        (forceScroll) => {
            Platform.OS = "ios";
            const { ctx, scrollTo } = setup();
            ctx.state.didFinishInitialScroll = false;
            ctx.state.initialScrollSession = { kind: "offset", previousDataLength: 10 };
            scrollToTarget(ctx, { animated: false, forceScroll, isInitialScroll: true, offset: -800 });
            expect(ctx.state.scrollPending).toBe(-80);
            expect(ctx.state.scrollingTo?.targetOffset).toBe(-80);
            if (forceScroll) {
                expect(scrollTo).toHaveBeenLastCalledWith({ animated: false, x: 0, y: -800 });
            } else {
                expect(scrollTo).not.toHaveBeenCalled();
                expect(ctx.state.scroll).toBe(-80);
            }
            land(ctx, -80);
            expect(ctx.state.scrollingTo).toBeUndefined();
            expect(ctx.state.scroll).toBe(-80);
            expect(ctx.state.didFinishInitialScroll).toBe(true);
        },
    );

    it.each([false, true])("preserves a negative reader anchor through MVCP (data: %s)", async (dataChanged) => {
        Platform.OS = "ios";
        const { ctx, handle } = setup();
        const request = handle.scrollToOffset({ animated: false, offset: -80 });
        land(ctx, -80);
        await request;
        ctx.state.visibleContentAnchor = { key: "item_0", offset: -80 };
        const adjust = prepareMVCP(ctx, dataChanged);
        expect(adjust).toBeDefined();
        ctx.state.positions[0] = 100;
        ctx.state.totalSize += 100;
        adjust!();
        expect(ctx.state.scroll).toBe(20);
        expect(ctx.state.scroll - ctx.state.positions[0]!).toBe(-80);
        expect(ctx.state.pendingNativeMVCPAdjust).toBeUndefined();
    });

    it("keeps short-content initial and maintained end targets within the top inset", () => {
        Platform.OS = "ios";
        const { ctx, scrollTo } = setup();
        ctx.scrollToEnd = (options) => scrollToEnd(ctx, options);
        ctx.state.props.data = ctx.state.props.data.slice(0, 2);
        ctx.state.positions = [0, 100];
        ctx.state.totalSize = 200;
        ctx.state.didFinishInitialScroll = false;
        ctx.state.initialScrollSession = { kind: "bootstrap", previousDataLength: 2 };
        ctx.state.initialScroll = { index: 1, preserveForBottomPadding: true, viewPosition: 1 };
        advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
        expect(ctx.state.scrollingTo?.targetOffset).toBe(-80);
        land(ctx, -80);
        expect(ctx.state.didFinishInitialScroll).toBe(true);
        expect(doMaintainScrollAtEnd(ctx)).toBe(true);
        expect(ctx.state.scroll).toBe(-80);
        flushFrames();
        expect(ctx.state.scrollingTo?.targetOffset).toBe(-80);
        expect(scrollTo).toHaveBeenLastCalledWith({ animated: false, x: 0, y: -80 });
        land(ctx, -80);
        expect(ctx.state.scroll).toBe(-80);
    });

    it("keeps the positive initial end target and its preserved correction", () => {
        Platform.OS = "ios";
        const { ctx, scrollTo } = setup();
        ctx.state.didFinishInitialScroll = false;
        ctx.state.initialScrollSession = { kind: "bootstrap", previousDataLength: 10 };
        ctx.state.initialScroll = { index: 9, preserveForBottomPadding: true, viewPosition: 1 };
        advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
        expect(ctx.state.scrollingTo?.targetOffset).toBe(700);
        land(ctx, 700);
        ctx.state.totalSize = 1100;
        ctx.state.positions[9] = 1000;
        schedulePreservedEndAnchorCorrection(ctx);
        flushFrames();
        expect(scrollTo).toHaveBeenLastCalledWith({ animated: false, x: 0, y: 800 });
        expect(peek$(ctx, "isAtStart")).toBe(false);
    });
});
