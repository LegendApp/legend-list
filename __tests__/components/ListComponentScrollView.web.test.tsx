import { afterEach, beforeEach, describe, expect, it, jest, mock, spyOn } from "bun:test";
import "../setup";

import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { Platform } from "@/platform/Platform";
import { set$ } from "@/state/state";
import { normalizeMaintainScrollAtEnd } from "@/utils/normalizeMaintainScrollAtEnd";
import { invalidateHorizontalRTLScrollType } from "@/utils/rtl";
import * as webScrollUtils from "../../src/components/webScrollUtils";
import * as cancellationModule from "../../src/core/cancelScroll";
import { clearWarnDevOnceForTests } from "../../src/utils/helpers";
import { createMockContext } from "../__mocks__/createMockContext";
import TestRenderer, { act } from "../helpers/testRenderer";

type ScrollListener = (_event: Event) => void;

const { getElementScrollPosition: measureElementScrollPosition, resolveExternalScrollOffset } = webScrollUtils;
const scrollListeners = new Map<string, ScrollListener>();
const addEventListener = mock((type: string, listener: ScrollListener) => {
    scrollListeners.set(type, listener);
});
const removeEventListener = mock((type: string) => {
    scrollListeners.delete(type);
});

const schedule = mock(() => true);
const flush = mock(() => {});
const cancel = mock(() => {});
let supportsScrollEnd = false;
let listPosition = 0;
let ownerScroll = 0;
let maxOffset = 0;
let ownsInput = true;
let borderWidth = 0;
const originalGetComputedStyle = globalThis.getComputedStyle;
beforeEach(() => {
    globalThis.getComputedStyle = (() => ({
        borderBottomWidth: `${borderWidth}px`,
        borderLeftWidth: `${borderWidth}px`,
        borderRightWidth: `${borderWidth}px`,
    })) as typeof getComputedStyle;
});
afterEach(() => {
    globalThis.getComputedStyle = originalGetComputedStyle;
});
let emitScroll: () => void;
const getMaxOffset = mock(() => maxOffset);
const getScrollPosition = mock(() => ({ x: ownerScroll, y: ownerScroll }));
const ownsScrollInput = mock(() => ownsInput);
const scrollableNode = {
    clientHeight: 200,
    clientLeft: 0,
    clientTop: 0,
    clientWidth: 200,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    offsetHeight: 215,
    offsetWidth: 215,
};
const mockCtx = {
    listeners: new Map(),
    state: {
        anchoredEndSpaceSize: undefined as number | undefined,
        dataChangeNeedsScrollUpdate: false,
        didFinishInitialScroll: true,
        initialScroll: undefined as Record<string, unknown> | undefined,
        initialScrollSession: undefined as { kind?: string } | undefined,
        mvcpAnchorLock: undefined as { expiresAt: number } | undefined,
        props: {
            anchoredEndSpace: undefined as { anchorIndex: number } | undefined,
            contentInsetEndAdjustment: undefined as number | undefined,
        },
        scrollingTo: undefined as { animated?: boolean } | undefined,
    },
    values: new Map(),
} as any;

function registerWebScrollMocks() {
    mock.module("@/state/state", () => ({
        useArr$: () => [mockCtx.state.anchoredEndSpaceSize],
        useStateContext: () => mockCtx,
    }));

    mock.module("@/utils/useRafCoalescer", () => ({
        useRafCoalescer: (callback: () => void) => {
            emitScroll = callback;
            return { cancel, flush, schedule };
        },
    }));

    mock.module("../../src/components/observeScrollLayout", () => ({
        observeScrollLayout: (_element: unknown, owner: unknown, onLayout: () => void) => {
            if (owner !== null) onLayout();
            return () => {};
        },
    }));

    mock.module("../../src/components/webScrollUtils", () => ({
        clampOffset: (offset: number) => Math.max(0, Math.min(1000, offset)),
        getContentSize: () => ({ height: 0, width: 0 }),
        getElementScrollPosition: () => ({ left: listPosition, top: listPosition }),
        getLayoutMeasurement: () => ({ height: 0, width: 0 }),
        getLayoutRectangle: () => ({ height: 0, width: 0, x: 0, y: 0 }),
        getMaxOffset,
        getScrollContentSize: () => ({ height: 0, width: 0 }),
        getScrollPosition,
        isWindowTarget: (target: unknown) => target === window,
        ownsScrollInput,
        resolveExternalScrollOffset,
        resolveScrollableNode: () => scrollableNode,
        resolveScrollEventTarget: (_element: unknown, externalTarget: unknown) => {
            if (externalTarget !== undefined && externalTarget !== window) return externalTarget;
            if (_element && "scrollTo" in (_element as object)) return _element;
            const target = {
                addEventListener,
                removeEventListener,
            } as {
                addEventListener: typeof addEventListener;
                onscrollend?: null;
                removeEventListener: typeof removeEventListener;
            };
            if (supportsScrollEnd) {
                target.onscrollend = null;
            }
            return target;
        },
    }));
}

function resetMocks() {
    clearWarnDevOnceForTests();
    scrollListeners.clear();
    mockCtx.listeners.clear();
    mockCtx.values.clear();
    addEventListener.mockClear();
    removeEventListener.mockClear();
    schedule.mockClear();
    flush.mockClear();
    cancel.mockClear();
    getMaxOffset.mockClear();
    getScrollPosition.mockClear();
    ownsScrollInput.mockClear();
    supportsScrollEnd = false;
    listPosition = 0;
    ownerScroll = 0;
    maxOffset = 0;
    ownsInput = true;
    scrollableNode.clientLeft = 0;
    scrollableNode.clientTop = 0;
    scrollableNode.offsetWidth = 215;
    scrollableNode.offsetHeight = 215;
    borderWidth = 0;
    mockCtx.state.props.data = [];
    mockCtx.state.props.onUserScroll = undefined;
    mockCtx.state.props.maintainScrollAtEnd = undefined;
    mockCtx.state.props.horizontal = false;
    mockCtx.state.props.rtl = false;
    mockCtx.state.horizontalRTLScrollType = undefined;
    mockCtx.state.lastLayout = undefined;
    mockCtx.state.anchoredEndSpaceSize = undefined;
    mockCtx.state.dataChangeNeedsScrollUpdate = false;
    mockCtx.state.didFinishInitialScroll = true;
    mockCtx.state.initialScroll = undefined;
    mockCtx.state.initialScrollSession = undefined;
    mockCtx.state.mvcpAnchorLock = undefined;
    mockCtx.state.props.anchoredEndSpace = undefined;
    mockCtx.state.props.contentInsetEndAdjustment = undefined;
    mockCtx.state.scrollingTo = undefined;
    mockCtx.state.maintainingScrollAtEnd = undefined;
    mockCtx.state.pendingMaintainScrollAtEnd = false;
    mockCtx.state.pendingScrollResolve = undefined;
    mockCtx.state.endFollowInterrupted = false;
}

