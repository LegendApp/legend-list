import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as React from "react";
import { Animated, Text } from "react-native";

import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { peek$, type StateContext, useStateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";

// A release can be followed by momentum; the settle waits this long to see it.
async function waitForSettle() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
    });
}

async function flushFrames() {
    for (let i = 0; i < 12; i++) {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}

// Native sticky headers read the offset through attachNativeEvent, with no JS value
// listener. When a scroll settles, the list copies the final offset into the JS value
// once so Fabric's end-of-scroll commit writes the pinned transform. These tests drive
// the real list gesture handlers and record what reaches the Animated value.
async function mountStickyList({ horizontal = false, sticky = true } = {}) {
    const itemSize = 50;
    const viewportSize = 300;
    const itemCount = 40;
    const { LegendList } = await import("../../src/components/LegendList");
    const ref = React.createRef<LegendListRef>();
    let ctx: StateContext | undefined;
    let scrollProps: any;
    const writes: number[] = [];
    const attach = spyOn(Animated, "attachNativeEvent").mockImplementation(() => ({ detach: () => {} }));
    const nativeNode = { id: "scroller" };
    const ScrollSurface = React.forwardRef(function StickyScrollSurface(props: any, forwardedRef: React.Ref<any>) {
        ctx = useStateContext();
        scrollProps = props;
        React.useImperativeHandle(forwardedRef, () => ({
            getScrollableNode: () => nativeNode,
            getScrollResponder() {
                return this;
            },
            measure: () => {},
            scrollTo: (options: { x?: number; y?: number }) => {
                const offset = (horizontal ? options.x : options.y) ?? 0;
                writes.push(offset);
                // Native echoes the write as a scroll event on a later frame.
                requestAnimationFrame(() => scrollProps?.onScroll(event(offset)));
            },
        }));
        return <>{props.children}</>;
    });
    const list = (stickyIndices: number[] | undefined) => (
        <LegendList
            data={Array.from({ length: itemCount }, (_, id) => ({ id: String(id) }))}
            estimatedItemSize={itemSize}
            getFixedItemSize={() => itemSize}
            horizontal={horizontal}
            keyExtractor={(item: { id: string }) => item.id}
            recycleItems={false}
            ref={ref}
            renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
            renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
            stickyHeaderIndices={stickyIndices}
        />
    );
    const rendered = render(list(sticky ? [0] : undefined));
    await flushFrames();
    act(() =>
        scrollProps.onLayout({ nativeEvent: { layout: { height: viewportSize, width: viewportSize, x: 0, y: 0 } } }),
    );
    await flushFrames();
    function event(offset: number) {
        const length = itemCount * itemSize;
        return {
            nativeEvent: {
                contentOffset: horizontal ? { x: offset, y: 0 } : { x: 0, y: offset },
                contentSize: horizontal
                    ? { height: viewportSize, width: length }
                    : { height: length, width: viewportSize },
                layoutMeasurement: { height: viewportSize, width: viewportSize },
                velocity: { x: 0, y: 0 },
            },
            timeStamp: Date.now(),
        };
    }
    const value = ctx!.animatedScrollY as unknown as Animated.Value;
    const setValue = spyOn(value, "setValue");
    const addListener = spyOn(value, "addListener");
    const jsUpdate = spyOn(value as any, "__onAnimatedValueUpdateReceived");

    return {
        addListener,
        attach,
        beginDrag: (offset: number) => act(() => scrollProps.onScrollBeginDrag(event(offset))),
        beginMomentum: (offset: number) => act(() => scrollProps.onMomentumScrollBegin(event(offset))),
        context: () => ctx!,
        endDrag: (offset: number) => act(() => scrollProps.onScrollEndDrag(event(offset))),
        endMomentum: (offset: number) => act(() => scrollProps.onMomentumScrollEnd(event(offset))),
        // JS-only copies of the offset (the native node is left to the event binding).
        jsSettled: () => jsUpdate.mock.calls.map(([offset]: any) => offset),
        nativeWrites: () => setValue.mock.calls.map(([offset]) => offset),
        ref,
        rerender: (stickyIndices: number[] | undefined) => rendered.rerender(list(stickyIndices)),
        scroll: (...offsets: number[]) => {
            for (const offset of offsets) act(() => scrollProps.onScroll(event(offset)));
        },
        settled: () => [
            ...setValue.mock.calls.map(([offset]) => offset),
            ...jsUpdate.mock.calls.map(([offset]: any) => offset),
        ],
        // Sticky containers re-render on each bump, committing the settled transform.
        stickySettles: () => peek$(ctx!, "stickySettle") ?? 0,
        unmount: rendered.unmount,
        writes,
    };
}

describe("native sticky headers copy the settled offset into the JS value", () => {
    // The shared Animated.Value mock lacks the members sticky positioning and the
    // listener check need; add them for this file only.
    const proto = Animated.Value.prototype as any;
    const added: string[] = [];
    beforeAll(() => {
        const members: Record<string, unknown> = {
            __onAnimatedValueUpdateReceived(value: number) {
                this._value = value;
            },
            addListener: () => "listener",
            interpolate() {
                return this;
            },
        };
        for (const [name, fn] of Object.entries(members)) {
            if (!(name in proto)) {
                proto[name] = fn;
                added.push(name);
            }
        }
    });
    afterAll(() => {
        for (const name of added) delete proto[name];
    });

    beforeEach(() => {
        // Bun resolves .ts by default; Metro resolves this dependency to .native.ts.
        spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    });

    afterEach(() => {
        mock.restore();
    });

    it("copies the final offset once when a drag ends without momentum", async () => {
        const list = await mountStickyList();
        try {
            list.beginDrag(0);
            list.scroll(40, 120, 200);
            expect(list.settled()).toEqual([]);
            expect(list.stickySettles()).toBe(0);
            list.endDrag(200);
            await waitForSettle();
            expect(list.settled()).toEqual([200]);
            expect(list.stickySettles()).toBe(1);
            expect(list.addListener).not.toHaveBeenCalled();
        } finally {
            list.unmount();
        }
    });

    it("copies the momentum end offset after a fling", async () => {
        const list = await mountStickyList();
        try {
            list.beginDrag(0);
            list.scroll(60, 180);
            list.endDrag(180);
            list.beginMomentum(180);
            list.scroll(320, 410, 437);
            list.endMomentum(437);
            await waitForSettle();
            expect(list.settled()).toEqual([437]);
            expect(list.stickySettles()).toBe(1);
            expect(list.context().state.isMomentumScrolling).toBe(false);
        } finally {
            list.unmount();
        }
    });

    it("does not rewrite the value when a settle has no new scroll events", async () => {
        const list = await mountStickyList();
        try {
            list.beginDrag(0);
            list.scroll(150);
            list.endDrag(150);
            list.beginMomentum(150);
            list.endMomentum(150);
            await waitForSettle();
            expect(list.settled()).toEqual([150]);
            expect(list.stickySettles()).toBe(1);
        } finally {
            list.unmount();
        }
    });

    it.each([true, false])("copies the target after a programmatic scrollToOffset (animated %s)", async (animated) => {
        const list = await mountStickyList();
        try {
            let done = false;
            act(() => {
                void list.ref.current!.scrollToOffset({ animated, offset: 600 }).then(() => {
                    done = true;
                });
            });
            await flushFrames();
            await waitForSettle();
            expect(list.writes).toEqual([600]);
            expect(done).toBe(true);
            expect(list.context().state.scroll).toBe(600);
            expect(list.settled().at(-1)).toBe(600);
            expect(list.stickySettles()).toBeGreaterThan(0);
        } finally {
            list.unmount();
        }
    });

    it("copies the target after a programmatic scrollToIndex", async () => {
        const list = await mountStickyList();
        try {
            act(() => {
                void list.ref.current!.scrollToIndex({ animated: true, index: 10 });
            });
            await flushFrames();
            await waitForSettle();
            expect(list.writes).toEqual([500]);
            expect(list.settled().at(-1)).toBe(500);
        } finally {
            list.unmount();
        }
    });

    it("reads the x offset for horizontal lists", async () => {
        const list = await mountStickyList({ horizontal: true });
        try {
            expect(list.attach.mock.calls.at(-1)?.[2]).toEqual([
                { nativeEvent: { contentOffset: { x: list.context().animatedScrollY } } },
            ]);
            list.beginDrag(0);
            list.scroll(90, 260);
            list.endDrag(260);
            await waitForSettle();
            expect(list.settled()).toEqual([260]);
        } finally {
            list.unmount();
        }
    });

    it("never applies an offset recorded before sticky headers were removed", async () => {
        const list = await mountStickyList();
        try {
            list.beginDrag(0);
            list.scroll(100);
            list.rerender(undefined);
            await flushFrames();
            // Without sticky headers the native value is no longer driven.
            list.scroll(900);
            list.endDrag(900);
            list.rerender([0]);
            await flushFrames();
            // A settle with no scroll since rebinding must not move native back to 100.
            list.beginDrag(900);
            list.endDrag(900);
            await waitForSettle();
            expect(list.settled()).toEqual([]);
        } finally {
            list.unmount();
        }
    });

    it("writes nothing after unmounting mid-scroll", async () => {
        const list = await mountStickyList();
        const ctx = list.context();
        list.beginDrag(0);
        list.scroll(80, 240);
        list.unmount();
        ctx.state.isDragging = false;
        act(() => {
            // A late gesture end after unmount must not touch the detached value.
            const { syncScrollActive } = require("../../src/core/cancelImperativeScroll");
            syncScrollActive(ctx);
        });
        await waitForSettle();
        expect(list.settled()).toEqual([]);
        expect(list.addListener).not.toHaveBeenCalled();
    });

    it("leaves non-sticky lists alone", async () => {
        const list = await mountStickyList({ sticky: false });
        try {
            list.beginDrag(0);
            list.scroll(100, 300);
            list.endDrag(300);
            await waitForSettle();
            expect(list.settled()).toEqual([]);
            expect(list.stickySettles()).toBe(0);
            expect(list.attach).not.toHaveBeenCalled();
        } finally {
            list.unmount();
        }
    });
    it("does not settle at a fling release that continues into momentum", async () => {
        const list = await mountStickyList();
        try {
            list.beginDrag(0);
            list.scroll(60, 180);
            // Native emits onScrollEndDrag before onMomentumScrollBegin, so isScrollActive
            // is briefly false at every fling release. A copy here lands while momentum is
            // already moving the native value.
            list.endDrag(180);
            list.beginMomentum(180);
            list.scroll(320, 410, 437);
            await waitForSettle();
            expect(list.settled()).toEqual([]);
            expect(list.stickySettles()).toBe(0);
            list.endMomentum(437);
            await waitForSettle();
            expect(list.settled()).toEqual([437]);
            expect(list.stickySettles()).toBe(1);
        } finally {
            list.unmount();
        }
    });

    it("copies the settled offset into JS without writing the native node", async () => {
        const list = await mountStickyList();
        try {
            list.beginDrag(0);
            list.scroll(40, 200);
            list.endDrag(200);
            await waitForSettle();
            // The event binding already drives native. A native write is queued until after
            // the next mount, so it can overwrite a newer offset (an MVCP adjust or a new
            // gesture) and leave the header misplaced until the next scroll event.
            expect(list.nativeWrites()).toEqual([]);
            expect(list.jsSettled()).toEqual([200]);
            expect(list.stickySettles()).toBe(1);
        } finally {
            list.unmount();
        }
    });
});
