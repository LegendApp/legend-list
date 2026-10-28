import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";
import * as React from "react";
import { Text } from "react-native";

import { doMaintainScrollAtEnd } from "../../src/core/doMaintainScrollAtEnd";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import { resolveInitialScrollOffset } from "../../src/core/initialScroll";
import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import { getScrollRequestTracker } from "../../src/core/scrollRequestTracker";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { updateScroll } from "../../src/core/updateScroll";
import { Platform } from "../../src/platform/Platform";
import { peek$, type StateContext, set$ } from "../../src/state/state";
import type { InternalState, LegendListInternalRef } from "../../src/types.internal";
import { setDidLayout } from "../../src/utils/setDidLayout";
import { skipLayoutInvariants } from "../helpers/layoutInvariantHarness";
import { act, render } from "../helpers/testingLibrary";
import { installFakeClock } from "../helpers/webScrollHarness";

let lastListProps: any;
let WebContainers: React.ComponentType<any> | undefined;
let renderWebContainersInListComponent = false;
const handlerInstances: ScrollAdjustHandler[] = [];
const layoutEvent = { nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } } };

function registerLegendListBootstrapMocks() {
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (props: any) => {
            lastListProps = props;
            if (!renderWebContainersInListComponent) {
                return null;
            }

            const Containers = WebContainers;
            return Containers ? (
                <Containers
                    freshDataTransitionEpoch={props.freshDataTransitionEpoch}
                    getRenderedItem={props.getRenderedItem}
                    horizontal={props.horizontal}
                    ItemSeparatorComponent={props.ItemSeparatorComponent}
                    recycleItems={props.recycleItems}
                    stickyHeaderConfig={props.stickyHeaderConfig}
                />
            ) : null;
        },
    }));

    mock.module("@/core/ScrollAdjustHandler", () => {
        return {
            ScrollAdjustHandler: class {
                context: StateContext;
                appliedAdjust = 0;
                pendingAdjust = 0;
                requestedAdjusts: number[] = [];
                mounted = false;
                constructor(ctx: StateContext) {
                    this.context = ctx;
                    handlerInstances.push(this as any);
                }
                requestAdjust(add: number) {
                    this.requestedAdjusts.push(add);
                }
                setMounted() {
                    this.mounted = true;
                }
                getAdjust() {
                    return this.appliedAdjust;
                }
                getUnsupersededPendingAdjust() {
                    return this.pendingAdjust;
                }
                commitPendingAdjust() {}
            },
        };
    });
}

// Native preserved end corrections dispatch an absolute target instead of a relative adjust.
function installRecordingScroller(state: InternalState) {
    const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
    state.refScroller.current = {
        getScrollableNode: () => ({}),
        scrollTo: (params: { animated: boolean; x: number; y: number }) => {
            scrollToCalls.push(params);
        },
    } as any;
    return scrollToCalls;
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function trackAssignedStateValue<T extends object, K extends keyof T>(object: T, key: K) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(object, key);
    let currentValue = object[key];
    const assignedValues: T[K][] = [];

    Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        get() {
            return currentValue;
        },
        set(value: T[K]) {
            assignedValues.push(value);
            currentValue = value;
        },
    });

    return {
        assignedValues,
        restore() {
            if (originalDescriptor) {
                Object.defineProperty(object, key, originalDescriptor);
            } else {
                delete (object as Record<PropertyKey, unknown>)[key as PropertyKey];
                (object as Record<PropertyKey, unknown>)[key as PropertyKey] = currentValue;
            }
        },
    };
}

async function getStateFromRender() {
    return (await getContextFromRender()).state;
}

async function getContextFromRender() {
    for (let i = 0; i < 5; i++) {
        const handler = lastListProps?.scrollAdjustHandler ?? handlerInstances.at(-1);
        if (handler) {
            return (handler as any).context as StateContext;
        }
        await flushAsync();
    }
    throw new Error("scrollAdjustHandler not found after retries");
}

function getBootstrapSession(state: any) {
    return state.initialScrollSession?.kind === "bootstrap" ? state.initialScrollSession.bootstrap : undefined;
}

function findFirstStyleByType(node: any, type: string): Record<string, unknown> | undefined {
    if (!node) {
        return undefined;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const style = findFirstStyleByType(child, type);
            if (style) {
                return style;
            }
        }
        return undefined;
    }
    if (node.type === type) {
        return node.props?.style;
    }
    return findFirstStyleByType(node.children, type);
}

function seedMeasuredLayout(state: any, count: number, size: number | number[]) {
    state.scrollLength = 200;
    for (let i = 0; i < count; i++) {
        const id = state.props.keyExtractor?.(state.props.data[i], i) ?? `item_${i}`;
        const resolvedSize = Array.isArray(size) ? (size[i] ?? size.at(-1) ?? 0) : size;
        state.idCache[i] = id;
        state.indexByKey.set(id, i);
        state.positions[i] =
            i === 0 ? 0 : (state.positions[i - 1] ?? 0) + (Array.isArray(size) ? (size[i - 1] ?? resolvedSize) : size);
        state.sizes.set(id, resolvedSize);
        state.sizesKnown.set(id, resolvedSize);
    }
}

beforeEach(() => {
    registerLegendListBootstrapMocks();
    handlerInstances.length = 0;
    lastListProps = undefined;
    WebContainers = undefined;
    renderWebContainersInListComponent = false;
    Platform.OS = "ios";
});

afterEach(() => {
    Platform.OS = "ios";
});