describe("ListComponentScrollView (web)", () => {
    beforeEach(() => {
        registerWebScrollMocks();
    });

    it.each([false, true])("skips unused downward input DOM reads (end follow: %s)", async (following) => {
        resetMocks();
        maxOffset = 1000;
        ownerScroll = 500;
        mockCtx.state.props.maintainScrollAtEnd = following;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?inactive-input-reads"
        );
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(
                <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll />,
            );
        });
        getMaxOffset.mockClear();
        getScrollPosition.mockClear();
        ownsScrollInput.mockClear();
        try {
            scrollListeners.get("wheel")?.({ deltaY: 40 } as WheelEvent);
            scrollListeners.get("wheel")?.({ deltaY: 30 } as WheelEvent);
            scrollListeners.get("touchstart")?.({ touches: [{ clientY: 80 }] } as any);
            scrollListeners.get("touchmove")?.({ touches: [{ clientY: 60 }] } as any);
            expect(getMaxOffset).not.toHaveBeenCalled();
            expect(getScrollPosition).not.toHaveBeenCalled();
            expect(ownsScrollInput).not.toHaveBeenCalled();

            mockCtx.state.props.onUserScroll = mock(() => {});
            scrollListeners.get("keydown")?.({ key: "PageDown" } as KeyboardEvent);
            expect(mockCtx.state.props.onUserScroll).toHaveBeenCalledTimes(1);
            expect(ownsScrollInput).toHaveBeenCalledTimes(1);
        } finally {
            act(() => renderer!.unmount());
        }
    });

    it("rechecks nested input ownership when it changes during a wheel gesture", async () => {
        resetMocks();
        maxOffset = 1000;
        ownerScroll = 500;
        mockCtx.state.maintainingScrollAtEnd = true;
        const onUserScroll = mock(() => {});
        mockCtx.state.props.onUserScroll = onUserScroll;
        const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?changing-nested-input-owner"
        );
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(
                <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll />,
            );
        });
        const target = {};
        try {
            ownsInput = false;
            scrollListeners.get("wheel")?.({ deltaY: -40, target, timeStamp: 0 } as any);
            expect(interrupt).not.toHaveBeenCalled();
            expect(onUserScroll).not.toHaveBeenCalled();
            ownsInput = true;
            scrollListeners.get("wheel")?.({ deltaY: -30, target, timeStamp: 16 } as any);
            expect(ownsScrollInput).toHaveBeenLastCalledWith(target, scrollableNode, false, -30);
            expect(interrupt).toHaveBeenCalledTimes(1);
            expect(onUserScroll).toHaveBeenCalledTimes(1);
            scrollListeners.get("wheel")?.({ deltaY: -22, target, timeStamp: 32 } as any);
            expect(onUserScroll).toHaveBeenCalledTimes(1);
        } finally {
            act(() => renderer!.unmount());
            interrupt.mockRestore();
        }
    });

    for (const scenario of [
        "delayed wheel delivery",
        "nested wheel continuation",
        "nested wheel begins during navigation",
        "touch hold",
        "initial end wheel",
        "initial end key",
        "initial end touch",
        "initial history wheel",
        "unmeasured overlay drag",
        "classic drag",
        "pointer release",
        "pointer cancel",
        "content press",
        "stationary press",
        "prevented press",
        "automatic end without promise",
        "queued without interruption",
    ]) {
        it(`preserves input ownership for ${scenario}`, async () => {
            resetMocks();
            maxOffset = 1000;
            ownerScroll = 500;
            mockCtx.state.scroll = 500;
            const onUserScroll = mock(() => {});
            mockCtx.state.props.onUserScroll = onUserScroll;
            const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
            const clock = spyOn(Date, "now").mockReturnValue(1000);
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?review-input-ownership"
            );
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            const send = (type: string, event: Record<string, unknown> = {}) =>
                scrollListeners.get(type)?.(event as any);
            const wheel = (deltaY: number, timeStamp: number) => send("wheel", { deltaY, timeStamp });
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll />,
                    );
                });
                if (scenario === "nested wheel begins during navigation") {
                    mockCtx.state.scrollingTo = { index: 80 };
                    mockCtx.state.pendingScrollResolve = mock();
                    ownsInput = false;
                    wheel(40, 0);
                    expect(interrupt).not.toHaveBeenCalled();
                    expect(onUserScroll).not.toHaveBeenCalled();
                    ownsInput = true;
                    wheel(30, 16);
                    expect(interrupt).toHaveBeenCalledTimes(1);
                    expect(onUserScroll).toHaveBeenCalledTimes(1);
                } else if (scenario === "delayed wheel delivery" || scenario === "nested wheel continuation") {
                    wheel(40, 0);
                    if (scenario === "nested wheel continuation") ownsInput = false;
                    clock.mockReturnValue(1090);
                    wheel(30, scenario === "nested wheel continuation" ? 96 : 16);
                    mockCtx.state.scrollingTo = { index: 80 };
                    mockCtx.state.pendingScrollResolve = mock();
                    ownsInput = true;
                    clock.mockReturnValue(1200);
                    wheel(22, scenario === "nested wheel continuation" ? 160 : 32);
                    expect(interrupt).not.toHaveBeenCalled();
                    expect(onUserScroll).toHaveBeenCalledTimes(1);
                } else if (scenario === "touch hold") {
                    mockCtx.state.scrollingTo = { index: 80 };
                    mockCtx.state.pendingScrollResolve = mock();
                    interrupt.mockImplementation(() => {
                        mockCtx.state.scrollingTo = undefined;
                        mockCtx.state.pendingScrollResolve = undefined;
                        return false;
                    });
                    send("touchstart", { touches: [{ clientY: 80 }] });
                    expect(interrupt).toHaveBeenCalledTimes(1);
                    expect(onUserScroll).not.toHaveBeenCalled();
                    send("touchmove", { touches: [{ clientY: 60 }] });
                    send("touchmove", { touches: [{ clientY: 40 }] });
                    expect(onUserScroll).toHaveBeenCalledTimes(1);
                } else if (scenario.startsWith("initial")) {
                    mockCtx.state.didFinishInitialScroll = false;
                    mockCtx.state.props.data = Array(10).fill(0);
                    mockCtx.state.initialScroll = { index: scenario.includes("history") ? 2 : 9, viewPosition: 1 };
                    mockCtx.state.scrollingTo = { isInitialScroll: true };
                    if (scenario.endsWith("wheel")) wheel(40, 0);
                    if (scenario.endsWith("key")) send("keydown", { key: "End" });
                    if (scenario.endsWith("touch")) {
                        send("touchstart", { touches: [{ clientY: 80 }] });
                        send("touchmove", { touches: [{ clientY: 60 }] });
                    }
                    expect(interrupt).toHaveBeenCalledTimes(scenario.includes("history") ? 1 : 0);
                    expect(onUserScroll).toHaveBeenCalledTimes(1);
                } else if (scenario === "automatic end without promise" || scenario === "queued without interruption") {
                    if (scenario.startsWith("automatic")) mockCtx.state.scrollingTo = { isScrollToEnd: true };
                    else mockCtx.state.pendingScrollResolve = mock();
                    wheel(40, 0);
                    expect(interrupt).not.toHaveBeenCalled();
                    expect(onUserScroll).toHaveBeenCalledTimes(1);
                } else {
                    if (scenario === "unmeasured overlay drag") scrollableNode.offsetWidth = 200;
                    send("pointerdown", {
                        clientX: scenario === "classic drag" ? 200 : 195,
                        clientY: 80,
                        defaultPrevented: scenario === "prevented press",
                        target: scenario === "content press" ? {} : scrollableNode,
                    });
                    if (scenario === "unmeasured overlay drag") send("pointermove", { clientY: 70 });
                    if (scenario === "pointer release") send("pointerup");
                    if (scenario === "pointer cancel") send("pointercancel");
                    send("scroll");
                    if (scenario !== "stationary press") ownerScroll = 400;
                    send("scroll");
                    ownerScroll = 350;
                    if (scenario !== "stationary press") send("scroll");
                    expect(onUserScroll).toHaveBeenCalledTimes(scenario === "classic drag" ? 1 : 0);
                }
            } finally {
                act(() => renderer?.unmount());
                interrupt.mockRestore();
                clock.mockRestore();
            }
        });
    }

    for (const moved of [false, true]) {
        it(`rearms following after a stationary scrollbar release (moved: ${moved})`, async () => {
            resetMocks();
            const previous = { ...mockCtx };
            const platform = Platform.OS;
            Platform.OS = "web";
            const ctx = createMockContext(
                { isFollowingEnd: true, isWithinMaintainScrollAtEndThreshold: true, totalSize: 1200 },
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    props: { maintainScrollAtEnd: normalizeMaintainScrollAtEnd(true) },
                    scroll: 1000,
                    scrollLength: 200,
                },
            );
            Object.assign(mockCtx, ctx);
            mockCtx.scrollToEnd = mock(() => true);
            maxOffset = ownerScroll = 1000;
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?stationary-scrollbar-release"
            );
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll />,
                    );
                });
                scrollListeners.get("pointerdown")?.({ clientX: 205, clientY: 80, target: scrollableNode } as any);
                expect(ctx.values.get("isFollowingEnd")).toBe(false);
                if (moved) ownerScroll = 800;
                scrollListeners.get("pointerup")?.({} as Event);
                expect(ctx.values.get("isFollowingEnd")).toBe(!moved);
                ctx.values.set("totalSize", 1300);
                ctx.values.set("isWithinMaintainScrollAtEndThreshold", false);
                doMaintainScrollAtEnd(mockCtx, { immediate: true });
                expect(mockCtx.scrollToEnd).toHaveBeenCalledTimes(moved ? 0 : 1);
            } finally {
                act(() => renderer?.unmount());
                ctx.state.scheduledWork.dispose();
                Object.assign(mockCtx, previous);
                Platform.OS = platform;
            }
        });
    }

    for (const horizontal of [false, true]) {
        it(`keeps animation ownership during a blank ${horizontal ? "horizontal" : "vertical"} scroll-node press`, async () => {
            resetMocks();
            maxOffset = 1000;
            ownerScroll = 500;
            mockCtx.state.props.horizontal = horizontal;
            mockCtx.state.scrollingTo = { animated: true, index: 80 };
            mockCtx.state.pendingScrollResolve = mock();
            const onUserScroll = mock();
            mockCtx.state.props.onUserScroll = onUserScroll;
            const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?blank-pointer-animation"
            );
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView
                            horizontal={horizontal}
                            onScroll={() => {}}
                            style={{}}
                            useWindowScroll
                        />,
                    );
                });
                scrollListeners.get("pointerdown")?.({
                    clientX: 100,
                    clientY: 100,
                    pointerType: "mouse",
                    target: scrollableNode,
                } as any);
                // Only the existing programmatic animation moves the scroll offset.
                ownerScroll = 600;
                scrollListeners.get("scroll")?.({} as Event);
                // Moving over blank content still does not establish scrollbar ownership.
                scrollListeners.get("pointermove")?.({ clientX: 110, clientY: 110 } as any);
                ownerScroll = 700;
                scrollListeners.get("scroll")?.({} as Event);
                expect(interrupt).not.toHaveBeenCalled();
                expect(onUserScroll).not.toHaveBeenCalled();
            } finally {
                act(() => renderer?.unmount());
                interrupt.mockRestore();
            }
        });
    }

    for (const side of ["left", "right"] as const) {
        it(`recognizes the actual RTL scrollbar gutter on the ${side} edge`, async () => {
            resetMocks();
            maxOffset = 1000;
            ownerScroll = 500;
            scrollableNode.clientLeft = 15;
            mockCtx.state.props.rtl = true;
            mockCtx.state.scrollingTo = { animated: true, index: 80 };
            mockCtx.state.pendingScrollResolve = mock();
            const onUserScroll = mock();
            mockCtx.state.props.onUserScroll = onUserScroll;
            const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?rtl-pointer-gutter"
            );
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView onScroll={() => {}} style={{}} useWindowScroll />,
                    );
                });
                scrollListeners.get("pointerdown")?.({
                    clientX: side === "left" ? 5 : 205,
                    clientY: 100,
                    pointerType: "mouse",
                    target: scrollableNode,
                } as any);
                expect(interrupt).toHaveBeenCalledTimes(side === "left" ? 1 : 0);
                expect(onUserScroll).toHaveBeenCalledTimes(side === "left" ? 1 : 0);
            } finally {
                act(() => renderer?.unmount());
                interrupt.mockRestore();
            }
        });
    }

    for (const scenario of ["overlay", "border", "horizontal gutter"] as const) {
        it(`attributes only measured scrollbar gutters for ${scenario}`, async () => {
            resetMocks();
            maxOffset = 1000;
            ownerScroll = 500;
            const horizontal = scenario === "horizontal gutter";
            mockCtx.state.props.horizontal = horizontal;
            mockCtx.state.scrollingTo = { animated: true, index: 80 };
            mockCtx.state.pendingScrollResolve = mock();
            const onUserScroll = mock();
            mockCtx.state.props.onUserScroll = onUserScroll;
            const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
            if (scenario !== "horizontal gutter") {
                borderWidth = scenario === "border" ? 2 : 0;
                scrollableNode.clientLeft = borderWidth;
                scrollableNode.clientTop = borderWidth;
                scrollableNode.offsetWidth = 200 + 2 * borderWidth;
                scrollableNode.offsetHeight = 200 + 2 * borderWidth;
            }
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?measured-pointer-gutters"
            );
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView
                            horizontal={horizontal}
                            onScroll={() => {}}
                            style={{}}
                            useWindowScroll
                        />,
                    );
                });
                scrollListeners.get("pointerdown")?.({
                    clientX: horizontal ? 100 : scrollableNode.offsetWidth - 1,
                    clientY: horizontal ? 205 : 100,
                    pointerType: "mouse",
                    target: scrollableNode,
                } as any);
                scrollListeners.get("pointermove")?.({ clientX: 195, clientY: 110 } as any);
                ownerScroll = 600;
                scrollListeners.get("scroll")?.({} as Event);
                expect(interrupt).toHaveBeenCalledTimes(horizontal ? 1 : 0);
                expect(onUserScroll).toHaveBeenCalledTimes(horizontal ? 1 : 0);
            } finally {
                act(() => renderer?.unmount());
                interrupt.mockRestore();
            }
        });
    }

    for (const mode of ["vertical", "normal", "negative", "inverted"] as const) {
        it(`keeps intended end navigation owned in ${mode} coordinates`, async () => {
            resetMocks();
            maxOffset = 1000;
            const horizontal = mode !== "vertical";
            mockCtx.state.props.horizontal = horizontal;
            mockCtx.state.props.rtl = horizontal;
            mockCtx.state.horizontalRTLScrollType = horizontal ? mode : undefined;
            mockCtx.state.scroll = 1000;
            mockCtx.state.scrollingTo = { animated: true, isScrollToEnd: true, offset: 900 };
            const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?end-coordinates"
            );
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView horizontal={horizontal} onScroll={() => {}} style={{}} />,
                        {
                            createNodeMock: () => ({
                                addEventListener,
                                removeEventListener,
                                scrollLeft: mode === "normal" ? 950 : mode === "negative" ? -950 : 50,
                                scrollTo() {},
                                scrollTop: 950,
                            }),
                        },
                    );
                });
                scrollListeners.get("scroll")?.({} as Event);
                expect(interrupt).not.toHaveBeenCalled();
                // Once unowned, input away from the end must still interrupt automatic following.
                mockCtx.state.scrollingTo = undefined;
                mockCtx.state.maintainingScrollAtEnd = "pending-animated";
                mockCtx.state.scroll = 950;
                scrollListeners.get("scroll")?.({} as Event);
                expect(interrupt).not.toHaveBeenCalled();
                const towardEnd = mode === "normal" ? 40 : -40;
                for (const input of ["wheel", "touch", "keyboard"] as const) {
                    interrupt.mockClear();
                    const navigate = (direction: number) => {
                        if (input === "wheel") {
                            scrollListeners.get("wheel")?.({
                                cancelable: true,
                                deltaX: horizontal ? direction * towardEnd : 0,
                                deltaY: direction * 40,
                            } as WheelEvent);
                        } else if (input === "touch") {
                            const touch = (position: number) =>
                                ({ touches: [{ clientX: position, clientY: position }] }) as unknown as TouchEvent;
                            scrollListeners.get("touchstart")?.(touch(100));
                            scrollListeners.get("touchmove")?.(touch(100 - direction * (horizontal ? towardEnd : 40)));
                        } else {
                            const forward = horizontal ? (towardEnd > 0 ? "ArrowRight" : "ArrowLeft") : "ArrowDown";
                            const backward = horizontal ? (towardEnd > 0 ? "ArrowLeft" : "ArrowRight") : "ArrowUp";
                            scrollListeners.get("keydown")?.({
                                key: direction > 0 ? forward : backward,
                            } as KeyboardEvent);
                        }
                    };
                    navigate(1);
                    expect(interrupt).not.toHaveBeenCalled();
                    navigate(-1);
                    expect(interrupt).toHaveBeenCalledTimes(1);
                    // Only a wheel's delta is lost to a running smooth scroll, so only it is passed on.
                    expect(interrupt).toHaveBeenCalledWith(mockCtx, input === "wheel" ? -40 : 0);
                }
            } finally {
                act(() => renderer?.unmount());
                interrupt.mockRestore();
            }
        });
    }

    it("keeps non-animated scrolling instant when the owner enables smooth CSS scrolling", async () => {
        resetMocks();
        maxOffset = 1000;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-instant-scroll"
        );
        const ref = { current: null as any };
        const owner = {
            addEventListener,
            removeEventListener,
            scrollTo: (options: ScrollToOptions) => {
                // A smooth CSS owner does not synchronously apply auto/smooth requests.
                if (options.behavior === "instant") owner.scrollTop = options.top ?? 0;
            },
            scrollTop: 0,
        };
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        onLayout={() => {}}
                        onScroll={() => {}}
                        ref={ref}
                        style={{ scrollBehavior: "smooth" }}
                    >
                        <div />
                    </ListComponentScrollView>,
                    { createNodeMock: () => owner },
                );
            });
            ref.current.scrollTo({ animated: true, y: 200 });
            expect(ref.current.getCurrentScrollOffset()).toBe(0);
            ref.current.scrollTo({ animated: false, y: 200 });
            expect(ref.current.getCurrentScrollOffset()).toBe(200);
        } finally {
            act(() => renderer?.unmount());
        }
    });

    it("keeps negative RTL offsets when scrolling a horizontal element", async () => {
        resetMocks();
        maxOffset = 1000;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-negative-rtl-scroll"
        );
        const ref = { current: null as any };
        const scrollTo = mock();
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView horizontal onLayout={() => {}} onScroll={() => {}} ref={ref} style={{}}>
                        <div />
                    </ListComponentScrollView>,
                    { createNodeMock: () => ({ addEventListener, removeEventListener, scrollTo }) },
                );
            });
            ref.current.scrollTo({ animated: false, x: -350 });
            expect(scrollTo).toHaveBeenLastCalledWith({ behavior: "instant", left: -350 });
            ref.current.scrollTo({ animated: false, x: -1500 });
            expect(scrollTo).toHaveBeenLastCalledWith({ behavior: "instant", left: -1000 });
        } finally {
            act(() => renderer?.unmount());
        }
    });

    for (const useWindowScroll of [false, true]) {
        it.each([
            ["ltr", 0],
            ["rtl", 0],
            ["ltr", 15],
            ["rtl", 15],
        ] as const)(
            `normalizes nonzero horizontal origins for %s owners (scrollbar=%s, window=${useWindowScroll})`,
            async (direction, scrollbarWidth) => {
                resetMocks();
                const platform = Platform.OS;
                const previousWindow = {
                    document: window.document,
                    innerWidth: window.innerWidth,
                    scrollX: window.scrollX,
                    scrollY: window.scrollY,
                };
                Platform.OS = "web";
                maxOffset = 500;
                mockCtx.state.props.horizontal = true;
                mockCtx.state.props.rtl = true;
                globalThis.getComputedStyle = (() => ({ direction })) as typeof getComputedStyle;
                const ref = { current: null as any };
                const previousScroller = mockCtx.state.refScroller;
                mockCtx.state.refScroller = ref;
                const onScroll = mock();
                const rtl = direction === "rtl";
                const origin = rtl ? -650 : 150;
                ownerScroll = rtl ? -150 : 150;
                const scrollTo = mock((options: ScrollToOptions) => {
                    ownerScroll = options.left ?? 0;
                    Object.assign(window, { scrollX: ownerScroll });
                });
                const owner = {
                    addEventListener,
                    clientLeft: 3,
                    clientTop: 0,
                    clientWidth: 500,
                    getBoundingClientRect: () => ({ left: 20, top: 0 }),
                    removeEventListener,
                    get scrollLeft() {
                        return ownerScroll;
                    },
                    scrollTo,
                } as unknown as HTMLElement;
                const list = {
                    addEventListener,
                    getBoundingClientRect: () => ({
                        left: origin - ownerScroll + (useWindowScroll ? 0 : 23),
                        top: 0,
                        width: 1000,
                    }),
                    removeEventListener,
                    scrollTo,
                };
                Object.assign(window, {
                    document: { documentElement: { clientWidth: 500 } },
                    innerWidth: 500 + scrollbarWidth,
                    scrollX: ownerScroll,
                    scrollY: 0,
                });
                const measure = spyOn(webScrollUtils, "getElementScrollPosition").mockImplementation(
                    measureElementScrollPosition,
                );
                const { ListComponentScrollView } = await import(
                    "../../src/components/ListComponentScrollView?external-nonzero-rtl-origin"
                );
                let renderer: TestRenderer.ReactTestRenderer | undefined;
                try {
                    act(() => {
                        renderer = TestRenderer.create(
                            <ListComponentScrollView
                                horizontal
                                onLayout={() => {}}
                                onScroll={onScroll}
                                ref={ref}
                                scrollElement={useWindowScroll ? undefined : owner}
                                style={{}}
                                useWindowScroll={useWindowScroll}
                            >
                                <div />
                            </ListComponentScrollView>,
                            { createNodeMock: () => list },
                        );
                    });
                    invalidateHorizontalRTLScrollType(mockCtx.state);
                    expect(ref.current.getRawScrollOffset()).toBe(0);
                    ref.current.scrollTo({ animated: false, x: rtl ? -200 : 200 });
                    expect(ownerScroll).toBe(rtl ? -350 : 350);
                    expect(ref.current.getRawScrollOffset()).toBe(rtl ? -200 : 200);
                    expect(ref.current.getCurrentScrollOffset()).toBe(rtl ? -200 : 200);
                    expect(ref.current.isScrollInRange()).toBe(true);
                    emitScroll();
                    expect(onScroll.mock.calls.at(-1)?.[0].nativeEvent.contentOffset.x).toBe(rtl ? -200 : 200);
                } finally {
                    act(() => renderer?.unmount());
                    measure.mockRestore();
                    Object.assign(window, previousWindow);
                    Platform.OS = platform;
                    mockCtx.state.refScroller = previousScroller;
                }
            },
        );
    }

    for (const useWindowScroll of [false, true]) {
        it.each(["ltr", "rtl"])(`handles %s owner offsets (window=${useWindowScroll})`, async (ownerDirection) => {
            resetMocks();
            const platform = Platform.OS;
            Platform.OS = "web";
            maxOffset = 1000;
            mockCtx.state.props.horizontal = true;
            mockCtx.state.props.rtl = true;
            globalThis.getComputedStyle = (() => ({ direction: ownerDirection })) as typeof getComputedStyle;
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?external-negative-rtl"
            );
            const ref = { current: null as any };
            const previousScroller = mockCtx.state.refScroller;
            mockCtx.state.refScroller = ref;
            const scrollTo = mock((options: ScrollToOptions) => {
                ownerScroll = options.left ?? 0;
            });
            const owner = { addEventListener, removeEventListener, scrollTo } as unknown as HTMLElement;
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView
                            horizontal
                            onLayout={() => {}}
                            ref={ref}
                            scrollElement={useWindowScroll ? undefined : owner}
                            style={{}}
                            useWindowScroll={useWindowScroll}
                        >
                            <div />
                        </ListComponentScrollView>,
                        { createNodeMock: () => ({ addEventListener, removeEventListener, scrollTo }) },
                    );
                });
                invalidateHorizontalRTLScrollType(mockCtx.state);
                ref.current.scrollTo({ animated: false, x: -350 });
                const rtlOwner = ownerDirection === "rtl";
                expect(scrollTo).toHaveBeenLastCalledWith({
                    behavior: "instant",
                    left: rtlOwner ? -350 : 0,
                    top: 0,
                });
                expect(ref.current.getCurrentScrollOffset()).toBe(rtlOwner ? -350 : 0);
                expect(ref.current.isScrollInRange()).toBe(true);
                ownerScroll = -350;
                expect(ref.current.isScrollInRange()).toBe(rtlOwner);
                ref.current.scrollTo({ animated: false, x: -1500 });
                expect(ref.current.getCurrentScrollOffset()).toBe(rtlOwner ? -1000 : 0);
            } finally {
                act(() => renderer?.unmount());
                Platform.OS = platform;
                mockCtx.state.refScroller = previousScroller;
            }
        });
    }

    for (const useWindowScroll of [false, true]) {
        for (const horizontal of [false, true]) {
            it(`preserves the real external viewport offset (window=${useWindowScroll}, horizontal=${horizontal})`, async () => {
                resetMocks();
                listPosition = 216;
                const { ListComponentScrollView } = await import(
                    "../../src/components/ListComponentScrollView?external-viewport-offset"
                );
                const ref = { current: null as any };
                const onScroll = mock();
                const onLayout = mock(() => {
                    expect(mockCtx.state.scroll).toBe(-216);
                });
                const owner = { addEventListener: mock(), removeEventListener: mock() } as unknown as HTMLElement;
                let renderer: TestRenderer.ReactTestRenderer | undefined;
                try {
                    act(() => {
                        renderer = TestRenderer.create(
                            <ListComponentScrollView
                                horizontal={horizontal}
                                onLayout={onLayout}
                                onScroll={onScroll}
                                ref={ref}
                                scrollElement={useWindowScroll ? undefined : owner}
                                style={{}}
                                useWindowScroll={useWindowScroll}
                            >
                                <div />
                            </ListComponentScrollView>,
                            { createNodeMock: () => ({ parentElement: null }) },
                        );
                    });
                    expect(onLayout).toHaveBeenCalled();
                    const axis = horizontal ? "x" : "y";
                    expect(onScroll.mock.calls.at(-1)?.[0].nativeEvent.contentOffset[axis]).toBe(-216);
                    expect(ref.current.getCurrentScrollOffset()).toBe(0);
                    listPosition = 835;
                    expect(ref.current.getRawScrollOffset()).toBe(-835);
                    expect(ref.current.getCurrentScrollOffset()).toBe(0);
                    listPosition = 216;
                    ownerScroll = 316;
                    act(() => emitScroll());
                    expect(onScroll.mock.calls.at(-1)?.[0].nativeEvent.contentOffset[axis]).toBe(100);
                } finally {
                    act(() => renderer?.unmount());
                }
            });
        }
    }

    it("interrupts end following only for a wheel gesture away from the end and cleans up the listener", async () => {
        resetMocks();
        const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-wheel-cancel"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} style={{}} useWindowScroll>
                        <div />
                    </ListComponentScrollView>,
                );
            });
            const wheel = scrollListeners.get("wheel");
            expect(wheel).toBeDefined();
            const preventDefault = mock(() => {});
            const event = {
                cancelable: true,
                ctrlKey: false,
                defaultPrevented: false,
                deltaX: 0,
                deltaY: -40,
                preventDefault,
            };
            wheel?.(event as unknown as WheelEvent);
            expect(interrupt).not.toHaveBeenCalled();
            maxOffset = 1000;
            ownerScroll = 800;
            mockCtx.state.maintainingScrollAtEnd = "pending-animated";
            wheel?.({ ...event, deltaY: 40 } as unknown as WheelEvent);
            wheel?.({ ...event, ctrlKey: true } as unknown as WheelEvent);
            wheel?.({ ...event, defaultPrevented: true } as unknown as WheelEvent);
            expect(interrupt).not.toHaveBeenCalled();
            wheel?.(event as unknown as WheelEvent);
            expect(interrupt).toHaveBeenCalledTimes(1);
            // The native scroll goes ahead unless the interrupt's stop write already applied the wheel.
            expect(preventDefault).not.toHaveBeenCalled();
            interrupt.mockImplementation(() => true);
            wheel?.({ ...event, timeStamp: 1000 } as unknown as WheelEvent);
            expect(interrupt).toHaveBeenCalledTimes(2);
            expect(preventDefault).toHaveBeenCalledTimes(1);
            interrupt.mockImplementation(() => false);
            scrollListeners.get("keydown")?.({ key: "ArrowUp", target: { closest: () => ({}) } } as any);
            expect(interrupt).toHaveBeenCalledTimes(2);
            ownerScroll = 0;
            wheel?.(event as unknown as WheelEvent);
            scrollListeners.get("touchstart")?.({ touches: [{ clientY: 0 }] } as any);
            scrollListeners.get("touchmove")?.({ touches: [{ clientY: 40 }] } as any);
            expect(interrupt).toHaveBeenCalledTimes(2);
        } finally {
            act(() => renderer?.unmount());
            interrupt.mockRestore();
        }
        expect(scrollListeners.has("wheel")).toBe(false);
    });

    it("keeps wheel registration stable across scrolls, restores passive after idle, and cleans up", async () => {
        resetMocks();
        jest.useFakeTimers();
        const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation((_ctx, delta) => !!delta);
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-wheel-stable"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        const wheelOptions = () =>
            addEventListener.mock.calls
                .filter(([type]) => type === "wheel")
                .map((call) => (call as unknown as [string, ScrollListener, AddEventListenerOptions])[2]);
        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} style={{}} useWindowScroll>
                        <div />
                    </ListComponentScrollView>,
                );
            });
            const wheel = scrollListeners.get("wheel");
            expect(wheelOptions()).toEqual([{ capture: true, passive: true }, { passive: true }]);
            maxOffset = 1000;
            ownerScroll = 800;
            const preventDefault = mock(() => {});
            set$(mockCtx, "isScrollActive", true);
            set$(mockCtx, "isScrollActive", false);
            jest.advanceTimersByTime(999);
            expect(wheelOptions()).toEqual([{ capture: true, passive: true }, { passive: true }, { passive: false }]);
            set$(mockCtx, "isScrollActive", true);
            jest.advanceTimersByTime(1000);
            expect(wheelOptions()).toEqual([{ capture: true, passive: true }, { passive: true }, { passive: false }]);
            for (let i = 0; i < 5; i++) {
                mockCtx.state.maintainingScrollAtEnd = "animated";
                set$(mockCtx, "isScrollActive", true);
                wheel?.({ cancelable: true, deltaY: -40, preventDefault, timeStamp: i * 2000 } as any);
                expect(interrupt).toHaveBeenLastCalledWith(mockCtx, -40);
                set$(mockCtx, "isScrollActive", false);
                jest.advanceTimersByTime(200);
            }
            expect(preventDefault).toHaveBeenCalledTimes(5);
            expect(wheelOptions()).toHaveLength(3);
            expect(removeEventListener.mock.calls.filter(([type]) => type === "wheel")).toHaveLength(1);
            jest.advanceTimersByTime(799);
            expect(wheelOptions()).toHaveLength(3);
            jest.advanceTimersByTime(1);
            expect(wheelOptions()).toEqual([
                { capture: true, passive: true },
                { passive: true },
                { passive: false },
                { passive: true },
            ]);
            expect(scrollListeners.get("wheel")).toBe(wheel!);
            set$(mockCtx, "isScrollActive", true);
            expect(wheelOptions().at(-1)).toEqual({ passive: false });
            set$(mockCtx, "isScrollActive", false);
        } finally {
            act(() => renderer?.unmount());
            jest.runAllTimers();
            jest.useRealTimers();
            interrupt.mockRestore();
        }
        expect(wheelOptions()).toHaveLength(5);
        expect(scrollListeners.has("wheel")).toBe(false);
        expect(mockCtx.listeners.get("isScrollActive")?.size ?? 0).toBe(0);
    });

    it("captures animation state without interrupting a wheel consumed by a descendant", async () => {
        resetMocks();
        maxOffset = 1000;
        ownerScroll = 800;
        const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => true);
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-wheel-descendant-owner"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} style={{}} useWindowScroll />,
                );
            });
            const capture = addEventListener.mock.calls.find(
                ([type, , options]: any) => type === "wheel" && options?.capture,
            )?.[1];
            const bubble = scrollListeners.get("wheel");
            const event = {
                cancelable: true,
                defaultPrevented: false,
                deltaY: -40,
                preventDefault: mock(() => {}),
                timeStamp: 1000,
            };
            mockCtx.state.scrollingTo = { animated: true, index: 50 };
            capture?.(event as any);
            expect(interrupt).not.toHaveBeenCalled();
            event.defaultPrevented = true;
            bubble?.(event as any);
            expect(interrupt).not.toHaveBeenCalled();

            const nextEvent = { ...event, defaultPrevented: false, timeStamp: 2000 };
            capture?.(nextEvent as any);
            set$(mockCtx, "isScrollActive", true);
            // A descendant application listener cancels the request before the list's bubble listener.
            mockCtx.state.scrollingTo = undefined;
            ownerScroll = 600;
            set$(mockCtx, "isScrollActive", false);
            expect(addEventListener.mock.calls.filter(([type]) => type === "wheel").at(-1)?.[2]).toEqual({
                passive: false,
            });
            mockCtx.state.pendingScrollResolve = undefined;
            bubble?.(nextEvent as any);
            expect(interrupt).toHaveBeenCalledWith(mockCtx, -40, 600);
            expect(event.preventDefault).toHaveBeenCalledTimes(1);
        } finally {
            act(() => renderer?.unmount());
            interrupt.mockRestore();
        }
    });

    it("leaves a non-cancelable wheel to native scrolling when it interrupts an animation", async () => {
        resetMocks();
        maxOffset = 1000;
        ownerScroll = 800;
        mockCtx.state.maintainingScrollAtEnd = "animated";
        const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation((_ctx, delta) => !!delta);
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-wheel-cancelable"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} style={{}} useWindowScroll>
                        <div />
                    </ListComponentScrollView>,
                );
            });
            const preventDefault = mock(() => {});
            // A wheel routed while the listener was passive may already have moved natively.
            // Its stop write must not apply that delta a second time.
            scrollListeners.get("wheel")?.({ cancelable: false, deltaY: -40, preventDefault, timeStamp: 0 } as any);
            expect(interrupt).toHaveBeenLastCalledWith(mockCtx, 0);
            expect(preventDefault).not.toHaveBeenCalled();
            scrollListeners.get("wheel")?.({ cancelable: true, deltaY: -40, preventDefault, timeStamp: 1000 } as any);
            expect(interrupt).toHaveBeenLastCalledWith(mockCtx, -40);
            expect(preventDefault).toHaveBeenCalledTimes(1);
        } finally {
            act(() => renderer?.unmount());
            interrupt.mockRestore();
        }
    });

    it("leaves navigation keys in contenteditable editors without an explicit true attribute", async () => {
        resetMocks();
        maxOffset = 1000;
        ownerScroll = 800;
        mockCtx.state.scrollingTo = { animated: true, index: 50 };
        mockCtx.state.pendingScrollResolve = mock(() => {});
        const onUserScroll = mock(() => {});
        mockCtx.state.props.onUserScroll = onUserScroll;
        const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?editable-input-owner"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} style={{}} useWindowScroll />,
                );
            });
            const target = {
                // Empty, plaintext-only, and inherited editing all set this DOM property.
                closest: () => null,
                isContentEditable: true,
            };
            for (const key of ["ArrowUp", "PageDown", "Home", "End"]) {
                scrollListeners.get("keydown")?.({ key, target } as any);
            }
            expect(interrupt).not.toHaveBeenCalled();
            expect(onUserScroll).not.toHaveBeenCalled();
        } finally {
            act(() => renderer?.unmount());
            interrupt.mockRestore();
        }
    });

    for (const horizontal of [false, true]) {
        it(`filters input before interrupting an active ${horizontal ? "horizontal" : "vertical"} request on an external owner`, async () => {
            resetMocks();
            maxOffset = 1000;
            ownerScroll = 800;
            mockCtx.state.scrollingTo = { animated: true, index: 50 };
            mockCtx.state.pendingScrollResolve = mock(() => {});
            const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?web-active-input-filters"
            );
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView horizontal={horizontal} onLayout={() => {}} style={{}} useWindowScroll>
                            <div />
                        </ListComponentScrollView>,
                    );
                });
                const send = (type: string, event: Record<string, unknown>) =>
                    scrollListeners.get(type)?.(event as any);
                const delta = horizontal ? { deltaX: 40, deltaY: 0 } : { deltaX: 0, deltaY: 40 };
                send("wheel", { ...delta, defaultPrevented: true });
                send("wheel", { ...delta, ctrlKey: true });
                send("wheel", horizontal ? { deltaX: 0, deltaY: 40 } : { deltaX: 40, deltaY: 0 });
                send("keydown", { defaultPrevented: true, key: "PageDown" });
                send("keydown", { key: "a" });
                send("keydown", { key: horizontal ? "ArrowDown" : "ArrowRight" });
                send("keydown", {
                    key: " ",
                    target: { closest: (selector: string) => (selector.includes("button") ? {} : null) },
                });
                const touch = { touches: [{ clientX: 40, clientY: 40 }] };
                send("touchstart", { ...touch, defaultPrevented: true });
                // Other controls and nested scroll owners share the external event target.
                ownsInput = false;
                send("wheel", delta);
                send("keydown", { key: "PageDown" });
                send("touchstart", touch);
                expect(interrupt).not.toHaveBeenCalled();

                ownsInput = true;
                send("wheel", delta);
                send("keydown", { key: horizontal ? "ArrowLeft" : "ArrowDown" });
                send("touchstart", touch);
                expect(interrupt).toHaveBeenCalledTimes(3);
            } finally {
                act(() => renderer?.unmount());
                interrupt.mockRestore();
            }
        });
    }

    it("interrupts end following for upward keys and scrollbar presses while the list is in range", async () => {
        resetMocks();
        mockCtx.state.maintainingScrollAtEnd = true;
        maxOffset = 1000;
        ownerScroll = 800;
        const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-key-pointer-interrupts"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} style={{}} useWindowScroll>
                        <div />
                    </ListComponentScrollView>,
                );
            });
            const press = (key: string, shiftKey = false) =>
                scrollListeners.get("keydown")?.({ key, shiftKey, target: { closest: () => null } } as any);
            const pointer = (clientX: number, target: unknown = scrollableNode) =>
                scrollListeners.get("pointerdown")?.({ clientX, clientY: 0, target } as any);

            for (const key of ["ArrowDown", "PageDown", "End", " "]) press(key);
            pointer(100);
            pointer(200, {});
            expect(interrupt).not.toHaveBeenCalled();

            press("ArrowUp");
            press("PageUp");
            press("Home");
            press(" ", true);
            pointer(200);
            expect(interrupt).toHaveBeenCalledTimes(5);

            mockCtx.state.endFollowInterrupted = true;
            mockCtx.state.scrollingTo = { animated: true, index: 5 };
            press("PageDown");
            expect(interrupt).toHaveBeenCalledTimes(6);

            ownerScroll = 1200;
            press("ArrowUp");
            pointer(200);
            expect(interrupt).toHaveBeenCalledTimes(6);
        } finally {
            act(() => renderer?.unmount());
            interrupt.mockRestore();
        }
    });

    for (const queued of [false, true]) {
        for (const gesture of ["wheel", "touch"] as const) {
            it(`interrupts a ${queued ? "queued" : "active"} history target on downward ${gesture} navigation`, async () => {
                resetMocks();
                maxOffset = 1000;
                ownerScroll = 800;
                mockCtx.state.endFollowInterrupted = true;
                if (queued) mockCtx.state.pendingScrollResolve = mock(() => {});
                else mockCtx.state.scrollingTo = { animated: true, index: 5 };
                const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
                const { ListComponentScrollView } = await import(
                    "../../src/components/ListComponentScrollView?web-explicit-downward-input"
                );
                let renderer: TestRenderer.ReactTestRenderer | undefined;
                try {
                    act(() => {
                        renderer = TestRenderer.create(
                            <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}}>
                                <div />
                            </ListComponentScrollView>,
                        );
                    });
                    let timeStamp = 0;
                    const navigate = () => {
                        if (gesture === "wheel") {
                            scrollListeners.get("wheel")?.({ cancelable: true, deltaY: 40, timeStamp } as WheelEvent);
                        } else {
                            scrollListeners.get("touchstart")?.({ touches: [{ clientY: 40 }] } as any);
                        }
                    };
                    ownsInput = false;
                    navigate();
                    expect(interrupt).not.toHaveBeenCalled();
                    ownsInput = true;
                    maxOffset = 0;
                    navigate();
                    expect(interrupt).not.toHaveBeenCalled();
                    maxOffset = 1000;
                    ownerScroll = 0;
                    timeStamp = 101;
                    navigate();
                    expect(interrupt).toHaveBeenCalledTimes(1);
                    expect(interrupt).toHaveBeenCalledWith(mockCtx, gesture === "wheel" ? 40 : 0);
                    ownerScroll = 800;
                    navigate();
                    expect(interrupt).toHaveBeenCalledTimes(gesture === "wheel" ? 1 : 2);
                } finally {
                    act(() => renderer?.unmount());
                    interrupt.mockRestore();
                }
            });
        }
    }

    it("preserves automatic end following with a pending promise on input toward the end", async () => {
        resetMocks();
        maxOffset = 1000;
        ownerScroll = 800;
        mockCtx.state.scrollingTo = { animated: true, isScrollToEnd: true };
        mockCtx.state.pendingScrollResolve = mock(() => {});
        mockCtx.state.maintainingScrollAtEnd = "animated";
        const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-end-downward-touch"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll>
                        <div />
                    </ListComponentScrollView>,
                );
            });
            scrollListeners.get("wheel")?.({ deltaY: 40 } as any);
            scrollListeners.get("keydown")?.({ key: "PageDown", target: { closest: () => null } } as any);
            scrollListeners.get("touchstart")?.({ touches: [{ clientY: 40 }] } as any);
            scrollListeners.get("touchmove")?.({ touches: [{ clientY: 0 }] } as any);
            expect(interrupt).not.toHaveBeenCalled();
            // The same end target is explicit when it is not owned by automatic maintenance.
            mockCtx.state.maintainingScrollAtEnd = undefined;
            scrollListeners.get("wheel")?.({ deltaY: -40 } as any);
            expect(interrupt).toHaveBeenCalledTimes(1);
            mockCtx.state.maintainingScrollAtEnd = "animated";
            scrollListeners.get("wheel")?.({ deltaY: -30 } as any);
            expect(interrupt).toHaveBeenCalledTimes(2);
        } finally {
            act(() => renderer?.unmount());
            interrupt.mockRestore();
        }
    });

    it("keeps RAF coalescing during steady-state user scrolling", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-coalesce"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}}>
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
            const listener = scrollListeners.get("scroll");
            expect(listener).toBeDefined();

            act(() => {
                listener?.({} as Event);
            });

            expect(schedule).toHaveBeenCalledTimes(1);
            expect(flush).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("reports native scrollend as the web gesture boundary", async () => {
        resetMocks();
        supportsScrollEnd = true;
        const onInternalScrollEnd = mock(() => {});
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-native-scroll-end"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        onInternalScrollEnd={onInternalScrollEnd}
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(addEventListener).toHaveBeenCalledWith("scrollend", expect.any(Function));
            act(() => {
                scrollListeners.get("scrollend")?.({} as Event);
            });
            expect(flush).toHaveBeenCalledTimes(1);
            expect(onInternalScrollEnd).toHaveBeenCalledTimes(1);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("falls back to 200ms scroll inactivity when scrollend is unavailable", async () => {
        resetMocks();
        const onInternalScrollEnd = mock(() => {});
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-fallback-scroll-end"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        onInternalScrollEnd={onInternalScrollEnd}
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            act(() => {
                scrollListeners.get("scroll")?.({} as Event);
            });
            await new Promise((resolve) => setTimeout(resolve, 220));
            expect(onInternalScrollEnd).toHaveBeenCalledTimes(1);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    for (const finish of ["native", "unmount", "inactivity"] as const) {
        it(`cleans up the pending scroll-end fallback after ${finish}`, async () => {
            resetMocks();
            supportsScrollEnd = finish === "native";
            const boundaries: string[] = [];
            const onInternalScrollEnd = mock(() => boundaries.push("end"));
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?web-scroll-end-cleanup"
            );
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView
                            onInternalScrollEnd={onInternalScrollEnd}
                            onLayout={() => {}}
                            onScroll={() => {}}
                            style={{}}
                        >
                            <div />
                        </ListComponentScrollView>,
                    );
                });
                act(() => {
                    // A burst of scroll events should schedule only one boundary.
                    scrollListeners.get("scroll")?.({} as Event);
                    scrollListeners.get("scroll")?.({} as Event);
                    scrollListeners.get("scroll")?.({} as Event);
                });
                expect(onInternalScrollEnd).not.toHaveBeenCalled();
                if (finish === "native") {
                    act(() => scrollListeners.get("scrollend")?.({} as Event));
                    expect(onInternalScrollEnd).toHaveBeenCalledTimes(1);
                } else if (finish === "unmount") {
                    act(() => renderer?.unmount());
                    renderer = undefined;
                    expect(scrollListeners.has("scroll")).toBe(false);
                }
                await act(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 230));
                });
                expect(boundaries).toEqual(finish === "unmount" ? [] : ["end"]);
                expect(flush).toHaveBeenCalledTimes(finish === "unmount" ? 0 : 1);
            } finally {
                act(() => renderer?.unmount());
            }
        });
    }

    it("flushes immediately for any active programmatic scroll target", async () => {
        resetMocks();
        mockCtx.state.scrollingTo = { animated: true };
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-flush"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}}>
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const listener = scrollListeners.get("scroll");
            expect(listener).toBeDefined();

            act(() => {
                listener?.({} as Event);
            });

            expect(flush).toHaveBeenCalledTimes(1);
            expect(schedule).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("flushes immediately while initial scroll is still pending", async () => {
        resetMocks();
        mockCtx.state.didFinishInitialScroll = false;
        mockCtx.state.initialScroll = {};
        mockCtx.state.initialScrollSession = { kind: "bootstrap" };
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-initial-scroll"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}}>
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const listener = scrollListeners.get("scroll");
            expect(listener).toBeDefined();

            act(() => {
                listener?.({} as Event);
            });

            expect(flush).toHaveBeenCalledTimes(1);
            expect(schedule).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    for (const hasActiveTarget of [false, true]) {
        it(`keeps an initial-placement DOM clamp owned while real input can interrupt (${hasActiveTarget})`, async () => {
            resetMocks();
            mockCtx.state.didFinishInitialScroll = false;
            mockCtx.state.initialScroll = { index: 2, preserveForBottomPadding: true, viewPosition: 1 };
            mockCtx.state.initialScrollSession = { kind: "bootstrap" };
            mockCtx.state.scroll = 800;
            mockCtx.state.pendingMaintainScrollAtEnd = true;
            mockCtx.state.scrollingTo = hasActiveTarget ? { isInitialScroll: true } : undefined;
            ownerScroll = 778;
            maxOffset = 1000;
            const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
            const { ListComponentScrollView } = await import(
                "../../src/components/ListComponentScrollView?web-scroll-owned-initial-clamp"
            );
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            try {
                act(() => {
                    renderer = TestRenderer.create(
                        <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll>
                            <div />
                        </ListComponentScrollView>,
                    );
                });
                scrollListeners.get("scroll")?.({} as Event);
                expect(interrupt).not.toHaveBeenCalled();
                expect(flush).toHaveBeenCalledTimes(1);
                scrollListeners.get("wheel")?.({ ctrlKey: false, defaultPrevented: false, deltaY: -40 } as WheelEvent);
                expect(interrupt).toHaveBeenCalledTimes(1);
                mockCtx.state.didFinishInitialScroll = true;
                mockCtx.state.scrollingTo = undefined;
                scrollListeners.get("scroll")?.({} as Event);
                expect(interrupt).toHaveBeenCalledTimes(2);
            } finally {
                act(() => renderer?.unmount());
                interrupt.mockRestore();
            }
        });
    }

    it("flushes immediately while MVCP is active", async () => {
        resetMocks();
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-mvcp"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}}>
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const listener = scrollListeners.get("scroll");
            expect(listener).toBeDefined();

            act(() => {
                listener?.({} as Event);
            });

            expect(flush).toHaveBeenCalledTimes(1);
            expect(schedule).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("applies contentContainerClassName to the inner content div", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-content-container-class"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerClassName="p-4"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs).toHaveLength(3);
            expect(divs[0]?.props.className).toBeUndefined();
            expect(divs[1]?.props.className).toBe("legend-list-content-container p-4");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("disables browser scroll anchoring while MVCP is enabled", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-disable-browser-anchor"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.style.overflowAnchor).toBe("none");
            expect(divs[1]?.props.style.overflowAnchor).toBe("none");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("warns once when className props include gap utilities", async () => {
        resetMocks();
        const warnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = warnSpy as typeof console.warn;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-content-container-gap-warning"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerClassName="p-4 md:gap-x-4 gap-y-[18px]"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            act(() => {
                renderer!.update(
                    <ListComponentScrollView
                        className="scroll-shell gap-4"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy).toHaveBeenCalledWith(
                "[legend-list] className/contentContainerClassName gap classes are not supported in LegendList because it needs to use exact values internally. Use contentContainerStyle={{ gap: ... }} or columnWrapperStyle instead.",
            );
        } finally {
            console.warn = originalWarn;
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not warn for contentContainerClassName without gap utilities", async () => {
        resetMocks();
        const warnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = warnSpy as typeof console.warn;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-content-container-no-gap-warning"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerClassName="p-4 gapless data-[state=open]:bg-blue-500"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(warnSpy).not.toHaveBeenCalled();
        } finally {
            console.warn = originalWarn;
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not forward React Native-only scroll view props to the DOM element", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-native-only-props"
        );
        const nativeOnlyProps = {
            alwaysBounceVertical: false,
            automaticallyAdjustsScrollIndicatorInsets: false,
            contentInsetAdjustmentBehavior: "never",
            keyboardDismissMode: "on-drag",
            keyboardShouldPersistTaps: "handled",
            nestedScrollEnabled: true,
            onContentSizeChange: () => {},
            overScrollMode: "never",
        };
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        aria-label="feed"
                        data-testid="list"
                        id="list-id"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                        {...(nativeOnlyProps as object)}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const scrollProps = renderer!.root.findAllByType("div")[0]!.props;
            for (const name of Object.keys(nativeOnlyProps)) {
                expect(scrollProps).not.toHaveProperty(name);
            }
            expect(scrollProps["aria-label"]).toBe("feed");
            expect(scrollProps["data-testid"]).toBe("list");
            expect(scrollProps.id).toBe("list-id");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("adds the hidden scrollbar class for vertical lists without changing overflow behavior", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-hidden-vertical"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        className="outer-scroll"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.className).toBe("outer-scroll legend-list-scrollbar-y-hidden");
            expect(divs[0]?.props.style.overflowX).toBe("hidden");
            expect(divs[0]?.props.style.overflowY).toBe("auto");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("adds the hidden scrollbar class for horizontal lists without changing overflow behavior", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-hidden-horizontal"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        horizontal
                        onLayout={() => {}}
                        onScroll={() => {}}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.className).toBe("legend-list-scrollbar-x-hidden");
            expect(divs[0]?.props.style.overflowX).toBe("auto");
            expect(divs[0]?.props.style.overflowY).toBe("hidden");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("renders complete horizontal CSS snap anchors from snap offsets", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import("../../src/components/ListComponentScrollView?web-snap-x");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        horizontal
                        onLayout={() => {}}
                        onScroll={() => {}}
                        snapToOffsets={[0, 296, 592]}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.style.scrollSnapType).toBe("x mandatory");
            expect(divs[2]?.props["data-legend-list-snap-anchor"]).toBe(0);
            expect(divs[2]?.props.style).toEqual({
                height: "100%",
                left: 0,
                pointerEvents: "none",
                position: "absolute",
                scrollSnapAlign: "start",
                top: 0,
                width: 1,
            });
            expect(divs[3]?.props["data-legend-list-snap-anchor"]).toBe(296);
            expect(divs[3]?.props.style.left).toBe(296);
            expect(divs[4]?.props["data-legend-list-snap-anchor"]).toBe(592);
            expect(divs[4]?.props.style.left).toBe(592);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("renders sparse CSS snap anchors for targets outside the rendered viewport", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-sparse-snap-x"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        horizontal
                        onLayout={() => {}}
                        onScroll={() => {}}
                        snapToOffsets={[0, 3552, 7104, 10656]}
                        style={{ width: 696 }}
                    >
                        <div>Panel 1</div>
                        <div>Panel 2</div>
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            const snapAnchors = divs.filter((div) => div.props["data-legend-list-snap-anchor"] !== undefined);
            const renderedText = divs.flatMap((div) => div.children).filter((child) => typeof child === "string");

            expect(divs[0]?.props.style.scrollSnapType).toBe("x mandatory");
            expect(snapAnchors.map((div) => div.props["data-legend-list-snap-anchor"])).toEqual([0, 3552, 7104, 10656]);
            expect(snapAnchors.at(1)?.props.style.left).toBe(3552);
            expect(snapAnchors.at(2)?.props.style.left).toBe(7104);
            expect(snapAnchors.at(3)?.props.style.left).toBe(10656);
            expect(renderedText).toEqual(["Panel 1", "Panel 2"]);
            expect(renderedText).not.toContain("Panel 13");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("renders complete vertical CSS snap anchors from snap offsets", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import("../../src/components/ListComponentScrollView?web-snap-y");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        onLayout={() => {}}
                        onScroll={() => {}}
                        snapToOffsets={[0, 120, Number.POSITIVE_INFINITY, Number.NaN, 240]}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.style.scrollSnapType).toBe("y mandatory");
            expect(divs[2]?.props["data-legend-list-snap-anchor"]).toBe(0);
            expect(divs[2]?.props.style).toEqual({
                height: 1,
                left: 0,
                pointerEvents: "none",
                position: "absolute",
                scrollSnapAlign: "start",
                top: 0,
                width: "100%",
            });
            expect(divs[3]?.props["data-legend-list-snap-anchor"]).toBe(120);
            expect(divs[3]?.props.style.top).toBe(120);
            expect(divs[4]?.props["data-legend-list-snap-anchor"]).toBe(240);
            expect(divs[4]?.props.style.top).toBe(240);
            expect(divs).toHaveLength(6);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not add the hidden scrollbar class for window scrolling", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-hidden-window-scroll"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        className="outer-scroll"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        showsVerticalScrollIndicator={false}
                        style={{}}
                        useWindowScroll
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.className).toBe("outer-scroll");
            expect(divs[0]?.props.style.overflow).toBeUndefined();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not render CSS snap anchors for window scrolling", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-snap-window"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        onLayout={() => {}}
                        onScroll={() => {}}
                        snapToOffsets={[0, 120, 240]}
                        style={{}}
                        useWindowScroll
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.style.scrollSnapType).toBeUndefined();
            expect(divs.some((div) => div.props["data-legend-list-snap-anchor"] !== undefined)).toBe(false);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("injects scrollbar hiding CSS when hiding the default scroll indicator", async () => {
        resetMocks();
        const originalDocument = globalThis.document;
        const styleElement = { id: "", textContent: "" };
        const appendChild = mock(() => {});

        globalThis.document = {
            createElement: mock(() => styleElement),
            getElementById: mock(() => null),
            head: {
                appendChild,
            },
        } as unknown as Document;

        const { ListComponentScrollView } = await import("../../src/components/ListComponentScrollView?web-scroll-css");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        onLayout={() => {}}
                        onScroll={() => {}}
                        showsVerticalScrollIndicator={false}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(appendChild).toHaveBeenCalledWith(styleElement);
            expect(styleElement.id).toBe("legend-list-scrollbar-axis-hidden-style");
            expect(styleElement.textContent).toContain(
                ".legend-list-scrollbar-y-hidden::-webkit-scrollbar:vertical{width:0;display:none;}",
            );
            expect(styleElement.textContent).toContain(
                ".legend-list-scrollbar-x-hidden::-webkit-scrollbar:horizontal{height:0;display:none;}",
            );
        } finally {
            act(() => {
                renderer?.unmount();
            });
            globalThis.document = originalDocument;
        }
    });

    it("renders vertical contentInsetEndAdjustment as trailing content", async () => {
        resetMocks();
        mockCtx.state.props.contentInsetEndAdjustment = 32;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-overlay-inset-vertical"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerStyle={{ padding: "8px 16px" }}
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[1]?.props.style.padding).toBe("8px 16px");
            expect(divs[3]?.props["aria-hidden"]).toBe(true);
            expect(divs[3]?.props.style).toEqual({ height: 32 });
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("renders horizontal contentInsetEndAdjustment as trailing content", async () => {
        resetMocks();
        mockCtx.state.props.contentInsetEndAdjustment = 24;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-overlay-inset-horizontal"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerStyle={{ paddingRight: 6 }}
                        horizontal
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[1]?.props.style.paddingRight).toBe(6);
            expect(divs[3]?.props["aria-hidden"]).toBe(true);
            expect(divs[3]?.props.style).toEqual({ flexShrink: 0, width: 24 });
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not double count anchored end space that already renders into the DOM", async () => {
        resetMocks();
        mockCtx.state.anchoredEndSpaceSize = 24;
        mockCtx.state.props.anchoredEndSpace = { anchorIndex: 0 };
        mockCtx.state.props.contentInsetEndAdjustment = 40;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-overlay-inset-anchored"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerStyle={{ paddingBottom: 8 }}
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[1]?.props.style.paddingBottom).toBe(8);
            expect(divs[3]?.props["aria-hidden"]).toBe(true);
            expect(divs[3]?.props.style).toEqual({ height: 16 });
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });
});

it("moves listeners to a replacement external owner and detaches while the owner is null", async () => {
    registerWebScrollMocks();
    resetMocks();
    const { ListComponentScrollView } = await import(
        "../../src/components/ListComponentScrollView?external-owner-lifecycle"
    );
    const first = { addEventListener: mock(), removeEventListener: mock() } as unknown as HTMLElement;
    const second = { addEventListener: mock(), removeEventListener: mock() } as unknown as HTMLElement;
    const render = (scrollElement: HTMLElement | null) => (
        <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} scrollElement={scrollElement} style={{}}>
            <div />
        </ListComponentScrollView>
    );
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(render(null));
    });
    expect(addEventListener).not.toHaveBeenCalled();
    act(() => renderer!.update(render(first)));
    expect(first.addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
    act(() => renderer!.update(render(second)));
    expect(first.removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(second.addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
    act(() => renderer!.update(render(null)));
    expect(second.removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(addEventListener).not.toHaveBeenCalled();
    act(() => renderer!.unmount());
});

it("emits once for accepted wheel, touch, key and scrollbar gestures in either direction", async () => {
    registerWebScrollMocks();
    resetMocks();
    maxOffset = 1000;
    ownerScroll = 500;
    const onUserScroll = mock(() => {});
    mockCtx.state.props.onUserScroll = onUserScroll;
    const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
    const { ListComponentScrollView } = await import(
        "../../src/components/ListComponentScrollView?user-gesture-contract"
    );
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll>
                <div />
            </ListComponentScrollView>,
        );
    });
    const send = (name: string, event: object) => scrollListeners.get(name)?.(event as Event);
    try {
        send("wheel", { deltaY: 40 });
        send("wheel", { deltaY: 30 });
        send("wheel", { deltaY: 22 });
        expect(onUserScroll).toHaveBeenCalledTimes(1);
        send("wheel", { deltaY: -16 });
        expect(onUserScroll).toHaveBeenCalledTimes(2);
        send("wheel", { deltaY: -10, momentum: true });
        expect(onUserScroll).toHaveBeenCalledTimes(2);
        send("keydown", { key: "ArrowDown" });
        send("keydown", { key: "ArrowDown", repeat: true });
        expect(onUserScroll).toHaveBeenCalledTimes(3);
        send("touchstart", { touches: [{ clientY: 50 }] });
        expect(onUserScroll).toHaveBeenCalledTimes(3);
        send("touchmove", { touches: [{ clientY: 40 }] });
        send("touchmove", { touches: [{ clientY: 30 }] });
        expect(onUserScroll).toHaveBeenCalledTimes(4);
        send("pointerdown", { clientX: 201, clientY: 0, target: scrollableNode });
        expect(onUserScroll).toHaveBeenCalledTimes(5);
    } finally {
        act(() => renderer!.unmount());
        interrupt.mockRestore();
    }
});

it("protects explicit navigation from an existing wheel stream, but accepts a fresh gesture", async () => {
    registerWebScrollMocks();
    resetMocks();
    maxOffset = 1000;
    ownerScroll = 500;
    const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
    const { ListComponentScrollView } = await import(
        "../../src/components/ListComponentScrollView?wheel-stream-command"
    );
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll>
                <div />
            </ListComponentScrollView>,
        );
    });
    try {
        const wheel = (deltaY: number, momentum?: boolean) =>
            scrollListeners.get("wheel")?.({ deltaY, momentum } as any);
        wheel(40);
        wheel(30);
        mockCtx.state.scrollingTo = { animated: true, offset: 900 };
        mockCtx.state.pendingScrollResolve = () => {};
        wheel(22);
        wheel(16);
        wheel(11, true);
        expect(interrupt).not.toHaveBeenCalled();
        wheel(20, false);
        expect(interrupt).toHaveBeenCalledTimes(1);
    } finally {
        act(() => renderer!.unmount());
        interrupt.mockRestore();
    }
});

