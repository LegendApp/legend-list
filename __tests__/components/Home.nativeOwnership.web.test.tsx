import { afterEach, expect, it } from "bun:test";
import "../setup";

import { calculateItemsInView } from "@/core/calculateItemsInView";
import { interruptUserScroll } from "@/core/cancelScroll";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { onScroll } from "@/core/onScroll";
import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { updateItemSizesBatch } from "@/core/updateItemSizes";
import { Platform } from "@/platform/Platform";
import { StateProvider, useStateContext } from "@/state/state";
import { requestAdjust } from "@/utils/requestAdjust";
import { ListComponentScrollView } from "../../src/components/ListComponentScrollView?native-home-interval";
import { ScrollAdjust } from "../../src/components/ScrollAdjust?native-home-interval";
import { createMockState } from "../__mocks__/createMockState";
import TestRenderer, { act } from "../helpers/testRenderer";
import { installFakeClock } from "../helpers/webScrollHarness";

const originalPlatform = Platform.OS;
let cleanup: (() => void) | undefined;
afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    Platform.OS = originalPlatform;
});

function setup(following = true, supportsScrollEnd = true) {
    Platform.OS = "web";
    const clock = installFakeClock();
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
        observe() {}
        disconnect() {}
    } as any;
    const listeners = new Map<string, Set<(event: any) => void>>();
    const writes: number[] = [];
    let destination: number | undefined;
    const node = {
        addEventListener(type: string, listener: (event: any) => void) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)!.add(listener);
        },
        clientHeight: 799,
        clientWidth: 400,
        closest: () => null,
        getBoundingClientRect: () => ({ height: 799, left: 0, top: 0, width: 400 }),
        nodeType: 1,
        querySelector: () => null,
        removeEventListener(type: string, listener: (event: any) => void) {
            listeners.get(type)?.delete(listener);
        },
        scrollBy({ top = 0 }: ScrollToOptions) {
            writes.push(top);
            if (destination !== undefined) destination = Math.max(0, destination + top);
            else node.scrollTop = Math.max(0, node.scrollTop + top);
        },
        scrollHeight: 39711,
        scrollLeft: 0,
        scrollTo({ top = 0 }: ScrollToOptions) {
            node.scrollTop = top;
            destination = undefined;
        },
        scrollTop: 14994,
        scrollWidth: 400,
    };
    if (supportsScrollEnd) Object.assign(node, { onscrollend: null });
    const dispatch = (type: string, event: any = {}) => {
        event.target ??= node;
        event.type = type;
        for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    };
    let ctx: ReturnType<typeof useStateContext>;
    function Setup() {
        ctx = useStateContext();
        ctx.state = createMockState({
            didContainersLayout: true,
            didFinishInitialScroll: true,
            endBuffered: 449,
            endNoBuffer: 184,
            idsInView: ["item_176"],
            props: {
                data: Array.from({ length: 450 }, (_, id) => ({ id })),
                estimatedItemSize: 61,
                maintainScrollAtEnd: following ? { animated: false, onItemLayout: true } : undefined,
                maintainVisibleContentPosition: { data: true, size: true },
            },
            refScroller: {
                current: {
                    getCurrentScrollOffset: () => node.scrollTop,
                    getMaxScrollOffset: () => node.scrollHeight - node.clientHeight,
                    getScrollableNode: () => node,
                },
            } as any,
            scroll: 14994,
            scrollLength: 799,
            scrollPending: 14994,
            startBuffered: 0,
            startNoBuffer: 176,
            totalSize: 39711,
        });
        ctx.state.scrollAdjustHandler = new ScrollAdjustHandler(ctx);
        ctx.interruptUserScroll = () => interruptUserScroll(ctx);
        ctx.state.triggerCalculateItemsInView = (params) => calculateItemsInView(ctx, params);
        for (let index = 0; index < 450; index++) {
            const id = `item_${index}`;
            ctx.state.idCache[index] = id;
            ctx.state.indexByKey.set(id, index);
            ctx.state.positions[index] = index * 61;
            ctx.state.sizes.set(id, 61);
            ctx.state.sizesKnown.set(id, 61);
        }
        ctx.values.set("readyToRender", true);
        // Range rendering is not needed here: exercise the real measurement/MVCP path
        // against an already mounted anchor while the compositor outruns JS.
        ctx.values.set("numContainers", 64);
        return (
            <>
                <ListComponentScrollView onLayout={() => {}} onScroll={(event) => onScroll(ctx, event)} style={{}} />
                <ScrollAdjust />
            </>
        );
    }
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <StateProvider>
                <Setup />
            </StateProvider>,
            { createNodeMock: () => node },
        );
    });
    cleanup = () => {
        act(() => renderer.unmount());
        ctx.state.scheduledWork.dispose();
        clock.restore();
        globalThis.ResizeObserver = originalResizeObserver;
    };
    return {
        clock,
        ctx: ctx!,
        dispatch,
        home() {
            act(() => dispatch("keydown", { defaultPrevented: false, key: "Home" }));
            destination = 0;
        },
        measure(index: number, height: number) {
            act(() => updateItemSizesBatch(ctx!, [{ itemKey: `item_${index}`, size: { height, width: 400 } }]));
        },
        node,
        settle() {
            node.scrollTop = destination ?? node.scrollTop;
            destination = undefined;
            act(() => dispatch("scroll"));
            if (supportsScrollEnd) act(() => dispatch("scrollend"));
            act(() => clock.advance(300));
        },
        writes,
    };
}