describe("LegendList bootstrap initial scroll", () => {
    it.each(["before layout", "native seed", "initial request"])(
        "retargets the resting start inset during %s",
        async (stage) => {
            const { LegendList } = await import("../../src/components/LegendList?pending-resting-inset");
            const data = Array.from({ length: 43 }, (_, id) => ({ id }));
            const list = (top: number) => (
                <LegendList
                    contentInset={{ bottom: 0, left: 0, right: 0, top }}
                    data={data}
                    getFixedItemSize={() => 80}
                    renderItem={() => null}
                />
            );
            const rendered = render(list(62));
            const ctx = await getContextFromRender();
            const state = ctx.state;
            const writes = installRecordingScroller(state);
            expect(state.didFinishInitialScroll).not.toBe(true);
            expect(resolveInitialScrollOffset(ctx, state.initialScroll!)).toBe(-62);
            if (stage === "native seed") act(() => updateScroll(ctx, -62, true, { fromNativeScrollEvent: true }));
            if (stage === "initial request") {
                act(() => lastListProps.onLayout(layoutEvent));
                expect(state.scrollingTo?.isInitialScroll).toBe(true);
            }

            rendered.rerender(list(116));
            expect(resolveInitialScrollOffset(ctx, state.initialScroll!)).toBe(-116);
            act(() => lastListProps.onLayout(layoutEvent));
            await flushAsync();
            expect(writes.at(-1)?.y).toBe(-116);
            act(() => updateScroll(ctx, -116, true, { fromNativeScrollEvent: true }));
            expect(state.scroll).toBe(-116);
            expect(peek$(ctx, "isAtStart")).toBe(true);
            rendered.unmount();
        },
    );

    it.each([0, -62, 120])(
        "preserves an explicit raw initial offset %s across a mount inset change",
        async (offset) => {
            const { LegendList } = await import("../../src/components/LegendList?pending-explicit-inset");
            const data = Array.from({ length: 43 }, (_, id) => ({ id }));
            const list = (top: number) => (
                <LegendList
                    contentInset={{ bottom: 0, left: 0, right: 0, top }}
                    data={data}
                    getFixedItemSize={() => 80}
                    initialScrollOffset={offset}
                    renderItem={() => null}
                />
            );
            const rendered = render(list(62));
            const ctx = await getContextFromRender();
            const writes = installRecordingScroller(ctx.state);
            rendered.rerender(list(116));
            act(() => lastListProps.onLayout(layoutEvent));
            await flushAsync();
            expect(writes.every(({ y }) => y === offset)).toBe(true);
            expect(ctx.state.scroll).toBe(offset);
            rendered.unmount();
        },
    );

    it("resumes end following when a suspended list reappears with appended data", async () => {
        Platform.OS = "web";
        const { LegendList } = await import("../../src/components/LegendList?end-follow-reappear");
        const clock = installFakeClock();
        const pending = new Promise<void>(() => {});
        const data = Array.from({ length: 20 }, (_, index) => ({ id: `item_${index}` }));
        function Suspend({ hidden }: { hidden: boolean }) {
            if (hidden) throw pending;
            return null;
        }
        const list = (hidden: boolean, items = data) => (
            <React.Suspense fallback={null}>
                <LegendList
                    data={items}
                    estimatedItemSize={100}
                    estimatedListSize={{ height: 200, width: 320 }}
                    keyExtractor={(item: { id: string }) => item.id}
                    maintainScrollAtEnd={{ animated: true, on: { dataChange: true } }}
                    renderItem={() => <Text>Row</Text>}
                />
                <Suspend hidden={hidden} />
            </React.Suspense>
        );
        let rendered: ReturnType<typeof render> | undefined;
        try {
            rendered = render(list(false));
            const ctx = await getContextFromRender();
            act(() => clock.advance(1600));
            seedMeasuredLayout(ctx.state, data.length, 100);
            ctx.state.didFinishInitialScroll = true;
            ctx.state.didContainersLayout = true;
            ctx.state.queuedInitialLayout = true;
            ctx.state.totalSize = 2000;
            ctx.state.scroll = ctx.state.scrollPending = 1800;
            // ListComponent is mocked, so no rendered containers can service recalculation.
            ctx.state.triggerCalculateItemsInView = () => {};
            set$(ctx, "isFollowingEnd", true);
            const scrollTo = mock(() => {});
            ctx.state.refScroller.current = {
                getScrollableNode: () => ({}),
                measure() {},
                scrollTo,
            } as any;

            rendered.rerender(list(true));
            expect(ctx.state.isUnmounted).toBe(true);
            const appended = [...data, { id: "item_20" }];
            rendered.rerender(list(true, appended));
            rendered.rerender(list(false, appended));

            expect(await getContextFromRender()).toBe(ctx);
            expect(ctx.state.isUnmounted).toBe(false);
            expect(peek$(ctx, "isFollowingEnd")).toBe(true);
            expect(ctx.state.maintainingScrollAtEnd).toBe("pending-animated");
            expect(ctx.state.pendingEndMeasurements).toEqual(new Set(["item_20"]));
            act(() => clock.tick());
            expect(scrollTo).toHaveBeenLastCalledWith({ animated: true, x: 0, y: 1900 });
            act(() => finishScrollTo(ctx));
            await act(async () => {
                await Promise.resolve();
            });
        } finally {
            rendered?.unmount();
            clock.restore();
        }
    });

    for (const active of [false, true]) {
        for (const strictMode of [false, true]) {
            it(`cancels automatic end following on unmount (active: ${active}, StrictMode: ${strictMode})`, async () => {
                Platform.OS = "web";
                const { LegendList } = await import("../../src/components/LegendList?end-follow-unmount");
                const clock = installFakeClock();
                const requestFrame = globalThis.requestAnimationFrame;
                let unmounted = false;
                let drainedFrames = 0;
                const scheduleFrame = mock((callback: FrameRequestCallback) =>
                    requestFrame((time) => {
                        if (unmounted) drainedFrames++;
                        callback(time);
                    }),
                );
                globalThis.requestAnimationFrame = scheduleFrame;
                const data = Array.from({ length: 20 }, (_, index) => ({ id: `item_${index}` }));
                let setups = 0;
                function MountObserver() {
                    React.useLayoutEffect(() => {
                        setups++;
                    }, []);
                    return null;
                }
                const list = (
                    <>
                        <LegendList
                            data={data}
                            estimatedItemSize={100}
                            estimatedListSize={{ height: 200, width: 320 }}
                            keyExtractor={(item: { id: string }) => item.id}
                            maintainScrollAtEnd={{ animated: true }}
                            renderItem={() => <Text>Row</Text>}
                        />
                        <MountObserver />
                    </>
                );
                const queueFollow = (ctx: StateContext) => {
                    seedMeasuredLayout(ctx.state, data.length, 100);
                    ctx.state.didFinishInitialScroll = true;
                    ctx.state.didContainersLayout = true;
                    ctx.state.queuedInitialLayout = true;
                    ctx.state.totalSize = 2000;
                    ctx.state.scroll = ctx.state.scrollPending = 1700;
                    ctx.state.scrollingTo = undefined;
                    // ListComponent is mocked, so no rendered containers can service recalculation.
                    ctx.state.triggerCalculateItemsInView = () => {};
                    set$(ctx, "isFollowingEnd", true);
                    const scrollTo = mock(() => {});
                    ctx.state.refScroller.current = {
                        getCurrentScrollOffset: () => 1700,
                        getScrollableNode: () => ({}),
                        getScrollEventTarget: () => ({
                            addEventListener() {},
                            onscrollend: null,
                            removeEventListener() {},
                        }),
                        scrollTo,
                    } as any;
                    act(() => {
                        expect(doMaintainScrollAtEnd(ctx)).toBe(true);
                    });
                    expect(ctx.state.maintainingScrollAtEnd).toBe("pending-animated");
                    return scrollTo;
                };
                let rendered: ReturnType<typeof render> | undefined;
                try {
                    rendered = render(strictMode ? <React.StrictMode>{list}</React.StrictMode> : list);
                    const ctx = await getContextFromRender();
                    act(() => clock.advance(1600));
                    const scrollTo = queueFollow(ctx);
                    const request = spyOn(getScrollRequestTracker(ctx), "runNowIfIdle");
                    expect(setups).toBe(strictMode ? 2 : 1);
                    if (active) {
                        act(() => clock.tick());
                        expect(ctx.state.scrollingTo).toBeDefined();
                        expect(ctx.state.pendingScrollResolve).toBeDefined();
                        act(() => {
                            doMaintainScrollAtEnd(ctx);
                        });
                        expect(ctx.state.pendingMaintainScrollAtEnd).toBe(true);
                    }
                    rendered.unmount();
                    unmounted = true;
                    ctx.state.refScroller.current = null;
                    const framesBefore = scheduleFrame.mock.calls.length;
                    const scrollsBefore = scrollTo.mock.calls.length;
                    const requestsBefore = request.mock.calls.length;
                    await act(async () => {
                        await Promise.resolve();
                    });
                    act(() => clock.advance(1600));
                    await act(async () => {
                        await Promise.resolve();
                    });
                    expect(scheduleFrame.mock.calls.length - framesBefore).toBe(0);
                    expect(drainedFrames).toBe(0);
                    expect(request.mock.calls.length).toBe(requestsBefore);
                    expect(scrollTo.mock.calls.length).toBe(scrollsBefore);
                    expect(ctx.state.scrollingTo).toBeUndefined();
                    expect(ctx.state.pendingScrollResolve).toBeUndefined();
                    expect(ctx.state.maintainingScrollAtEnd).toBeUndefined();
                    expect(ctx.state.pendingMaintainScrollAtEnd).toBe(false);
                    act(() => {
                        updateItemSizesBatch(ctx, [{ itemKey: "item_19", size: { height: 150, width: 320 } }]);
                    });
                    expect(ctx.state.sizesKnown.get("item_19")).toBe(150);
                    expect(doMaintainScrollAtEnd(ctx)).toBe(false);
                    expect(scheduleFrame.mock.calls.length).toBe(framesBefore);
                    expect(request.mock.calls.length).toBe(requestsBefore);
                    expect(ctx.state.maintainingScrollAtEnd).toBeUndefined();
                    if (strictMode) {
                        unmounted = false;
                        rendered = render(<React.StrictMode>{list}</React.StrictMode>);
                        const remounted = await getContextFromRender();
                        const remountedScrollTo = queueFollow(remounted);
                        expect(setups).toBe(4);
                        expect(remounted.state.isUnmounted).toBe(false);
                        act(() => clock.tick());
                        expect(remountedScrollTo).toHaveBeenCalled();
                        expect(remounted.state.scrollingTo?.isScrollToEnd).toBe(true);
                        act(() => finishScrollTo(remounted));
                        await act(async () => {
                            await Promise.resolve();
                        });
                        expect(remounted.state.pendingScrollResolve).toBeUndefined();
                        expect(remounted.state.maintainingScrollAtEnd).toBeUndefined();
                    }
                } finally {
                    rendered?.unmount();
                    clock.restore();
                }
            });
        }
    }

    for (const strictMode of [false, true]) {
        it(`stops terminal bootstrap completion on unmount${strictMode ? " and completes on a fresh StrictMode mount" : ""}`, async () => {
            Platform.OS = "web";
            const { LegendList } = await import("../../src/components/LegendList?terminal-bootstrap-unmount");
            const clock = installFakeClock();
            const requestFrame = globalThis.requestAnimationFrame;
            const scheduleFrame = mock((callback: FrameRequestCallback) => requestFrame(callback));
            globalThis.requestAnimationFrame = scheduleFrame;
            const onReady = mock(() => {});
            const onLoad = mock(() => {});
            const data = Array.from({ length: 20 }, (_, index) => ({ id: `item_${index}` }));
            let setups = 0;
            function MountObserver() {
                React.useLayoutEffect(() => {
                    setups++;
                }, []);
                return null;
            }
            const list = (
                <>
                    <LegendList
                        data={data}
                        estimatedItemSize={100}
                        estimatedListSize={{ height: 200, width: 320 }}
                        initialScrollIndex={5}
                        keyExtractor={(item: { id: string }) => item.id}
                        onLoad={onLoad}
                        onReady={onReady}
                        renderItem={() => <Text>Row</Text>}
                    />
                    <MountObserver />
                </>
            );
            const reachCompletionFrame = (ctx: StateContext) => {
                act(() => setDidLayout(ctx));
                seedMeasuredLayout(ctx.state, data.length, 100);
                let offset = 0;
                const scrollTo = mock(({ y }: { y: number }) => {
                    offset = y;
                });
                ctx.state.refScroller.current = {
                    getCurrentScrollOffset: () => offset,
                    getScrollableNode: () => ({}),
                    scrollTo,
                } as any;
                act(() => {
                    ctx.state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                    ctx.state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                });
                expect(scrollTo).toHaveBeenCalled();
                expect(offset).toBe(500);
                expect(ctx.state.scrollingTo?.waitForInitialScrollCompletionFrame).toBe(true);
                act(() => finishScrollTo(ctx));
                expect(getBootstrapSession(ctx.state)).toBeUndefined();
                expect(ctx.state.didContainersLayout).toBe(true);
                expect(ctx.state.didFinishInitialScroll).toBeFalsy();
            };
            let rendered: ReturnType<typeof render> | undefined;
            try {
                rendered = render(strictMode ? <React.StrictMode>{list}</React.StrictMode> : list);
                const ctx = await getContextFromRender();
                reachCompletionFrame(ctx);
                expect(setups).toBe(strictMode ? 2 : 1);
                expect(onReady).not.toHaveBeenCalled();
                expect(onLoad).not.toHaveBeenCalled();
                rendered.unmount();
                expect(ctx.state.isUnmounted).toBe(true);
                ctx.state.refScroller.current = null;
                const framesBefore = scheduleFrame.mock.calls.length;
                act(() => clock.advance(1600));
                expect(onReady).not.toHaveBeenCalled();
                expect(onLoad).not.toHaveBeenCalled();
                expect(ctx.state.didFinishInitialScroll).toBeFalsy();
                expect(scheduleFrame.mock.calls.length).toBe(framesBefore);
                if (strictMode) {
                    rendered = render(<React.StrictMode>{list}</React.StrictMode>);
                    const remountedContext = await getContextFromRender();
                    reachCompletionFrame(remountedContext);
                    act(() => clock.advance(1600));
                    expect(setups).toBe(4);
                    expect(remountedContext.state.isUnmounted).toBe(false);
                    expect(remountedContext.state.didFinishInitialScroll).toBe(true);
                    expect(onReady).toHaveBeenCalledTimes(1);
                    expect(onLoad).toHaveBeenCalledTimes(1);
                }
            } finally {
                rendered?.unmount();
                clock.restore();
            }
        });
    }

    for (const strictMode of [false, true]) {
        it(`stops early bootstrap work on unmount${strictMode ? " after surviving StrictMode replay" : ""}`, async () => {
            const { LegendList } = await import("../../src/components/LegendList?early-bootstrap-unmount");
            const clock = installFakeClock();
            const requestFrame = globalThis.requestAnimationFrame;
            const scheduleFrame = mock((callback: FrameRequestCallback) => requestFrame(callback));
            globalThis.requestAnimationFrame = scheduleFrame;
            const onReady = mock(() => {});
            const onLoad = mock(() => {});
            const data = Array.from({ length: 20 }, (_, index) => ({ id: `item_${index}` }));
            let setups = 0;
            function MountObserver() {
                React.useLayoutEffect(() => {
                    setups++;
                }, []);
                return null;
            }
            const list = (
                <>
                    <LegendList
                        data={data}
                        estimatedItemSize={100}
                        estimatedListSize={{ height: 200, width: 320 }}
                        initialScrollIndex={5}
                        keyExtractor={(item: { id: string }) => item.id}
                        onLoad={onLoad}
                        onReady={onReady}
                        renderItem={() => <Text>Row</Text>}
                    />
                    <MountObserver />
                </>
            );
            let rendered: ReturnType<typeof render> | undefined;
            try {
                rendered = render(strictMode ? <React.StrictMode>{list}</React.StrictMode> : list);
                const ctx = await getContextFromRender();
                const state = ctx.state;
                act(() => setDidLayout(ctx));
                expect(getBootstrapSession(state)).toBeDefined();
                expect(onReady).not.toHaveBeenCalled();
                expect(onLoad).not.toHaveBeenCalled();
                if (strictMode) {
                    expect(setups).toBe(2);
                    expect(state.isUnmounted).toBe(false);
                    act(() => clock.advance(16));
                    expect(getBootstrapSession(state).mountFrameCount).toBeGreaterThan(0);
                }
                rendered.unmount();
                expect(state.isUnmounted).toBe(true);
                // The mocked ListComponent does not detach its scroller ref on unmount.
                state.refScroller.current = null;
                const framesBefore = scheduleFrame.mock.calls.length;
                const readyBefore = onReady.mock.calls.length;
                const loadBefore = onLoad.mock.calls.length;
                act(() => clock.advance(1600));
                expect(scheduleFrame.mock.calls.length).toBe(framesBefore);
                expect(onReady).toHaveBeenCalledTimes(readyBefore);
                expect(onLoad).toHaveBeenCalledTimes(loadBefore);
                if (strictMode) {
                    rendered = render(<React.StrictMode>{list}</React.StrictMode>);
                    const remountedContext = await getContextFromRender();
                    const remountedState = remountedContext.state;
                    act(() => setDidLayout(remountedContext));
                    seedMeasuredLayout(remountedState, data.length, 100);
                    remountedState.refScroller.current = { getCurrentScrollOffset: () => 500 } as any;
                    act(() => {
                        remountedState.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                        remountedState.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                    });
                    expect(remountedState.didFinishInitialScroll).toBe(true);
                    expect(onReady).toHaveBeenCalledTimes(1);
                    expect(onLoad).toHaveBeenCalledTimes(1);
                }
            } finally {
                rendered?.unmount();
                clock.restore();
            }
        });
    }

    for (const strictMode of [false, true]) {
        it(`stops preserved measurement corrections on unmount${strictMode ? " after surviving StrictMode replay" : ""}`, async () => {
            Platform.OS = "web";
            const { LegendList } = await import("../../src/components/LegendList?preserved-correction-unmount");
            const clock = installFakeClock();
            const requestFrame = globalThis.requestAnimationFrame;
            const scheduleFrame = mock((callback: FrameRequestCallback) => requestFrame(callback));
            globalThis.requestAnimationFrame = scheduleFrame;
            const data = Array.from({ length: 20 }, (_, index) => ({ id: `item_${index}` }));
            let ctx: StateContext;
            let setups = 0;
            let observedOffset = 1800;
            let maxOffset = 1800;
            const scrollOffsets: number[] = [];
            let firstCorrection: InternalState["preservedEndAnchorCorrection"];
            let correctionAfterReplay: InternalState["preservedEndAnchorCorrection"];
            let targetAfterReplay: InternalState["initialScroll"];

            function Measurement() {
                React.useEffect(() => {
                    ctx = (lastListProps.scrollAdjustHandler as any).context;
                    const state = ctx.state;
                    setups++;
                    if (setups === 1) {
                        seedMeasuredLayout(state, data.length, 100);
                        state.totalSize = 2000;
                        state.scroll = state.scrollPending = 1800;
                        state.didFinishInitialScroll = true;
                        state.didContainersLayout = true;
                        state.queuedInitialLayout = true;
                        state.startBuffered = 1;
                        state.endBuffered = 19;
                        state.scrollingTo = undefined;
                        state.initialScroll = { index: 19, viewPosition: 1 };
                        state.initialScrollSession = { kind: "bootstrap", previousDataLength: data.length };
                        set$(ctx, "totalSize", 2000);
                    } else {
                        correctionAfterReplay = state.preservedEndAnchorCorrection;
                        targetAfterReplay = state.initialScroll;
                    }
                    state.refScroller.current = {
                        getCurrentScrollOffset: () => observedOffset,
                        getMaxScrollOffset: () => maxOffset,
                        getScrollableNode: () => ({}),
                        measure: () => {},
                        scrollTo: ({ y = 0 }: { y?: number }) => {
                            observedOffset = Math.min(y, maxOffset);
                            scrollOffsets.push(observedOffset);
                        },
                    } as any;
                    updateItemSizesBatch(ctx, [{ itemKey: "item_19", size: { height: 200, width: 320 } }]);
                    firstCorrection ??= state.preservedEndAnchorCorrection;
                }, []);
                return null;
            }

            const list = (
                <>
                    <LegendList
                        data={data}
                        estimatedItemSize={100}
                        estimatedListSize={{ height: 200, width: 320 }}
                        initialScrollAtEnd
                        keyExtractor={(item: { id: string }) => item.id}
                        maintainVisibleContentPosition={false}
                        renderItem={() => <Text>Row</Text>}
                    />
                    <Measurement />
                </>
            );
            let rendered: ReturnType<typeof render> | undefined;
            try {
                rendered = render(strictMode ? <React.StrictMode>{list}</React.StrictMode> : list);
                expect(firstCorrection).toBeDefined();
                expect(ctx!.state.preservedEndAnchorCorrection).toBeDefined();
                if (strictMode) {
                    expect(setups).toBe(2);
                    expect(correctionAfterReplay).toBe(firstCorrection);
                    expect(targetAfterReplay).toMatchObject({ index: 19, viewPosition: 1 });
                    expect(ctx!.state.preservedEndAnchorCorrection).toBe(firstCorrection);
                    maxOffset = resolveInitialScrollOffset(ctx!, ctx!.state.initialScroll!);
                    await Promise.resolve();
                    act(() => clock.advance(64));
                    expect(scrollOffsets.length).toBeGreaterThan(0);
                    expect(observedOffset).toBe(maxOffset);
                    expect(ctx!.state.preservedEndAnchorCorrection).toBeUndefined();
                    // Start another clamped correction so final unmount also has pending work.
                    updateItemSizesBatch(ctx!, [{ itemKey: "item_19", size: { height: 400, width: 320 } }]);
                    expect(ctx!.state.preservedEndAnchorCorrection).toBeDefined();
                }
                rendered.unmount();
                expect(ctx!.state.isUnmounted).toBe(true);
                ctx!.state.refScroller.current = null;
                const framesBefore = scheduleFrame.mock.calls.length;
                const callsBefore = scrollOffsets.length;
                await Promise.resolve();
                act(() => clock.advance(1600));
                expect(scheduleFrame.mock.calls.length).toBe(framesBefore);
                expect(scrollOffsets).toHaveLength(callsBefore);
                expect(ctx!.state.preservedEndAnchorCorrection).toBeUndefined();

                // An old-architecture measurement can arrive after cleanup has run.
                updateItemSizesBatch(ctx!, [{ itemKey: "item_19", size: { height: 500, width: 320 } }]);
                const framesAfterMeasurement = scheduleFrame.mock.calls.length;
                expect(framesAfterMeasurement).toBe(framesBefore);
                await Promise.resolve();
                act(() => clock.advance(1600));
                expect(scheduleFrame.mock.calls.length).toBe(framesAfterMeasurement);
                expect(scrollOffsets).toHaveLength(callsBefore);
                expect(ctx!.state.preservedEndAnchorCorrection).toBeUndefined();
            } finally {
                rendered?.unmount();
                clock.restore();
            }
        });
    }

    for (const platform of ["web", "ios", "android"] as const) {
        it(`settles every captured-ref scroll after unmount on ${platform}`, async () => {
            Platform.OS = platform;
            const { LegendList } = await import("../../src/components/LegendList?captured-ref-unmount");
            const data = [{ id: "row-0" }, { id: "row-1" }];
            const ref = { current: null as LegendListInternalRef | null };
            const rendered = render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    estimatedListSize={{ height: 100, width: 320 }}
                    keyExtractor={(item: { id: string }) => item.id}
                    ref={ref}
                    renderItem={() => <Text>Row</Text>}
                />,
            );
            const state = await getStateFromRender();
            const capturedRef = ref.current!;
            const scrollToCalls = installRecordingScroller(state);
            rendered.unmount();
            state.refScroller.current = null;
            const requests = [
                () => capturedRef.scrollToOffset({ offset: 100 }),
                () => capturedRef.scrollToIndex({ index: 1 }),
                () => capturedRef.scrollToItem({ item: data[1] }),
                () => capturedRef.scrollToKey({ key: "row-1" }),
                () => capturedRef.scrollIndexIntoView({ index: 1 }),
                () => capturedRef.scrollItemIntoView({ item: data[1] }),
                () => capturedRef.scrollToEnd(),
            ];
            for (const request of requests) {
                const results: unknown[] = [];
                void request().then((result) => results.push(result));
                await flushAsync();
                expect(results).toEqual([undefined]);
                expect(state.pendingScrollResolve).toBeUndefined();
                expect(state.pendingScrollToEnd).toBeUndefined();
                expect(state.scrollingTo).toBeUndefined();
                expect(state.scheduledWork.has("imperativeScrollReady")).toBe(false);
            }
            expect(scrollToCalls).toHaveLength(0);
        });
    }

    it("seeds a cached dataKey return from incoming positions instead of the outgoing dataset", async () => {
        Platform.OS = "web";
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-cached-data-key-return");
        const firstData = Array.from({ length: 5 }, (_, index) => ({ id: `first-${index}` }));
        const secondData = Array.from({ length: 3 }, (_, index) => ({ id: `second-${index}` }));
        const list = (data: typeof firstData, dataKey: string) => (
            <LegendList
                data={data}
                dataKey={dataKey}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={() => <Text>Row</Text>}
            />
        );
        const rendered = render(list(firstData, "first"));
        const ctx = await getContextFromRender();
        seedMeasuredLayout(ctx.state, firstData.length, 100);
        ctx.state.totalSize = 500;
        ctx.values.set("totalSize", 500);
        rendered.rerender(list(secondData, "second"));
        await flushAsync();
        seedMeasuredLayout(ctx.state, secondData.length, 50);
        ctx.state.totalSize = 150;
        ctx.values.set("totalSize", 150);
        ctx.state.initialScrollSession = undefined;
        ctx.state.initialScroll = undefined;
        ctx.state.didFinishInitialScroll = true;
        const tracker = trackAssignedStateValue(ctx.state, "initialScrollSession");

        try {
            rendered.rerender(list(firstData, "first"));
            await flushAsync();
            const firstBootstrap = tracker.assignedValues.find(
                (session) => session?.kind === "bootstrap" && session.bootstrap,
            );
            expect(firstBootstrap?.kind === "bootstrap" && firstBootstrap.bootstrap?.seedContentOffset).toBe(300);
            expect(ctx.state.sizesKnown.get("first-4")).toBe(100);
            expect(ctx.state.positions).toEqual([0, 100, 200, 300, 400]);
        } finally {
            tracker.restore();
            rendered.unmount();
        }
    });

    for (const platform of ["web", "ios", "android"] as const) {
        it(`retains oversized alignment through initial props and dataKey changes on ${platform}`, async () => {
            Platform.OS = platform;
            const data = Array.from({ length: 20 }, (_, index) => ({ id: `row-${index}` }));
            const { LegendList } = await import("../../src/components/LegendList?bootstrap-position-fallback");
            const list = (dataKey: string, viewPositionFallback: "start" | "end") => (
                <LegendList
                    data={data}
                    dataKey={dataKey}
                    estimatedItemSize={50}
                    estimatedListSize={{ height: 200, width: 320 }}
                    initialScrollIndex={{ index: 5, viewPosition: 0.5, viewPositionFallback }}
                    keyExtractor={(item: { id: string }) => item.id}
                    renderItem={() => <Text>Row</Text>}
                />
            );
            const rendered = render(list("first", "start"));
            const ctx = await getContextFromRender();
            seedMeasuredLayout(
                ctx.state,
                data.length,
                data.map((_, index) => (index === 5 ? 600 : 50)),
            );
            ctx.values.set("totalSize", 1550);
            expect(ctx.state.initialScroll?.viewPositionFallback).toBe("start");
            expect(resolveInitialScrollOffset(ctx, ctx.state.initialScroll!)).toBe(250);
            rendered.rerender(list("second", "end"));
            await flushAsync();
            seedMeasuredLayout(
                ctx.state,
                data.length,
                data.map((_, index) => (index === 5 ? 600 : 50)),
            );
            ctx.values.set("totalSize", 1550);
            expect(ctx.state.initialScroll?.viewPositionFallback).toBe("end");
            expect(resolveInitialScrollOffset(ctx, ctx.state.initialScroll!)).toBe(650);
            rendered.unmount();
        });
    }

    it("short-circuits zero-valued targets without starting bootstrap", async () => {
        const data = [{ id: "item-0", label: "Item 0" }];
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-zero");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={0}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll).toBeUndefined();
        expect(getBootstrapSession(state)).toBeUndefined();
    });

    it("reveals natively without a corrective scroll when the mount seed already matches", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-native");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={5}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(lastListProps.initialContentOffset).toBe(250);
        state.refScroller.current = {
            getCurrentScrollOffset: () => 250,
        } as any;

        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(getBootstrapSession(state)).toBeUndefined();
        expect(state.scrollingTo).toBeUndefined();
        expect(state.scroll).toBe(250);
    });

    it("finishes immediately once the mounted bootstrap window is measured", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-immediate-finish");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={5}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        state.refScroller.current = {
            getCurrentScrollOffset: () => 250,
        } as any;
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(getBootstrapSession(state)).toBeUndefined();
        expect(state.scrollingTo).toBeUndefined();
        expect(state.scroll).toBe(250);
    });

    it("completes web corrective scrolls through finishScrollTo", async () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "web";
        WebContainers = (await import("../../src/components/Containers?bootstrap-web-containers")).Containers;
        renderWebContainersInListComponent = true;
        try {
            const data = Array.from({ length: 10 }, (_, index) => ({
                id: `item-${index}`,
                label: `Item ${index}`,
            }));
            const { LegendList } = await import("../../src/components/LegendList?bootstrap-web");

            const rendered = render(
                <LegendList
                    data={data}
                    estimatedItemSize={50}
                    estimatedListSize={{ height: 200, width: 320 }}
                    initialScrollIndex={5}
                    keyExtractor={(item: { id: string }) => item.id}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );

            const state = await getStateFromRender();
            const ctx = await getContextFromRender();
            expect(lastListProps.initialContentOffset).toBeUndefined();
            expect(ctx.values.get("readyToRender")).toBeUndefined();
            expect(findFirstStyleByType(rendered.toJSON(), "div")).toMatchObject({
                opacity: 0,
                pointerEvents: "none",
            });

            seedMeasuredLayout(state, data.length, 50);

            await act(async () => {
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            });

            expect(state.scrollingTo?.isInitialScroll).toBe(true);
            expect(state.didFinishInitialScroll).not.toBe(true);

            await act(async () => {
                finishScrollTo((handlerInstances.at(-1) as any).context);
            });

            expect(state.didFinishInitialScroll).toBe(true);
            expect(ctx.values.get("readyToRender")).toBe(true);
            expect(findFirstStyleByType(rendered.toJSON(), "div")).toMatchObject({
                opacity: 1,
            });
            expect(getBootstrapSession(state)).toBeUndefined();
        } finally {
            WebContainers = undefined;
            renderWebContainersInListComponent = false;
            Platform.OS = previousPlatform;
        }
    });

    it("keeps the web layer painted but noninteractive during a fresh dataKey layout reset", async () => {
        // Marks layout complete with setDidLayout and never allocates rows.
        skipLayoutInvariants();
        const previousPlatform = Platform.OS;
        Platform.OS = "web";
        WebContainers = (await import("../../src/components/Containers?fresh-data-web-containers")).Containers;
        renderWebContainersInListComponent = true;
        const { LegendList } = await import("../../src/components/LegendList?fresh-data-visibility");

        const initialData = [
            { id: "old-1", label: "Old 1" },
            { id: "old-2", label: "Old 2" },
        ];
        const nextData = [
            { id: "new-1", label: "New 1" },
            { id: "new-2", label: "New 2" },
        ];
        const renderList = (data: typeof initialData, dataKey: string) => (
            <LegendList
                data={data}
                dataKey={dataKey}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />
        );

        try {
            const rendered = render(renderList(initialData, "old"));
            const ctx = await getContextFromRender();

            await act(async () => {
                setDidLayout(ctx);
            });

            expect(ctx.values.get("readyToRender")).toBe(true);
            expect(findFirstStyleByType(rendered.toJSON(), "div")).toMatchObject({ opacity: 1 });

            rendered.rerender(renderList(nextData, "new"));
            await flushAsync();

            expect(ctx.values.get("readyToRender")).toBe(false);
            expect(ctx.state.props.data).toBe(nextData);
            expect(findFirstStyleByType(rendered.toJSON(), "div")).toMatchObject({
                opacity: 1,
                pointerEvents: "none",
            });

            await act(async () => {
                setDidLayout(ctx);
            });

            expect(ctx.values.get("readyToRender")).toBe(true);
            expect(findFirstStyleByType(rendered.toJSON(), "div")).toMatchObject({ opacity: 1 });
            rendered.unmount();
        } finally {
            WebContainers = undefined;
            renderWebContainersInListComponent = false;
            Platform.OS = previousPlatform;
        }
    });

    it("rearms empty initialScrollAtEnd when data arrives later", async () => {
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-empty-at-end");
        const rendered = render(
            <LegendList
                data={[]}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const emptyState = await getStateFromRender();
        const ctx = await getContextFromRender();
        expect(emptyState.didFinishInitialScroll).toBe(true);
        expect(getBootstrapSession(emptyState)).toBeUndefined();
        await act(async () => {
            setDidLayout(ctx);
        });
        expect(ctx.values.get("readyToRender")).toBe(true);

        const nextData = [{ id: "item-0", label: "Item 0" }];
        rendered.rerender(
            <LegendList
                data={nextData}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        const state = await getStateFromRender();
        expect(state.didFinishInitialScroll).toBe(false);
        expect(ctx.values.get("readyToRender")).toBe(false);
        expect(getBootstrapSession(state)).toBeDefined();

        seedMeasuredLayout(state, nextData.length, 50);
        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
    });

    it("rearms empty initialScrollIndex when data arrives later", async () => {
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-empty-index");
        const rendered = render(
            <LegendList
                data={[]}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={2}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const emptyState = await getStateFromRender();
        const ctx = await getContextFromRender();
        expect(emptyState.didFinishInitialScroll).toBe(true);
        expect(emptyState.initialScroll?.index).toBe(2);
        expect(getBootstrapSession(emptyState)).toBeUndefined();
        await act(async () => {
            setDidLayout(ctx);
        });
        expect(ctx.values.get("readyToRender")).toBe(true);

        const nextData = Array.from({ length: 5 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        rendered.rerender(
            <LegendList
                data={nextData}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={2}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        const state = await getStateFromRender();
        expect(state.didFinishInitialScroll).toBe(false);
        expect(ctx.values.get("readyToRender")).toBe(false);
        expect(getBootstrapSession(state)).toBeDefined();

        seedMeasuredLayout(state, nextData.length, 50);
        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.scrollingTo?.isInitialScroll).toBe(true);
        expect(state.scrollingTo?.targetOffset ?? state.scrollingTo?.offset).toBe(50);

        await act(async () => {
            finishScrollTo((handlerInstances.at(-1) as any).context);
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
    });

    it("uses initialScrollIndex from the first non-empty data render", async () => {
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-late-index");
        const rendered = render(
            <LegendList
                data={[]}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={undefined}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const ctx = await getContextFromRender();
        await act(async () => {
            setDidLayout(ctx);
        });
        expect(ctx.state.initialScroll).toBeUndefined();
        expect(ctx.state.didFinishInitialScroll).toBe(true);

        const nextData = Array.from({ length: 5 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        rendered.rerender(
            <LegendList
                data={nextData}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={2}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        const state = await getStateFromRender();
        expect(state.initialScroll?.index).toBe(2);
        expect(state.didFinishInitialScroll).toBe(false);
        expect(getBootstrapSession(state)).toBeDefined();
    });

    it("replaces the empty-render initialScrollIndex when data arrives later", async () => {
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-replace-empty-index");
        const rendered = render(
            <LegendList
                data={[]}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={1}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const ctx = await getContextFromRender();
        expect(ctx.state.initialScroll?.index).toBe(1);

        const nextData = Array.from({ length: 5 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        rendered.rerender(
            <LegendList
                data={nextData}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={4}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        const state = await getStateFromRender();
        expect(state.initialScroll?.index).toBe(4);
        expect(state.didFinishInitialScroll).toBe(false);
        expect(getBootstrapSession(state)).toBeDefined();
    });

    it("uses the latest initialScrollIndex after a previous dataset is cleared", async () => {
        const initialData = Array.from({ length: 5 }, (_, index) => ({
            id: `initial-${index}`,
            label: `Initial ${index}`,
        }));
        const nextData = Array.from({ length: 5 }, (_, index) => ({
            id: `next-${index}`,
            label: `Next ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-cleared-replace-index");
        const renderList = (data: typeof initialData, initialScrollIndex?: number) => (
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={initialScrollIndex}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />
        );
        const rendered = render(renderList(initialData, 1));

        const ctx = await getContextFromRender();
        const state = await getStateFromRender();
        seedMeasuredLayout(state, initialData.length, 50);
        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });
        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);

        rendered.rerender(renderList([]));
        await flushAsync();

        rendered.rerender(renderList(nextData, 3));
        await flushAsync();

        expect(state.initialScroll?.index).toBe(3);
        expect(state.didFinishInitialScroll).toBe(false);
        expect(ctx.values.get("readyToRender")).toBe(false);
    });

    it("uses the latest initialScrollIndex when dataKey changes with non-empty data", async () => {
        const initialData = Array.from({ length: 5 }, (_, index) => ({
            id: `initial-${index}`,
            label: `Initial ${index}`,
        }));
        const nextData = Array.from({ length: 5 }, (_, index) => ({
            id: `next-${index}`,
            label: `Next ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-data-key-replace-index");
        const renderList = (data: typeof initialData, dataKey: string, initialScrollIndex?: number) => (
            <LegendList
                data={data}
                dataKey={dataKey}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={initialScrollIndex}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />
        );
        const rendered = render(renderList(initialData, "dataset-1", 1));

        const ctx = await getContextFromRender();
        const state = await getStateFromRender();
        seedMeasuredLayout(state, initialData.length, 50);
        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });
        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);

        rendered.rerender(renderList(nextData, "dataset-2", 3));
        await flushAsync();

        expect(state.initialScroll?.index).toBe(3);
        expect(state.didFinishInitialScroll).toBe(false);
        expect(ctx.values.get("readyToRender")).toBe(false);
    });

    it("preserves the native seed when bootstrap bounds are exceeded", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-abort");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={5}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);
        expect(lastListProps.initialContentOffset).toBe(250);
        await act(async () => {
            setDidLayout(ctx);
        });
        getBootstrapSession(state).mountFrameCount = 8;
        getBootstrapSession(state).passCount = 24;

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(state.scroll).toBe(250);
        expect(getBootstrapSession(state)).toBeUndefined();
    });

    it("invalidates bootstrap settle when footer measurement changes the end offset", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-footer");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(getBootstrapSession(state)).toBeDefined();

        getBootstrapSession(state).mountFrameCount = 3;

        await act(async () => {
            lastListProps.onLayoutFooter?.({ height: 40, width: 320, x: 0, y: 0 });
        });

        expect(state.initialScroll.viewOffset).toBe(-40);
        expect(getBootstrapSession(state)?.mountFrameCount).toBeGreaterThanOrEqual(3);
        expect(getBootstrapSession(state)?.passCount).toBe(0);
    });

    it("rearms bootstrap when data changes without a length change", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-same-length-change");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={1}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(getBootstrapSession(state)).toBeDefined();

        getBootstrapSession(state).mountFrameCount = 3;
        getBootstrapSession(state).passCount = 4;

        rendered.rerender(
            <LegendList
                data={data.map((item) => ({ ...item, label: `${item.label} updated` }))}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={1}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        expect(getBootstrapSession(state)).toBeDefined();
        expect(getBootstrapSession(state)?.mountFrameCount).toBeGreaterThanOrEqual(3);
    });

    it("re-targets bottom-aligned bootstrap targets when paddingBottom changes", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-padding-bottom");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 10 }}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.viewOffset).toBe(-10);
        expect(getBootstrapSession(state)).toBeDefined();

        getBootstrapSession(state).mountFrameCount = 3;

        rendered.rerender(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 40 }}
            />,
        );

        await flushAsync();

        expect(state.initialScroll?.viewOffset).toBe(-40);
        expect(getBootstrapSession(state)?.mountFrameCount).toBeGreaterThanOrEqual(3);
        expect(getBootstrapSession(state)).toBeDefined();
    });

    it("re-targets horizontal bottom-aligned bootstrap targets when end padding changes", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-padding-right");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                horizontal
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                rtl={false}
                style={{ paddingRight: 10 }}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.viewOffset).toBe(-10);
        expect(getBootstrapSession(state)).toBeDefined();

        getBootstrapSession(state).mountFrameCount = 3;

        rendered.rerender(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                horizontal
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                rtl={false}
                style={{ paddingRight: 40 }}
            />,
        );

        await flushAsync();

        expect(state.initialScroll?.viewOffset).toBe(-40);
        expect(getBootstrapSession(state)?.mountFrameCount).toBeGreaterThanOrEqual(3);
        expect(getBootstrapSession(state)).toBeDefined();
    });

    it("does not overwrite explicit bottom-aligned viewOffset values when paddingBottom changes", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-explicit-view-offset");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewOffset: -5, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 10 }}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.viewOffset).toBe(-5);

        rendered.rerender(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewOffset: -5, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 40 }}
            />,
        );

        await flushAsync();

        expect(state.initialScroll?.viewOffset).toBe(-5);
    });

    it("clears a finished bottom-aligned initialScrollIndex when data changes", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import(
            "../../src/components/LegendList?bootstrap-finished-bottom-index-data-change"
        );
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }
        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.viewPosition).toBe(1);
        expect(getBootstrapSession(state)).toBeUndefined();

        rendered.rerender(
            <LegendList
                data={data.map((item) => ({ ...item, label: `${item.label} updated` }))}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll).toBeUndefined();
        expect(getBootstrapSession(state)).toBeUndefined();
        expect(state.scrollingTo).toBeUndefined();
    });

    it("retargets a finished initialScrollAtEnd target when data changes", async () => {
        const data = Array.from({ length: 5 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-finished-end-data-change");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }
        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.index).toBe(4);
        expect(getBootstrapSession(state)).toBeUndefined();

        const appendedData = [...data, { id: "item-5", label: "Item 5" }];
        rendered.rerender(
            <LegendList
                data={appendedData}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll).toMatchObject({
            index: 5,
            preserveForBottomPadding: true,
            viewPosition: 1,
        });
        expect(getBootstrapSession(state)).toMatchObject({
            scroll: 100,
        });
    });

    it("does not retarget initialScrollAtEnd after the user scrolls near but away from the end", async () => {
        const data = Array.from({ length: 5 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-finished-end-user-scroll");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            finishScrollTo(ctx);
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.index).toBe(4);
        expect(getBootstrapSession(state)).toBeUndefined();

        await act(async () => {
            lastListProps.onScroll({
                nativeEvent: {
                    contentOffset: { x: 0, y: 45 },
                },
            });
        });

        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);
        expect(state.initialScroll).toBeUndefined();

        const appendedData = [...data, { id: "item-5", label: "Item 5" }];
        rendered.rerender(
            <LegendList
                data={appendedData}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        expect(state.initialScroll).toBeUndefined();
        expect(getBootstrapSession(state)).toBeUndefined();
    });

    it("resets render readiness when footer layout retargets a finished end alignment", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-footer-ready");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                ListFooterComponent={() => <Text>Footer</Text>}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);

        await act(async () => {
            lastListProps.onLayoutFooter?.({ height: 40, width: 320, x: 0, y: 0 });
        });

        expect(state.didFinishInitialScroll).toBe(false);
        expect(ctx.values.get("readyToRender")).toBe(false);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
    });

    it("adjusts a finished end alignment when a later authoritative layout shrinks the viewport", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-layout-retarget");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            expect(state.scrollingTo.targetOffset ?? state.scrollingTo.offset).toBe(100);
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.viewPosition).toBe(1);
        const scrollToCalls = installRecordingScroller(state);

        await act(async () => {
            lastListProps.onLayout?.({
                nativeEvent: {
                    layout: { height: 150, width: 320, x: 0, y: 0 },
                },
            });
        });
        await flushAsync();

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.viewPosition).toBe(1);
        expect(getBootstrapSession(state)).toBeUndefined();
        expect(state.scrollingTo).toBeUndefined();
        expect(lastListProps.scrollAdjustHandler.requestedAdjusts).toEqual([]);
        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 150 }]);
        expect(state.scroll).toBe(150);
        expect(ctx.values.get("readyToRender")).toBe(true);
    });

    it("keeps the finished end target alive until a later relayout adjusts it", async () => {
        const originalSetTimeout = globalThis.setTimeout;
        let preservedTargetClearDelay: number | undefined;
        let queuedPreservedTargetClear: (() => void) | undefined;
        globalThis.setTimeout = ((callback: TimerHandler, delay?: number) => {
            if (typeof delay === "number" && delay > 0) {
                preservedTargetClearDelay = delay;
                queuedPreservedTargetClear = callback as () => void;
                return 1 as any;
            }

            return originalSetTimeout(callback, delay as number | undefined);
        }) as typeof setTimeout;

        try {
            const data = Array.from({ length: 6 }, (_, index) => ({
                id: `item-${index}`,
                label: `Item ${index}`,
            }));
            const { LegendList } = await import("../../src/components/LegendList?bootstrap-layout-retarget-delayed");

            render(
                <LegendList
                    data={data}
                    estimatedItemSize={50}
                    estimatedListSize={{ height: 200, width: 320 }}
                    initialScrollAtEnd
                    keyExtractor={(item: { id: string }) => item.id}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );

            const state = await getStateFromRender();
            const ctx = await getContextFromRender();
            seedMeasuredLayout(state, data.length, 50);

            await act(async () => {
                setDidLayout(ctx);
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            });

            if (state.scrollingTo?.isInitialScroll) {
                await act(async () => {
                    finishScrollTo(ctx);
                });
            }

            expect(state.didFinishInitialScroll).toBe(true);
            expect(state.initialScroll?.viewPosition).toBe(1);
            expect(preservedTargetClearDelay).toBe(2000);
            expect(queuedPreservedTargetClear).toBeDefined();
            const scrollToCalls = installRecordingScroller(state);

            await act(async () => {
                lastListProps.onLayout?.({
                    nativeEvent: {
                        layout: { height: 150, width: 320, x: 0, y: 0 },
                    },
                });
            });
            await flushAsync();

            expect(state.didFinishInitialScroll).toBe(true);
            expect(state.initialScroll?.viewPosition).toBe(1);
            expect(getBootstrapSession(state)).toBeUndefined();
            expect(state.scrollingTo).toBeUndefined();
            expect(lastListProps.scrollAdjustHandler.requestedAdjusts).toEqual([]);
            expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 150 }]);
            expect(state.scroll).toBe(150);
        } finally {
            globalThis.setTimeout = originalSetTimeout;
        }
    });

    it("preserves a finished end alignment after a width-only layout change", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-width-layout-retarget");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);

        const finishTracker = trackAssignedStateValue(state, "didFinishInitialScroll");
        try {
            await act(async () => {
                lastListProps.onLayout?.({
                    nativeEvent: {
                        layout: { height: 200, width: 260, x: 0, y: 0 },
                    },
                });
            });

            expect(finishTracker.assignedValues).not.toContain(false);
            expect(state.didFinishInitialScroll).toBe(true);
            expect(state.initialScroll?.viewPosition).toBe(1);
            expect(getBootstrapSession(state)).toBeUndefined();
            expect(state.scrollingTo).toBeUndefined();
            expect(lastListProps.scrollAdjustHandler.requestedAdjusts).toEqual([]);
        } finally {
            finishTracker.restore();
        }
    });
});