it("remembers wheel gestures at the end boundary before an app command", async () => {
    registerWebScrollMocks();
    resetMocks();
    maxOffset = 1000;
    ownerScroll = 1000;
    const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
    const { ListComponentScrollView } = await import("../../src/components/ListComponentScrollView?wheel-end-boundary");
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <ListComponentScrollView onLayout={() => {}} style={{}} useWindowScroll>
                <div />
            </ListComponentScrollView>,
        );
    });
    try {
        scrollListeners.get("wheel")?.({ deltaY: 40 } as any);
        mockCtx.state.scrollingTo = { animated: true, offset: 100 };
        scrollListeners.get("wheel")?.({ deltaY: 30 } as any);
        expect(interrupt).not.toHaveBeenCalled();
    } finally {
        act(() => renderer!.unmount());
        interrupt.mockRestore();
    }
});

it("ignores block-axis scroll keys in a horizontal list", async () => {
    registerWebScrollMocks();
    resetMocks();
    maxOffset = 1000;
    ownerScroll = 500;
    mockCtx.state.props.horizontal = true;
    const onUserScroll = mock(() => {});
    mockCtx.state.props.onUserScroll = onUserScroll;
    const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
    const { ListComponentScrollView } = await import("../../src/components/ListComponentScrollView?horizontal-keys");
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <ListComponentScrollView horizontal onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll>
                <div />
            </ListComponentScrollView>,
        );
    });
    const press = (key: string, shiftKey = false) => scrollListeners.get("keydown")?.({ key, shiftKey } as any);
    try {
        for (const name of ["PageUp", "PageDown", "Home", "End", " ", "ArrowUp", "ArrowDown"]) press(name);
        press(" ", true);
        scrollListeners.get("keydown")?.({ altKey: true, key: "ArrowLeft" } as any);
        scrollListeners.get("keydown")?.({ key: "ArrowLeft", metaKey: true } as any);
        expect(onUserScroll).not.toHaveBeenCalled();
        press("ArrowRight");
        press("ArrowLeft");
        expect(onUserScroll).toHaveBeenCalledTimes(2);
    } finally {
        act(() => renderer!.unmount());
        interrupt.mockRestore();
    }
});