// All five failed group trials wrote from ScrollAdjust at 91–122ms. A measurement
// prepare/follow pass can run before the next scroll event and release Home.
for (const timing of [70, 91, 95.9, 98.9, 99, 101.6, 117.6, 121.2, 121.6, 161.9]) {
    for (const prepareOnly of [false, true]) {
        it(`keeps Home owned when end-follow observes native progress at ${timing}ms (prepare: ${prepareOnly})`, () => {
            const h = setup();
            h.home();
            act(() => h.clock.advance(timing));
            h.ctx.state.scroll = 10894;
            h.ctx.state.lastNativeScroll = 10894;
            h.node.scrollTop = 6850;
            act(() => doMaintainScrollAtEnd(h.ctx, { immediate: true, prepareOnly }));
            // The guard must survive a real row measurement, including its prepare pass.
            h.measure(0, 101);
            h.measure(1, 185);
            act(() => requestAdjust(h.ctx, 129.25, "item-size"));
            h.settle();
            expect(h.writes).toEqual([]);
            expect(h.node.scrollTop).toBe(0);
            expect(h.ctx.state.sizesKnown.get("item_0")).toBe(101);
            expect(h.ctx.state.sizesKnown.get("item_1")).toBe(185);
        });
    }
}

for (const following of [false, true]) {
    for (const supportsScrollEnd of [false, true]) {
        for (const lateMs of [0, 16, 31.9, 70, 161.9, 169.8, 177.8, 250, 500]) {
            it(`consumes late row-0/1 corrections at Home's boundary (${lateMs}ms, follow: ${following}, scrollend: ${supportsScrollEnd})`, () => {
                const h = setup(following, supportsScrollEnd);
                h.home();
                h.node.scrollTop = 0;
                act(() => h.dispatch("scroll"));
                if (supportsScrollEnd) act(() => h.dispatch("scrollend"));
                act(() => h.clock.advance(lateMs));
                h.measure(0, 101);
                h.measure(1, 185);
                act(() => requestAdjust(h.ctx, 9, "item-size"));
                act(() => requestAdjust(h.ctx, -8.633, "item-size"));
                h.settle();
                expect(h.writes).toEqual([]);
                expect(h.node.scrollTop).toBe(0);
            });
        }
    }
}

for (const source of [undefined, "data", "item-size"] as const) {
    it(`protects Home from ${source ?? "unclassified"} adjustments between native events`, () => {
        const h = setup();
        h.home();
        h.ctx.state.scroll = 13493;
        h.node.scrollTop = 10539;
        act(() => requestAdjust(h.ctx, 129.25, source));
        h.settle();
        expect(h.writes).toEqual([]);
        expect(h.node.scrollTop).toBe(0);
    });
}

// The observed release-shape correction is +129.25; stale JS adds an unrelated
// 2954px of browser progress and previously turns it into +3083.25.
for (const progress of [2954, 4044, -1200]) {
    for (const delta of [129.25, -8.633, 9, 40, 124]) {
        it(`writes only relative layout credit ${delta} after unobserved browser progress ${progress}`, () => {
            const h = setup(false);
            h.ctx.state.scroll = 13493;
            h.ctx.state.lastNativeScroll = 13493;
            h.node.scrollTop = 13493 - progress;
            const before = h.node.scrollTop;
            act(() => requestAdjust(h.ctx, delta, "item-size"));
            expect(h.writes).toHaveLength(1);
            expect(h.writes[0]).toBeCloseTo(delta, 6);
            expect(h.node.scrollTop).toBeCloseTo(before + delta, 6);
            expect(h.ctx.state.scroll).toBeCloseTo(before + delta, 6);
        });
    }
}

