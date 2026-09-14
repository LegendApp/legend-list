import type * as React from "react";

import { afterEach, expect, it, mock, spyOn } from "bun:test";
import { useDOMOrder } from "../../src/hooks/useDOMOrder";
import { Platform } from "../../src/platform/Platform";
import { StateProvider, set$, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import TestRenderer, { act } from "../helpers/testRenderer";

const originalPlatform = Platform.OS;
let renderer: TestRenderer.ReactTestRenderer | undefined;

afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    Platform.OS = originalPlatform;
});

function setup({ atomic = true, connected = true, scrollTime = 0, native = false } = {}) {
    Platform.OS = native ? "ios" : "web";
    let now = 10000;
    let nextId = 0;
    let update = 0;
    const timers = new Map<number, { callback: () => void; at: number }>();
    spyOn(Date, "now").mockImplementation(() => now);
    globalThis.setTimeout = ((callback: () => void, delay: number) => {
        const id = ++nextId;
        timers.set(id, { at: now + delay, callback });
        return id;
    }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = ((id: number) => timers.delete(id)) as unknown as typeof clearTimeout;

    const first = {} as HTMLElement;
    const second = {} as HTMLElement;
    const children = [first, second];
    const move = mock((element: HTMLElement, before: HTMLElement | null) => {
        children.splice(children.indexOf(element), 1);
        children.splice(before ? children.indexOf(before) : children.length, 0, element);
    });
    const container = {
        appendChild: (element: HTMLElement) => move(element, null),
        children,
        insertBefore: move,
        isConnected: connected,
        ...(atomic ? { moveBefore: move } : {}),
    } as unknown as HTMLDivElement;
    const ref: React.RefObject<HTMLDivElement | null> = { current: container };
    let ctx!: ReturnType<typeof useStateContext>;

    function Probe() {
        ctx = useStateContext();
        ctx.state = createMockState({ scrollTime });
        ctx.viewRefs.set(0, { current: first });
        ctx.viewRefs.set(1, { current: second });
        ctx.values.set("containerItemIndex0", 1);
        ctx.values.set("containerItemIndex1", 0);
        useDOMOrder(ref);
        return null;
    }

    act(() => {
        renderer = TestRenderer.create(
            <StateProvider>
                <Probe />
            </StateProvider>,
        );
    });
    return {
        advance(ms: number) {
            now += ms;
            for (const [id, timer] of [...timers]) {
                if (timer.at <= now) {
                    timers.delete(id);
                    act(timer.callback);
                }
            }
        },
        children,
        ctx,
        emit: () => set$(ctx, "lastPositionUpdate", ++update),
        first,
        move,
        get nextDelay() {
            return Math.min(...[...timers.values()].map((timer) => timer.at - now));
        },
        ref,
        second,
        timers,
    };
}

it("coalesces quiet updates and reads the latest indices", () => {
    const s = setup();
    s.emit();
    s.emit();
    s.ctx.values.set("containerItemIndex0", 0);
    s.ctx.values.set("containerItemIndex1", 1);
    s.emit();
    expect(s.timers.size).toBe(1);
    expect(s.nextDelay).toBe(0);
    s.advance(0);
    expect(s.children).toEqual([s.first, s.second]);
    expect(s.move).not.toHaveBeenCalled();
});

it("reorders a quiet list in the next task", () => {
    const s = setup();
    s.emit();
    expect(s.move).not.toHaveBeenCalled();
    s.advance(0);
    expect(s.children).toEqual([s.second, s.first]);
    expect(s.move).toHaveBeenCalledTimes(1);
});

for (const [name, options] of [
    ["scrolling", { scrollTime: 10000 }],
    ["unsupported", { atomic: false }],
    ["disconnected", { connected: false }],
] as const) {
    it(`keeps the 500ms debounce when ${name}`, () => {
        const s = setup(options);
        s.emit();
        s.advance(100);
        s.emit();
        s.advance(499);
        expect(s.move).not.toHaveBeenCalled();
        s.advance(1);
        expect(s.children).toEqual([s.second, s.first]);
    });
}

it("restores the debounce if scrolling starts before immediate work runs", () => {
    const s = setup();
    s.emit();
    s.ctx.state.scrollTime = Date.now();
    s.emit();
    s.advance(499);
    expect(s.move).not.toHaveBeenCalled();
    s.advance(1);
    expect(s.move).toHaveBeenCalledTimes(1);
});

for (const atomic of [true, false]) {
    it(`cancels ${atomic ? "immediate" : "delayed"} work and unsubscribes on unmount`, () => {
        const s = setup({ atomic });
        s.emit();
        act(() => renderer?.unmount());
        renderer = undefined;
        expect(s.timers.size).toBe(0);
        expect(s.ctx.listeners.get("lastPositionUpdate")?.size ?? 0).toBe(0);
        s.emit();
        s.advance(1000);
        expect(s.move).not.toHaveBeenCalled();
    });
}

it("tolerates a cleared ref before the callback", () => {
    const s = setup();
    s.emit();
    s.ref.current = null;
    s.advance(0);
    expect(s.move).not.toHaveBeenCalled();
});

it("returns to immediate scheduling after a quiet period", () => {
    const s = setup({ scrollTime: 10000 });
    s.emit();
    s.advance(1001);
    s.emit();
    expect(s.nextDelay).toBe(0);
});

it("keeps burst updates debounced despite jitter around 500ms", () => {
    const s = setup();
    s.emit();
    s.advance(0);
    for (const interval of [490, 505, 498, 510]) {
        s.advance(interval);
        s.emit();
        expect(s.nextDelay).toBe(500);
    }
});

it("does not schedule DOM work on native", () => {
    const s = setup({ native: true });
    s.emit();
    expect(s.timers.size).toBe(0);
    expect(s.ctx.listeners.get("lastPositionUpdate")?.size ?? 0).toBe(0);
});