it("does not report list-owned scroll events as user scrolls", async () => {
    registerWebScrollMocks();
    resetMocks();
    maxOffset = 1000;
    const onUserScroll = mock(() => {});
    mockCtx.state.props.onUserScroll = onUserScroll;
    const interrupt = spyOn(cancellationModule, "interruptUserScroll").mockImplementation(() => false);
    const { ListComponentScrollView } = await import("../../src/components/ListComponentScrollView?owned-scrolls");
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll>
                <div />
            </ListComponentScrollView>,
        );
    });
    const scrollFrom500 = (to: number, owner: Record<string, unknown>) => {
        mockCtx.state.scrollingTo = undefined;
        mockCtx.state.maintainingScrollAtEnd = { animated: false };
        mockCtx.state.didFinishInitialScroll = true;
        mockCtx.state.initialScroll = undefined;
        Object.assign(mockCtx.state, owner);
        mockCtx.state.scroll = 500;
        ownerScroll = to;
        scrollListeners.get("scroll")?.({} as Event);
    };
    try {
        // Owned scrolls move away from the last processed offset in either direction.
        scrollFrom500(100, { scrollingTo: { animated: true, offset: 100 } });
        scrollFrom500(100, { didFinishInitialScroll: false, initialScroll: { index: 5 } });
        scrollFrom500(1000, {});
        // Without end following, moving back is ordinary scrolling with nothing to release.
        scrollFrom500(100, { maintainingScrollAtEnd: undefined });
        expect(interrupt).not.toHaveBeenCalled();
        expect(onUserScroll).not.toHaveBeenCalled();
        // Moving back from the end while only end following owns the scroll is user input.
        scrollFrom500(100, {});
        expect(interrupt).toHaveBeenCalledTimes(1);
    } finally {
        act(() => renderer!.unmount());
        interrupt.mockRestore();
    }
});

