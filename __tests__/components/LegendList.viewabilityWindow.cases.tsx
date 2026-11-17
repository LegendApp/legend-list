import * as React from "react";

import { afterEach, beforeEach, expect, it, jest, mock } from "bun:test";
import "../setup";

import { LegendList } from "../../src/components/LegendList";
import { ListComponentScrollView } from "../../src/components/ListComponentScrollView?dwell-window";
import { Platform } from "../../src/platform/Platform";
import type { OnViewableItemsChangedInfo } from "../../src/types.base";
import TestRenderer, { act } from "../helpers/testRenderer";

const originalWindow = globalThis.window;
const originalRAF = globalThis.requestAnimationFrame;
const originalCancelRAF = globalThis.cancelAnimationFrame;
let renderer: TestRenderer.ReactTestRenderer | undefined;
let owner: any;
let isHorizontal = false;
let columns = 1;
const listeners = new Map<string, Set<(event: Event) => void>>();
const rows = Array.from({ length: 12 }, (_, id) => ({ id: String(id) }));
const config = { itemVisiblePercentThreshold: 50, minimumViewTime: 250 };
// The shared test harness uses native layout hooks. The web adapter supplies layout
// events; this bridge keeps native measurement from duplicating that geometry.
const Surface = React.forwardRef(function WindowSurface(props: any, ref: React.Ref<any>) {
    const webRef = React.useRef<any>(null);
    React.useImperativeHandle(ref, () => ({ ...webRef.current, measure: () => {} }));
    return <ListComponentScrollView {...props} ref={webRef} useWindowScroll />;
});

beforeEach(() => {
    jest.useFakeTimers();
    Platform.OS = "web";
    mock.module("@/platform/getWindowSize", () => ({ getWindowSize: () => ({ height: 200, width: 200 }) }));
    mock.module("@/components/ListComponentScrollView", () => ({ ListComponentScrollView: Surface }));
    listeners.clear();
    isHorizontal = false;
    columns = 1;
    owner = {
        addEventListener(type: string, listener: (event: Event) => void) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)!.add(listener);
        },
        document: { documentElement: { clientHeight: 200, clientWidth: 200, scrollHeight: 2000, scrollWidth: 200 } },
        innerHeight: 200,
        innerWidth: 200,
        removeEventListener(type: string, listener: (event: Event) => void) {
            listeners.get(type)?.delete(listener);
        },
        scrollTo({ top, left }: { top?: number; left?: number }) {
            owner.scrollY = top ?? owner.scrollY;
            owner.scrollX = left ?? owner.scrollX;
        },
        scrollX: 0,
        scrollY: 300,
    };
    globalThis.window = owner;
    globalThis.requestAnimationFrame = (callback) =>
        setTimeout(() => callback(performance.now()), 1) as unknown as number;
    globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
    mock.module("../../src/components/observeScrollLayout", () => ({
        observeScrollLayout: (_element: unknown, _owner: unknown, onLayout: () => void) => {
            onLayout();
            return () => {};
        },
    }));
});

afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    globalThis.window = originalWindow;
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCancelRAF;
    jest.useRealTimers();
});

async function advance(ms: number) {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
}

function tree(callback: (info: OnViewableItemsChangedInfo) => void) {
    return (
        <LegendList
            data={rows}
            estimatedItemSize={100}
            getFixedItemSize={() => 100}
            horizontal={isHorizontal}
            keyExtractor={(item) => item.id}
            numColumns={columns}
            onViewableItemsChanged={callback}
            recycleItems={false}
            renderItem={() => null}
            useWindowScroll
            viewabilityConfig={config}
        />
    );
}

async function mount(callback: (info: OnViewableItemsChangedInfo) => void) {
    if (isHorizontal) {
        owner.scrollX = 300;
        owner.scrollY = 0;
    }
    act(() => {
        renderer = TestRenderer.create(tree(callback), {
            createNodeMock: (element) =>
                element.type === "div"
                    ? {
                          clientHeight: 200,
                          clientWidth: 200,
                          getBoundingClientRect: () => ({
                              height: isHorizontal ? 200 : 1200,
                              left: isHorizontal ? 300 - owner.scrollX : 0,
                              top: isHorizontal ? 0 : 300 - owner.scrollY,
                              width: isHorizontal ? 1200 : 200,
                          }),
                          scrollHeight: isHorizontal ? 200 : 1200,
                          scrollWidth: isHorizontal ? 1200 : 200,
                      }
                    : null,
        });
    });
    await advance(2);
}

async function scroll(y: number) {
    act(() => {
        if (isHorizontal) owner.scrollX = y;
        else owner.scrollY = y;
        for (const listener of listeners.get("scroll") ?? []) listener({} as Event);
    });
    await advance(2);
}

for (const horizontal of [false, true]) {
    it(`uses list-local row dwell with a window-owned web adapter (horizontal=${horizontal})`, async () => {
        isHorizontal = horizontal;
        const calls: OnViewableItemsChangedInfo[] = [];
        await mount((info) => calls.push(info));
        await advance(190);
        await scroll(400);
        await advance(70);
        expect(calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["1"]);
        await advance(180);
        expect(calls.at(-1)!.viewableItems.map((token) => [token.key, token.index, token.item.id])).toEqual([
            ["1", 1, "1"],
            ["2", 2, "2"],
        ]);
    });
}

it("restarts pending dwell after a window-owned list leaves and reenters the viewport", async () => {
    const calls: OnViewableItemsChangedInfo[] = [];
    await mount((info) => calls.push(info));
    await advance(190);
    await scroll(1600);
    await advance(100);
    expect(calls).toEqual([]);
    await scroll(300);
    await advance(240);
    expect(calls).toEqual([]);
    await advance(10);
    expect(calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
});

it("refreshes a pending window-list callback while the owner stays stationary", async () => {
    const old: OnViewableItemsChangedInfo[] = [];
    const latest: OnViewableItemsChangedInfo[] = [];
    await mount((info) => old.push(info));
    await advance(190);
    act(() => renderer!.update(tree((info) => latest.push(info))));
    await advance(70);
    expect(old).toEqual([]);
    expect(latest.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
});

it("keeps column keys independent with the window-owned web adapter", async () => {
    columns = 2;
    const calls: OnViewableItemsChangedInfo[] = [];
    await mount((info) => calls.push(info));
    await advance(190);
    await scroll(400);
    await advance(70);
    expect(calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["2", "3"]);
    await advance(180);
    expect(calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["2", "3", "4", "5"]);
});

it("cleans window listeners and pending dwell when the list unmounts", async () => {
    const calls: OnViewableItemsChangedInfo[] = [];
    await mount((info) => calls.push(info));
    await advance(190);
    act(() => renderer!.unmount());
    renderer = undefined;
    await advance(1000);
    expect(calls).toEqual([]);
    expect(listeners.get("scroll")?.size).toBe(0);
});