for (const lateMs of [0, 16, 31.9, 70, 161.9, 177.8]) {
    it(`keeps Home owned through a premature mid-motion scrollend (${lateMs}ms)`, () => {
        const h = setup();
        h.home();
        h.node.scrollTop = 6850;
        act(() => h.dispatch("scrollend"));
        act(() => h.clock.advance(lateMs));
        act(() => requestAdjust(h.ctx, 129.25, "item-size"));
        h.settle();
        expect(h.writes).toEqual([]);
        expect(h.node.scrollTop).toBe(0);
    });
}

for (const observedByJS of [false, true]) {
    for (const delta of [-448, -129.25, -8.633]) {
        it(`consumes a browser end clamp ${delta} once (JS observed: ${observedByJS})`, () => {
            const h = setup(false);
            h.node.scrollTop = 829;
            h.node.scrollHeight = 829 + h.node.clientHeight;
            h.ctx.state.scroll = 829 - delta;
            h.ctx.state.lastNativeScroll = observedByJS ? 829 : 829 - delta;
            act(() => requestAdjust(h.ctx, delta, "item-size"));
            expect(h.writes).toEqual([]);
            expect(h.ctx.state.scroll).toBeCloseTo(829, 6);
            expect(h.node.scrollTop).toBe(829);
        });
    }
}

for (const delta of [0.25, -0.25, 0.4, -0.4]) {
    it(`retains fractional credit ${delta} across native observations without accumulating browser progress`, () => {
        const h = setup(false);
        h.node.scrollTop = 1000;
        h.ctx.state.scroll = 1000;
        h.node.scrollBy = ({ top = 0 }) => {
            h.writes.push(top);
            h.node.scrollTop = Math.round(h.node.scrollTop + top);
        };
        for (let i = 0; i < 10; i++) {
            act(() => requestAdjust(h.ctx, delta, "item-size"));
            act(() => h.dispatch("scroll"));
            act(() => h.clock.tick());
        }
        expect(h.node.scrollTop).toBeCloseTo(Math.round(1000 + 10 * delta), 0);
        // The same DOM offset following an unrelated move must drop old rounding credit.
        h.node.scrollTop = 2000;
        h.ctx.state.scroll = 2000;
        act(() => requestAdjust(h.ctx, 10, "item-size"));
        expect(h.writes.at(-1)).toBe(10);
        expect(h.node.scrollTop).toBe(2010);
    });
}

for (const input of ["wheel", "PageDown", "End", "explicit", "dispose", "unmount"] as const) {
    for (const arrived of [false, true]) {
        it(`releases Home for ${input} (arrived: ${arrived})`, () => {
            const h = setup();
            h.home();
            if (arrived) {
                h.node.scrollTop = 0;
                act(() => h.dispatch("scrollend"));
            }
            if (input === "wheel") {
                act(() =>
                    h.dispatch("wheel", { cancelable: false, defaultPrevented: false, deltaY: 50, timeStamp: 100 }),
                );
            } else if (input === "explicit") {
                act(() => interruptUserScroll(h.ctx));
            } else if (input === "dispose") {
                h.ctx.state.scheduledWork.dispose();
            } else if (input === "unmount") {
                cleanup!();
                cleanup = undefined;
            } else {
                act(() => h.dispatch("keydown", { defaultPrevented: false, key: input }));
            }
            expect(h.ctx.state.scheduledWork.has("nativeScrollToStart")).toBe(false);
            if (input !== "unmount") {
                h.node.scrollTop = 1000;
                h.ctx.state.scroll = 1000;
                act(() => requestAdjust(h.ctx, 40, "item-size"));
                expect(h.writes.at(-1)).toBe(40);
            }
        });
    }
}

for (const replacement of ["Home", "PageDown", "dispose"] as const) {
    it(`cancels an already queued settle callback before ${replacement} takes ownership`, () => {
        const h = setup();
        h.home();
        // Both second-frame callbacks are delivered in one batch. Cancellation
        // must still invalidate the old callback after it has left the RAF queue.
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                h.node.scrollTop = 14994;
                if (replacement === "Home") h.home();
                else if (replacement === "dispose") h.ctx.state.scheduledWork.dispose();
                else h.dispatch("keydown", { defaultPrevented: false, key: replacement });
            }),
        );
        h.node.scrollTop = 0;
        act(() => h.dispatch("scrollend"));
        act(() => h.clock.tick());
        act(() => h.clock.tick());
        expect(h.ctx.state.scheduledWork.has("nativeScrollToStart")).toBe(replacement === "Home");
        // The large jump also queues the draw distance prewarm.
        const prewarmPending = replacement !== "dispose";
        expect(h.ctx.state.scheduledWork.has("fullDrawDistancePrewarm")).toBe(prewarmPending);
        expect(h.clock.pendingTimerCount()).toBe(Number(replacement === "Home") + Number(prewarmPending));
    });
}