it("distinguishes owned scrolls and overlay presses from accepted wheel input", async () => {
    registerWebScrollMocks();
    resetMocks();
    maxOffset = 1000;
    const callback = mock(() => {});
    mockCtx.state.props.onUserScroll = callback;
    const { ListComponentScrollView } = await import(
        "../../src/components/ListComponentScrollView?owned-input-callback"
    );
    let renderer: ReturnType<typeof TestRenderer.create>;
    act(() => {
        renderer = TestRenderer.create(
            <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll />,
        );
    });
    const previousOffsetWidth = scrollableNode.offsetWidth;
    try {
        mockCtx.state.scrollingTo = { animated: true, offset: 100 };
        ownerScroll = 100;
        scrollListeners.get("scroll")?.({} as Event);
        expect(callback).not.toHaveBeenCalled();
        mockCtx.state.scrollingTo = undefined;
        scrollableNode.offsetWidth = scrollableNode.clientWidth;
        scrollListeners.get("pointerdown")?.({ clientX: 200, clientY: 50, target: scrollableNode } as any);
        expect(callback).not.toHaveBeenCalled();
        scrollListeners.get("wheel")?.({ deltaX: 0, deltaY: 20, target: scrollableNode } as any);
        expect(callback).toHaveBeenCalledTimes(1);
    } finally {
        scrollableNode.offsetWidth = previousOffsetWidth;
        act(() => renderer!.unmount());
    }
});

