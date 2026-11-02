import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import { peek$, type StateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types";
import TestRenderer, { act } from "../helpers/testRenderer";

let lastListProps: any;
let scrollToIndexCalls: any[] = [];
const handlerInstances: ScrollAdjustHandler[] = [];

const suspended = new Promise<void>(() => {});
function SuspenseGate({ hidden }: { hidden: boolean }) {
    if (hidden) throw suspended;
    return null;
}

function registerImperativeScrollMocks() {
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (props: any) => {
            lastListProps = props;
            return null;
        },
    }));

    mock.module("@/core/ScrollAdjustHandler", () => {
        return {
            ScrollAdjustHandler: class {
                context: StateContext;
                appliedAdjust = 0;
                pendingAdjust = 0;
                mounted = false;
                constructor(ctx: StateContext) {
                    this.context = ctx;
                    handlerInstances.push(this as any);
                }
                requestAdjust() {}
                setMounted() {
                    this.mounted = true;
                }
                getAdjust() {
                    return this.appliedAdjust;
                }
                commitPendingAdjust() {}
            },
        };
    });

    mock.module("@/core/scrollToIndex", () => ({
        scrollToIndex: (_ctx: unknown, params: any) => {
            scrollToIndexCalls.push(params);
        },
    }));
}

function createData(length: number) {
    return Array.from({ length }, (_value, index) => ({
        id: `item-${index}`,
        label: `Item ${index}`,
    }));
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function getStateFromRender() {
    for (let i = 0; i < 5; i++) {
        const handler = lastListProps?.scrollAdjustHandler ?? handlerInstances.at(-1);
        if (handler) {
            return (handler as any).context.state as StateContext["state"];
        }
        await flushAsync();
    }
    throw new Error("scrollAdjustHandler not found after retries");
}

beforeEach(() => {
    registerImperativeScrollMocks();
    handlerInstances.length = 0;
    lastListProps = undefined;
    scrollToIndexCalls = [];
});

describe("LegendList imperative scrolls", () => {
    it.each([false, true])("clears cancelled activity across Suspense reconnect (queued: %s)", async (queued) => {
        const { LegendList } = await import("../../src/components/LegendList?imperative-scroll-suspense-activity");
        const data = createData(100);
        const ref = React.createRef<LegendListRef>();
        const list = (hidden: boolean) => (
            <React.Suspense fallback={null}>
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    getFixedItemSize={() => 100}
                    recycleItems={false}
                    ref={ref}
                    renderItem={() => null}
                />
                <SuspenseGate hidden={hidden} />
            </React.Suspense>
        );
        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(list(false));
            });
            const ctx = lastListProps.scrollAdjustHandler.context as StateContext;
            const { state } = ctx;
            if (queued) state.didColumnsChange = true;
            const settled = mock();
            const request = ref.current!.scrollToOffset({ animated: true, offset: 5000 });
            void request.then(settled);
            expect(peek$(ctx, "isScrollActive")).toBe(true);
            expect(state.pendingScrollResolve).toBeDefined();
            expect(ctx.scrollRequestTracker!.isWaitingToRun()).toBe(queued);
            expect(state.scheduledWork.has("imperativeScrollReady")).toBe(queued);
            if (queued) {
                expect(state.scrollingTo).toBeUndefined();
            } else {
                expect(state.scrollingTo).toMatchObject({ animated: true, offset: 5000 });
            }

            act(() => renderer!.update(list(true)));
            expect(state.isUnmounted).toBe(true);
            expect(state.pendingScrollResolve).toBeUndefined();
            expect(state.scrollingTo).toBeUndefined();
            expect(state.scheduledWork.has("imperativeScrollReady")).toBe(false);
            expect(ctx.scrollRequestTracker!.isWaitingToRun()).toBe(false);
            expect(peek$(ctx, "isScrollActive")).toBe(false);
            expect(await request).toBeUndefined();

            state.didColumnsChange = false;
            act(() => renderer!.update(list(false)));
            await flushAsync();
            expect(lastListProps.scrollAdjustHandler.context).toBe(ctx);
            expect(state.isUnmounted).toBe(false);
            expect(state.pendingScrollResolve).toBeUndefined();
            expect(state.scrollingTo).toBeUndefined();
            expect(peek$(ctx, "isScrollActive")).toBe(false);
            expect(settled).toHaveBeenCalledTimes(1);
        } finally {
            act(() => renderer?.unmount());
        }
    });

    for (const method of [
        "scrollToIndex",
        "scrollToOffset",
        "scrollToItem",
        "scrollToKey",
        "scrollToEnd",
        "scrollIndexIntoView",
        "scrollItemIntoView",
    ] as const) {
        it(`settles a captured ${method} while Suspense hides the list without replaying it`, async () => {
            const { LegendList } = await import("../../src/components/LegendList?hidden-ref-navigation");
            const data = createData(100);
            const ref = React.createRef<LegendListRef>();
            const tree = (hidden: boolean) => (
                <React.Suspense fallback={null}>
                    <LegendList data={data} estimatedItemSize={100} ref={ref} renderItem={() => null} />
                    <SuspenseGate hidden={hidden} />
                </React.Suspense>
            );
            let renderer: ReturnType<typeof TestRenderer.create>;
            act(() => {
                renderer = TestRenderer.create(tree(false));
            });
            const captured = ref.current!;
            const ctx = lastListProps.scrollAdjustHandler.context as StateContext;
            act(() => renderer!.update(tree(true)));
            const settled = mock(() => {});
            void captured[method]({ animated: true, index: 50, item: data[50], key: "item-50", offset: 5000 }).then(
                settled,
            );
            await flushAsync();
            expect(settled).toHaveBeenCalledTimes(1);
            expect(ctx.state.scrollingTo).toBeUndefined();
            expect(scrollToIndexCalls).toHaveLength(0);
            act(() => renderer!.update(tree(false)));
            await flushAsync();
            expect(ctx.state.scrollingTo).toBeUndefined();
            expect(scrollToIndexCalls).toHaveLength(0);
            expect(settled).toHaveBeenCalledTimes(1);
            act(() => renderer!.unmount());
        });
    }

    it("resolves scrollToEnd against data committed after the imperative call", async () => {
        const { LegendList } = await import("../../src/components/LegendList?imperative-scroll-commit");
        let sendMessage: () => void = () => {};

        function Harness() {
            const [data, setData] = React.useState(() => createData(2));
            const listRef = React.useRef<LegendListRef>(null);

            sendMessage = () => {
                setData((current) => [...current, { id: `item-${current.length}`, label: `Item ${current.length}` }]);
                listRef.current?.scrollToEnd({ animated: false });
            };

            return (
                <LegendList
                    data={data}
                    estimatedItemSize={50}
                    getFixedItemSize={() => 50}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    ref={listRef}
                    renderItem={() => null}
                />
            );
        }

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(<Harness />);
        });
        const state = await getStateFromRender();
        expect(state.props.data.length).toBe(2);

        await act(async () => {
            sendMessage();
        });

        expect(state.props.data.length).toBe(3);
        expect(scrollToIndexCalls).toEqual([
            expect.objectContaining({
                animated: false,
                index: 2,
                viewPosition: 1,
            }),
        ]);

        await act(async () => {
            renderer?.unmount();
        });
    });

    it("coalesces batched scrollToEnd requests onto the latest committed data", async () => {
        const { LegendList } = await import("../../src/components/LegendList?imperative-scroll-batched-commit");
        let sendBurst: () => void = () => {};
        const scrollPromises: Promise<void>[] = [];

        function Harness() {
            const [data, setData] = React.useState(() => createData(2));
            const listRef = React.useRef<LegendListRef>(null);

            sendBurst = () => {
                setData((current) => [...current, { id: `item-${current.length}`, label: `Item ${current.length}` }]);
                scrollPromises.push(listRef.current!.scrollToEnd({ animated: true }));
                setData((current) => [...current, { id: `item-${current.length}`, label: `Item ${current.length}` }]);
                scrollPromises.push(listRef.current!.scrollToEnd({ animated: true }));
            };

            return (
                <LegendList
                    data={data}
                    estimatedItemSize={50}
                    getFixedItemSize={() => 50}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    ref={listRef}
                    renderItem={() => null}
                />
            );
        }

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(<Harness />);
        });
        const state = await getStateFromRender();

        await act(async () => {
            sendBurst();
        });
        await Promise.all(scrollPromises);

        expect(state.props.data.length).toBe(4);
        expect(scrollPromises).toHaveLength(2);
        expect(scrollToIndexCalls).toEqual([
            expect.objectContaining({
                animated: true,
                index: 3,
                viewPosition: 1,
            }),
        ]);

        await act(async () => {
            renderer?.unmount();
        });
    });
});
