import { onScroll } from "../../src/core/onScroll";
import { getContentSize } from "../../src/state/getContentSize";
import type { StateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";

type Listener = (...args: any[]) => void;

/** Deterministic timers and frames: each 16ms tick runs frames first, then due timers. */
export function installFakeClock() {
    const originals = {
        cancelAnimationFrame: globalThis.cancelAnimationFrame,
        clearTimeout: globalThis.clearTimeout,
        requestAnimationFrame: globalThis.requestAnimationFrame,
        setTimeout: globalThis.setTimeout,
    };
    let now = 0;
    let nextId = 1;
    const timers = new Map<number, { at: number; callback: () => void }>();
    const frames = new Map<number, FrameRequestCallback>();

    globalThis.setTimeout = ((callback: () => void, delay = 0) => {
        const id = nextId++;
        timers.set(id, { at: now + delay, callback });
        return id;
    }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = ((id: number) => {
        timers.delete(id);
    }) as typeof clearTimeout;
    globalThis.requestAnimationFrame = (callback) => {
        const id = nextId++;
        frames.set(id, callback);
        return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
        frames.delete(id);
    };

    const runDueTimers = () => {
        for (;;) {
            let dueId: number | undefined;
            let dueAt = Number.POSITIVE_INFINITY;
            for (const [id, candidate] of timers) {
                if (candidate.at <= now && candidate.at < dueAt) {
                    dueId = id;
                    dueAt = candidate.at;
                }
            }
            if (dueId === undefined) {
                return;
            }
            const timer = timers.get(dueId)!;
            timers.delete(dueId);
            timer.callback();
        }
    };

    const tick = (ms = 16) => {
        now += ms;
        const pendingFrames = [...frames.values()];
        frames.clear();
        for (const frame of pendingFrames) {
            frame(now);
        }
        runDueTimers();
    };

    return {
        advance(ms: number) {
            let remaining = ms;
            while (remaining > 0) {
                const step = Math.min(16, remaining);
                tick(step);
                remaining -= step;
            }
        },
        get now() {
            return now;
        },
        pendingTimerCount: () => timers.size,
        restore() {
            Object.assign(globalThis, originals);
        },
        tick,
    };
}

export type FakeClock = ReturnType<typeof installFakeClock>;

export interface WebScrollHarnessOptions {
    itemCount?: number;
    itemSize?: number | ((index: number) => number);
    scrollLength?: number;
    supportsScrollEnd?: boolean;
}

/**
 * Simulates a browser scroll container driven by the real web doScrollTo, onScroll, and
 * imperative handle. Smooth scrolls move only when the test calls step/settle, so tests
 * decide exactly when rows measure, when the main thread stalls, and when scrollend fires.
 */
export function createWebScrollHarness(options: WebScrollHarnessOptions = {}) {
    const { itemCount = 100, itemSize = 100, scrollLength = 500, supportsScrollEnd = true } = options;
    const clock = installFakeClock();
    const data = Array.from({ length: itemCount }, (_, index) => ({ id: index }));
    const ctx: StateContext = createMockContext(
        { headerSize: 0, stylePaddingTop: 0 },
        {
            props: { data, estimatedItemSize: 100 } as any,
            scrollLength,
        },
    );
    const state = ctx.state;
    const sizes: number[] = data.map((_, index) => (typeof itemSize === "function" ? itemSize(index) : itemSize));

    const layout = () => {
        let position = 0;
        state.idCache.length = 0;
        state.indexByKey.clear();
        state.positions.length = 0;
        for (let index = 0; index < state.props.data.length; index++) {
            const id = `item_${index}`;
            state.idCache[index] = id;
            state.indexByKey.set(id, index);
            state.positions[index] = position;
            state.sizes.set(id, sizes[index]!);
            state.sizesKnown.set(id, sizes[index]!);
            position += sizes[index]!;
        }
        state.totalSize = position;
        ctx.values.set("totalSize", position);
    };
    layout();

    const listeners = new Map<string, Set<Listener>>();
    const eventTarget: Record<string, unknown> = {
        addEventListener(type: string, listener: Listener) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)!.add(listener);
        },
        removeEventListener(type: string, listener: Listener) {
            listeners.get(type)?.delete(listener);
        },
    };
    if (supportsScrollEnd) {
        eventTarget.onscrollend = null;
    }
    const dispatch = (type: string, event: Record<string, unknown> = {}) => {
        for (const listener of [...(listeners.get(type) ?? [])]) {
            listener({ ...event, type });
        }
    };

    const scrollToCalls: Array<{ animated: boolean; y: number }> = [];
    let offset = 0;
    let destination: number | undefined;
    const hooks: { ignoreAnimatedScrolls: boolean; onScrollEvent?: (offset: number) => void } = {
        ignoreAnimatedScrolls: false,
    };
    const getMaxOffset = () => Math.max(0, getContentSize(ctx) - state.scrollLength);
    const clamp = (value: number) => Math.max(0, Math.min(value, getMaxOffset()));

    const emitScroll = () => {
        onScroll(ctx, {
            nativeEvent: {
                contentOffset: { x: 0, y: offset },
                contentSize: { height: getContentSize(ctx), width: 400 },
                layoutMeasurement: { height: state.scrollLength, width: 400 },
            },
        } as any);
        dispatch("scroll");
        hooks.onScrollEvent?.(offset);
    };

    const scroller = {
        getCurrentScrollOffset: () => offset,
        getMaxScrollOffset: getMaxOffset,
        getScrollableNode: () => ({}),
        getScrollEventTarget: () => eventTarget,
        scrollTo: ({ animated, y }: { animated?: boolean; x: number; y: number }) => {
            scrollToCalls.push({ animated: !!animated, y });
            const next = clamp(y);
            if (animated) {
                if (!hooks.ignoreAnimatedScrolls) destination = next;
            } else {
                destination = undefined;
                offset = next;
                // Browsers deliver the scroll event for an instant scroll asynchronously.
                globalThis.requestAnimationFrame(() => emitScroll());
            }
        },
    };
    state.refScroller = { current: scroller } as any;

    const ref: LegendListRef = createImperativeHandle(ctx);

    const browser = {
        /** Pending smooth-scroll destination, or undefined when the browser is idle. */
        get destination() {
            return destination;
        },
        /** User wheel/touch input: stops the smooth scroll where it is. */
        interruptByUser(type = "wheel") {
            dispatch(type);
            destination = undefined;
        },
        keyDown(key: string, event: Record<string, unknown> = {}) {
            dispatch("keydown", { ...event, key });
        },
        /** Moves the scroll position without a smooth scroll in progress, e.g. a user drag. */
        moveTo(next: number) {
            offset = clamp(next);
            emitScroll();
        },
        get offset() {
            return offset;
        },
        /** Runs smooth scroll frames (with clock ticks) until the browser is idle. */
        runToEnd(px = 400) {
            for (let i = 0; i < 200 && destination !== undefined; i++) {
                browser.step(px);
                clock.tick();
            }
        },
        /** Fires scrollend without moving, as some browsers do before smooth scrolling settles. */
        scrollEnd() {
            dispatch("scrollend");
        },
        /** Finishes the smooth scroll: final scroll event, then scrollend when supported. */
        settle() {
            if (destination !== undefined) {
                offset = destination;
                destination = undefined;
                emitScroll();
            }
            if (supportsScrollEnd) {
                dispatch("scrollend");
            }
        },
        /** Advances the smooth scroll by one animation frame of `px` pixels. */
        step(px: number) {
            if (destination === undefined) return;
            // Browsers clamp a smooth scroll to the current content size as it shrinks.
            destination = clamp(destination);
            const remaining = destination - offset;
            if (Math.abs(remaining) <= px) {
                browser.settle();
                return;
            }
            offset = clamp(offset + Math.sign(remaining) * px);
            emitScroll();
        },
    };

    return {
        browser,
        clock,
        ctx,
        /** Test controls: a browser that ignores smooth scrolls, and a callback after each scroll event. */
        hooks,
        /** Changes measured sizes, recomputing positions as late measurement would. */
        measure(changes: Record<number, number>) {
            for (const index in changes) {
                sizes[Number(index)] = changes[index]!;
            }
            layout();
        },
        ref,
        restore: () => clock.restore(),
        scrollToCalls,
        /** Replaces the data, keeping per-index sizes for retained rows. */
        setData(nextLength: number, newItemSize = 100) {
            state.props.data = Array.from({ length: nextLength }, (_, index) => ({ id: index }));
            sizes.length = nextLength;
            for (let index = 0; index < nextLength; index++) {
                sizes[index] ??= newItemSize;
            }
            layout();
        },
        state,
        targetOffsetForIndex(index: number) {
            return clamp(state.positions[index]!);
        },
    };
}

export type WebScrollHarness = ReturnType<typeof createWebScrollHarness>;

/** Tracks a scroll promise so tests can assert whether, and with what, it resolved. */
export function trackScroll<T>(promise: Promise<T>) {
    const tracked: { resolved: boolean; value: T | undefined; rejected: boolean } = {
        rejected: false,
        resolved: false,
        value: undefined,
    };
    promise.then(
        (value) => {
            tracked.resolved = true;
            tracked.value = value;
        },
        () => {
            tracked.rejected = true;
        },
    );
    return tracked;
}

export async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}