it("registers passive touch listeners and removes every input listener", async () => {
    registerWebScrollMocks();
    resetMocks();
    const { ListComponentScrollView } = await import(
        "../../src/components/ListComponentScrollView?input-listener-options"
    );
    let renderer: ReturnType<typeof TestRenderer.create>;
    act(() => {
        renderer = TestRenderer.create(
            <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} useWindowScroll>
                <div />
            </ListComponentScrollView>,
        );
    });
    for (const event of ["touchstart", "touchmove"]) {
        expect(addEventListener).toHaveBeenCalledWith(event, expect.any(Function), { passive: true });
    }
    for (const event of ["keydown", "pointerdown", "pointerup", "pointercancel"]) {
        expect(addEventListener.mock.calls.some(([type]) => type === event)).toBe(true);
        expect(addEventListener.mock.calls.find(([type]) => type === event)?.[2]).not.toEqual({ passive: true });
    }
    const registered = [...scrollListeners.entries()];
    act(() => renderer!.unmount());
    for (const [event, listener] of registered) {
        expect(removeEventListener).toHaveBeenCalledWith(event, listener);
    }
    const capture = addEventListener.mock.calls.find(
        ([type, , options]: any) => type === "wheel" && options?.capture,
    )?.[1];
    expect(removeEventListener).toHaveBeenCalledWith("wheel", capture, true);
});