describe("LegendList initial scroll footer alignment", () => {
    const data = Array.from({ length: 6 }, (_, index) => ({ id: `item-${index}`, label: `Item ${index}` }));

    async function mountWithFooter(
        name: string,
        props: Record<string, unknown>,
        footerHeight = 40,
        paddingBottom = 10,
    ) {
        const { LegendList } = await import(`../../src/components/LegendList?footer-alignment-${name}`);
        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                keyExtractor={(item: { id: string }) => item.id}
                ListFooterComponent={<Text>Footer</Text>}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom }}
                {...props}
            />,
        );
        const state = await getStateFromRender();
        expect(getBootstrapSession(state)).toBeDefined();
        await act(async () => {
            lastListProps.onLayoutFooter?.({ height: footerHeight, width: 320, x: 0, y: 0 });
        });
        return state;
    }

    it("counts padding and footer for initialScrollAtEnd and marks footer preservation", async () => {
        const state = await mountWithFooter("at-end", { initialScrollAtEnd: true });

        expect(state.initialScroll).toMatchObject({
            index: 5,
            preserveForFooterLayout: true,
            viewOffset: -50,
            viewPosition: 1,
        });
    });

    it("counts padding and footer for a numeric initialScrollIndex on the last row", async () => {
        const state = await mountWithFooter("numeric-last", { initialScrollIndex: 5 });

        expect(state.initialScroll).toMatchObject({ index: 5, viewOffset: -50, viewPosition: 1 });
    });

    it("counts padding and footer for an out-of-range numeric initialScrollIndex", async () => {
        const state = await mountWithFooter("numeric-beyond", { initialScrollIndex: 99 });

        expect(state.initialScroll).toMatchObject({ index: 99, viewOffset: -50, viewPosition: 1 });
    });

    it("counts padding and footer for a bottom-aligned object target on the last row", async () => {
        const state = await mountWithFooter("object-last", { initialScrollIndex: { index: 5, viewPosition: 1 } });

        expect(state.initialScroll).toMatchObject({ index: 5, viewOffset: -50, viewPosition: 1 });
    });

    it("does not add the footer to an explicit viewOffset on the last row", async () => {
        const state = await mountWithFooter("object-explicit", {
            initialScrollIndex: { index: 5, viewOffset: 0, viewPosition: 1 },
        });

        expect(state.initialScroll).toMatchObject({ index: 5, viewOffset: 0, viewPosition: 1 });
    });

    it("does not add the footer to a numeric initialScrollIndex before the last row", async () => {
        const state = await mountWithFooter("numeric-middle", { initialScrollIndex: 2 });

        expect(state.initialScroll).toMatchObject({ index: 2, viewOffset: 0 });
    });

    it("does not add the footer to a top-aligned last-row target", async () => {
        const state = await mountWithFooter("object-top", { initialScrollIndex: { index: 5, viewPosition: 0 } });

        expect(state.initialScroll).toMatchObject({ index: 5, viewOffset: 0, viewPosition: 0 });
    });

    it("follows footer size changes on a numeric last-row target while bootstrap is active", async () => {
        const state = await mountWithFooter("numeric-resize", { initialScrollIndex: 5 });

        await act(async () => {
            lastListProps.onLayoutFooter?.({ height: 90, width: 320, x: 0, y: 0 });
        });

        expect(state.initialScroll).toMatchObject({ index: 5, viewOffset: -100, viewPosition: 1 });
    });

    it("drops the footer from a numeric last-row target when data grows past it", async () => {
        const { LegendList } = await import("../../src/components/LegendList?footer-alignment-numeric-grow");
        const ctx = await (async () => {
            const element = (rows: typeof data) => (
                <LegendList
                    data={rows}
                    estimatedItemSize={50}
                    estimatedListSize={{ height: 200, width: 320 }}
                    initialScrollIndex={5}
                    keyExtractor={(item: { id: string }) => item.id}
                    ListFooterComponent={<Text>Footer</Text>}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                    style={{ paddingBottom: 10 }}
                />
            );
            const rendered = render(element(data));
            const context = await getContextFromRender();
            expect(getBootstrapSession(context.state)).toBeDefined();
            await act(async () => {
                lastListProps.onLayoutFooter?.({ height: 40, width: 320, x: 0, y: 0 });
            });
            set$(context, "footerSize", 40);
            expect(context.state.initialScroll?.viewOffset).toBe(-50);
            rendered.rerender(
                element([...data, ...Array.from({ length: 4 }, (_, i) => ({ id: `more-${i}`, label: `More ${i}` }))]),
            );
            await flushAsync();
            return context;
        })();

        expect(ctx.state.initialScroll).toMatchObject({ index: 5, viewOffset: -10, viewPosition: 1 });
    });
});
