import { afterEach, expect, it } from "bun:test";
import "../setup";

import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { Platform } from "@/platform/Platform";
import { StateProvider, useStateContext } from "@/state/state";
import { requestAdjust } from "@/utils/requestAdjust";
import { ListComponentScrollView } from "../../src/components/ListComponentScrollView?home-measurements";
import { ScrollAdjust } from "../../src/components/ScrollAdjust?home-measurements";
import { createMockState } from "../__mocks__/createMockState";
import TestRenderer, { act } from "../helpers/testRenderer";
import { installFakeClock } from "../helpers/webScrollHarness";

const originalPlatform = Platform.OS;
afterEach(() => {
    Platform.OS = originalPlatform;
});

for (const following of [false, true]) {
    for (const timing of [
        "queued-before-key",
        "between-events",
        "arrival-frame",
        "after-arrival",
        "without-scrollend",
    ] as const) {
        for (const delta of [129.25, -8.633]) {
            it(`keeps native Home at zero through size adjustment ${delta} (${timing}, following: ${following})`, () => {
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
                    onscrollend: null,
                    querySelector: () => null,
                    removeEventListener(type: string, listener: (event: any) => void) {
                        listeners.get(type)?.delete(listener);
                    },
                    scrollBy({ top = 0 }: ScrollToOptions) {
                        writes.push(top);
                        // Chromium can retarget the outstanding native Home trajectory.
                        if (destination !== undefined) destination = Math.max(0, destination + top);
                        else node.scrollTop = Math.max(0, node.scrollTop + top);
                    },
                    scrollHeight: 29618,
                    scrollLeft: 0,
                    scrollTo({ top = 0 }: ScrollToOptions) {
                        node.scrollTop = top;
                        destination = undefined;
                    },
                    scrollTop: 17305,
                    scrollWidth: 400,
                };
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
                        props: {
                            data: Array.from({ length: 300 }),
                            maintainScrollAtEnd: following ? { onDataChange: true, onItemLayout: true } : undefined,
                        },
                        refScroller: {
                            current: { getCurrentScrollOffset: () => node.scrollTop, getScrollableNode: () => node },
                        } as any,
                        scroll: 17305,
                    });
                    ctx.state.scrollAdjustHandler = new ScrollAdjustHandler(ctx);
                    return (
                        <>
                            <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}} />
                            <ScrollAdjust />
                        </>
                    );
                }
                let renderer: TestRenderer.ReactTestRenderer | undefined;
                try {
                    act(() => {
                        renderer = TestRenderer.create(
                            <StateProvider>
                                <Setup />
                            </StateProvider>,
                            { createNodeMock: () => node },
                        );
                    });
                    if (timing === "queued-before-key") {
                        ctx!.values.set("readyToRender", false);
                        act(() => requestAdjust(ctx!, delta, "item-size"));
                    }
                    ctx!.values.set("readyToRender", true);
                    act(() => dispatch("keydown", { defaultPrevented: false, key: "Home" }));
                    destination = 0;
                    // +84ms: the live DOM has advanced 2954px since the last JS observation.
                    const betweenEvents = timing === "between-events" || timing === "queued-before-key";
                    node.scrollTop = betweenEvents ? 10539 : 0;
                    ctx!.state.scroll = betweenEvents ? 13493 : 0;
                    if (timing === "after-arrival") dispatch("scroll");
                    if (timing === "queued-before-key") act(() => clock.tick());
                    else act(() => requestAdjust(ctx!, delta, "item-size"));
                    if (destination !== undefined) node.scrollTop = destination;
                    destination = undefined;
                    if (timing === "without-scrollend") {
                        act(() => dispatch("scroll"));
                        act(() => clock.advance(250));
                    } else act(() => dispatch("scrollend"));
                    expect(ctx!.state.adjustingFromInitialMount ?? 0).toBe(0);
                    expect(writes).toEqual([]);
                    expect(node.scrollTop).toBe(0);
                } finally {
                    act(() => renderer?.unmount());
                    ctx?.state.scheduledWork.dispose();
                    clock.restore();
                    globalThis.ResizeObserver = originalResizeObserver;
                }
            });
        }
    }
}
