import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import * as screenReader from "../../src/platform/screenReader";
import { peek$, type StateContext, useStateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";
import { installFakeClock } from "../helpers/webScrollHarness";

const suspended = new Promise<void>(() => {});
function SuspenseGate({ hidden }: { hidden: boolean }) {
    if (hidden) throw suspended;
    return null;
}

let clock: ReturnType<typeof installFakeClock> | undefined;

async function advanceTime(ms: number) {
    await act(async () => clock!.advance(ms));
}

async function flushFrames() {
    for (let i = 0; i < 12; i++) {
        await act(async () => {
            if (clock) clock.tick(0);
            else await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}

async function waitForWrites(writes: unknown[], timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    while (writes.length === 0 && Date.now() < deadline) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 25));
        });
    }
    // Let any trailing writes from the settled follow land before asserting.
    await flushFrames();
}

async function mountFollowingList(listOptions?: {
    echoCommands?: boolean;
    itemCount?: number;
    itemSize?: number;
    mvcpData?: boolean;
    onScroll?: () => void;
    viewportSize?: number;
}) {
    const itemSize = listOptions?.itemSize ?? 50;
    const viewportSize = listOptions?.viewportSize ?? 300;
    const initialCount = listOptions?.itemCount ?? 20;
    const initialEnd = initialCount * itemSize - viewportSize;
    const { LegendList } = await import("../../src/components/LegendList");
    const ref = React.createRef<LegendListRef>();
    let ctx: StateContext;
    let scrollProps: any;
    const writes: Array<{ animated: boolean; y: number }> = [];
    const events: string[] = [];
    const onUserScroll = mock(() => {});
    // Keep the list, layout, follow scheduling, and gesture handlers real.
    // Substitute only the native view, recording its imperative scroll commands.
    const ScrollSurface = React.forwardRef(function MomentumScrollSurface(props: any, forwardedRef: React.Ref<any>) {
        ctx = useStateContext();
        scrollProps = props;
        React.useImperativeHandle(forwardedRef, () => ({
            getScrollResponder() {
                return this;
            },
            measure: () => {},
            scrollTo: (options: { animated: boolean; y: number }) => {
                writes.push(options);
                if (listOptions?.echoCommands) requestAnimationFrame(() => nativeEcho(options.y));
            },
        }));
        return <>{props.children}</>;
    });
    const list = (itemCount: number, prependCount = 0) => (
        <LegendList
            data={Array.from({ length: itemCount + prependCount }, (_, id) => ({ id: String(id - prependCount) }))}
            estimatedItemSize={itemSize}
            getFixedItemSize={() => itemSize}
            keyExtractor={(item: { id: string }) => item.id}
            maintainScrollAtEnd
            maintainScrollAtEndThreshold={0.25}
            maintainVisibleContentPosition={listOptions?.mvcpData ? { data: true, size: true } : undefined}
            onMomentumScrollBegin={() => events.push("momentumBegin")}
            onMomentumScrollEnd={() => events.push("momentumEnd")}
            onScroll={listOptions?.onScroll}
            onScrollBeginDrag={() => events.push("dragBegin")}
            onScrollEndDrag={() => events.push("dragEnd")}
            onScrollToTop={() => events.push("scrollToTop")}
            onUserScroll={onUserScroll}
            recycleItems={false}
            ref={ref}
            renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
            renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
        />
    );
    let count = initialCount;
    let prepended = 0;
    let hidden = false;
    const tree = () => (
        <React.Suspense fallback={null}>
            {list(count, prepended)}
            <SuspenseGate hidden={hidden} />
        </React.Suspense>
    );
    const rendered = render(tree());
    await flushFrames();
    act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: viewportSize, width: 300, x: 0, y: 0 } } }));
    await flushFrames();
    const event = (y: number) => ({
        nativeEvent: {
            contentOffset: { x: 0, y },
            contentSize: { height: (count + prepended) * itemSize, width: 300 },
            layoutMeasurement: { height: viewportSize, width: 300 },
            velocity: { x: 0, y: -1 },
        },
        timeStamp: Date.now(),
    });
    function nativeEcho(y: number) {
        scrollProps.onScroll(event(y));
    }
    const scroll = (y: number) => act(() => scrollProps.onScroll(event(y)));
    scroll(initialEnd);
    await flushFrames();
    expect(ref.current?.getState().isAtEnd).toBe(true);
    writes.length = 0;

    return {
        append: async (amount = 1) => {
            count += amount;
            rendered.rerender(tree());
            await flushFrames();
        },
        beginDrag: () => act(() => scrollProps.onScrollBeginDrag(event(initialEnd))),
        beginMomentum: () => act(() => scrollProps.onMomentumScrollBegin(event(initialEnd - 10))),
        context: () => ctx,
        endDrag: (offset = ctx.state.scroll) => act(() => scrollProps.onScrollEndDrag(event(offset))),
        endMomentum: (offset = ref.current!.getState().scroll) =>
            act(() => scrollProps.onMomentumScrollEnd(event(offset))),
        events,
        onUserScroll,
        // Prepending shifts the reader's offset through MVCP, so the growth is
        // already served and must not become settle-time follow credit.
        prepend: async (amount: number) => {
            prepended += amount;
            rendered.rerender(tree());
            await flushFrames();
        },
        ref,
        scroll,
        scrollToTop: () => act(() => scrollProps.onScrollToTop(event(0))),
        setSuspended: (next: boolean, appendCount = 0) => {
            count += appendCount;
            hidden = next;
            rendered.rerender(tree());
        },
        unmount: rendered.unmount,
        writes,
    };
}

describe.each([false, true])("native end following during momentum (screen reader %s)", (enabled) => {
    beforeEach(() => {
        spyOn(screenReader, "isScreenReaderEnabled").mockReturnValue(enabled);
        // Bun resolves .ts by default; Metro resolves this dependency to .native.ts.
        spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    });

    describe("deterministic settlement timing", () => {
        beforeEach(() => {
            clock = installFakeClock();
            spyOn(Date, "now").mockImplementation(() => clock!.now);
        });

        afterEach(() => {
            clock!.restore();
            clock = undefined;
        });

        it.each([690, 500])("recovers dropped momentum-end across Suspense at offset %s", async (offset) => {
            const list = await mountFollowingList();
            try {
                const ctx = list.context();
                const { state } = ctx;
                list.beginDrag();
                list.scroll(offset);
                list.endDrag();
                list.beginMomentum();
                await list.append();
                expect(list.writes).toEqual([]);
                expect(state.isMomentumScrolling).toBe(true);

                list.setSuspended(true);
                expect(state.isUnmounted).toBe(true);
                expect(peek$(ctx, "isScrollActive")).toBe(true);
                // A hidden list must not dispatch even after the recovery window.
                await advanceTime(600);
                expect(list.writes).toEqual([]);
                list.setSuspended(false);
                expect(list.context()).toBe(ctx);
                expect(state.isUnmounted).toBe(false);
                expect(peek$(ctx, "isScrollActive")).toBe(true);

                // No momentum-end arrives. Near-end growth must recover, while a
                // reader who flicked away must retain their position.
                await advanceTime(100);
                await flushFrames();
                expect(state.isMomentumScrolling).toBe(false);
                expect(peek$(ctx, "isScrollActive")).toBe(offset === 690);
                expect(list.writes.map(({ y }) => y)).toEqual(offset === 690 ? [750] : []);
                expect(list.events).toEqual(["dragBegin", "dragEnd", "momentumBegin"]);
                if (offset === 690) list.scroll(750);
                await flushFrames();
                expect(peek$(ctx, "isScrollActive")).toBe(false);
                list.writes.length = 0;
                await list.append();
                expect(list.writes.map(({ y }) => y)).toEqual(offset === 690 ? [800] : []);
            } finally {
                list.unmount();
            }
        });

        it.each([0, 150])("follows 150px growth after momentum begins %sms after release", async (delay) => {
            const list = await mountFollowingList();
            try {
                list.beginDrag();
                list.scroll(690);
                list.endDrag();
                if (delay) {
                    await advanceTime(delay);
                }
                expect(list.writes).toEqual([]);
                list.beginMomentum();
                await list.append(3);
                expect(list.writes.map(({ y }) => y)).toEqual(delay ? [850] : []);
                list.endMomentum(690);
                await flushFrames();
                expect(list.writes.map(({ y }) => y)).toEqual([850]);
            } finally {
                list.unmount();
            }
        });

        it.each(["late-away-delivered", "late-away-dropped", "late-hidden-dropped"])(
            "preserves the settled reader outcome for %s",
            async (scenario) => {
                const list = await mountFollowingList();
                try {
                    list.beginDrag();
                    list.scroll(690);
                    list.endDrag();
                    await advanceTime(150);
                    list.beginMomentum();
                    if (scenario === "late-hidden-dropped") {
                        list.setSuspended(true);
                        await advanceTime(650);
                        list.setSuspended(false);
                        await flushFrames();
                        await advanceTime(1200);
                        expect(list.context().state.isMomentumScrolling).toBe(false);
                        expect(peek$(list.context(), "isScrollActive")).toBe(false);
                        list.scroll(700);
                        await flushFrames();
                        list.scroll(400);
                    } else {
                        list.scroll(400);
                        if (scenario === "late-away-delivered") list.endMomentum(400);
                        await advanceTime(1200);
                        await flushFrames();
                    }
                    list.writes.length = 0;
                    await list.append(3);
                    await advanceTime(250);
                    await flushFrames();
                    expect(list.writes.map(({ y }) => y)).toEqual([]);
                    expect(list.ref.current!.getState().scroll).toBe(400);
                    expect(list.context().state.isMomentumScrolling).toBe(false);
                    expect(peek$(list.context(), "isScrollActive")).toBe(false);
                } finally {
                    list.unmount();
                }
            },
        );

        it("rearms a completed near-end request after release without snapping before growth", async () => {
            const list = await mountFollowingList();
            try {
                list.beginDrag();
                list.scroll(690);
                list.endDrag();
                act(() => {
                    void list.ref.current!.scrollToOffset({ animated: false, offset: 690 });
                });
                await flushFrames();
                list.scroll(690);
                await flushFrames();
                await advanceTime(1200);
                expect(list.writes.map(({ y }) => y)).toEqual([690]);
                list.writes.length = 0;
                await list.append(3);
                await advanceTime(250);
                await flushFrames();
                expect(list.writes.map(({ y }) => y)).toEqual([850]);
                expect(list.ref.current!.getState().scroll).toBe(850);
                expect(peek$(list.context(), "isScrollActive")).toBe(false);
            } finally {
                list.unmount();
            }
        });

        it("preserves an away reader when growth arrives before late momentum settles", async () => {
            const list = await mountFollowingList();
            try {
                list.beginDrag();
                list.scroll(690);
                list.endDrag();
                await advanceTime(150);
                list.beginMomentum();
                list.scroll(400);
                await list.append(3);
                expect(list.context().state.isMomentumScrolling).toBe(true);
                expect(list.writes).toEqual([]);
                expect(list.ref.current!.getState().scroll).toBe(400);
                list.endMomentum(400);
                await flushFrames();
                expect(list.writes).toEqual([]);
                expect(list.ref.current!.getState().scroll).toBe(400);
            } finally {
                list.unmount();
            }
        });

        it("preserves immediate reader movement through repeated late-momentum hide/reveal", async () => {
            const list = await mountFollowingList();
            try {
                list.beginDrag();
                list.scroll(690);
                list.endDrag();
                await advanceTime(150);
                list.beginMomentum();
                for (let i = 0; i < 2; i++) {
                    list.setSuspended(true);
                    expect(list.context().state.scheduledWork.has("endFollowRearm")).toBe(false);
                    list.setSuspended(false);
                    await flushFrames();
                    // Consume the historical reveal command, then move before the watchdog.
                    list.scroll(700);
                    await flushFrames();
                    expect(list.context().state.scrollingTo).toBeUndefined();
                    expect(list.context().state.maintainingScrollAtEnd).toBeUndefined();
                    list.writes.length = 0;
                    list.scroll(400);
                    expect(list.context().state.isMomentumScrolling).toBe(true);
                    await list.append(3);
                    expect(list.writes).toEqual([]);
                    expect(list.ref.current!.getState().scroll).toBe(400);
                }
                await advanceTime(1200);
                expect(list.context().state.isMomentumScrolling).toBe(false);
                expect(peek$(list.context(), "isScrollActive")).toBe(false);
                expect(list.writes).toEqual([]);
                expect(list.ref.current!.getState().scroll).toBe(400);
            } finally {
                list.unmount();
            }
        });

        it.each([false, true])(
            "rearms a completed near-end request after momentum (end delivered: %s)",
            async (endDelivered) => {
                const list = await mountFollowingList();
                try {
                    list.beginDrag();
                    list.scroll(690);
                    list.endDrag();
                    list.beginMomentum();
                    let result: unknown = "pending";
                    act(() => {
                        void list.ref.current!.scrollToOffset({ animated: false, offset: 690 }).then((value) => {
                            result = value;
                        });
                    });
                    await flushFrames();
                    list.scroll(690);
                    await flushFrames();
                    expect(result).toBeUndefined();
                    if (endDelivered) list.endMomentum(690);
                    await advanceTime(1200);
                    expect(list.writes.map(({ y }) => y)).toEqual([690]);
                    list.writes.length = 0;
                    await list.append(3);
                    expect(list.writes.map(({ y }) => y)).toEqual([850]);
                    expect(list.ref.current!.getState().scroll).toBe(850);
                    expect(result).toBeUndefined();
                } finally {
                    list.unmount();
                }
            },
        );

        for (const settleBeforeAppend of [false, true]) {
            it.each(["away-then-near", "away-release-then-end"])(
                `follows a baseline-free near return: %s (settle before append: ${settleBeforeAppend})`,
                async (scenario) => {
                    const list = await mountFollowingList({ echoCommands: true });
                    try {
                        list.beginDrag();
                        list.scroll(scenario === "away-then-near" ? 690 : 400);
                        list.endDrag();
                        await advanceTime(150);
                        list.beginMomentum();
                        if (scenario === "away-then-near") list.scroll(400);
                        list.scroll(scenario === "away-then-near" ? 690 : 700);
                        if (settleBeforeAppend) list.endMomentum(list.context().state.scroll);
                        expect(list.writes).toEqual([]);
                        await list.append(3);
                        if (!settleBeforeAppend) list.endMomentum(list.context().state.scroll);
                        await advanceTime(1200);
                        await flushFrames();
                        expect(list.writes.map(({ y }) => y)).toEqual([850]);
                        expect(list.context().state.scroll).toBe(850);
                        expect(list.context().state.isMomentumScrolling).toBe(false);
                        expect(peek$(list.context(), "isScrollActive")).toBe(false);
                    } finally {
                        list.unmount();
                    }
                },
            );
        }

        it.each([690, 400])("settles a captured-ref request while hidden at %s", async (offset) => {
            const list = await mountFollowingList({ echoCommands: true });
            const handle = list.ref.current!;
            try {
                list.setSuspended(true);
                await flushFrames();
                expect(list.context().state.isUnmounted).toBe(true);
                expect(await handle.scrollToOffset({ animated: false, offset })).toBeUndefined();
                expect(list.writes).toEqual([]);
                list.setSuspended(false);
                await flushFrames();
                // The ordinary reveal maintenance is independent of the rejected request.
                expect(list.writes.map(({ y }) => y)).toEqual([700]);
                expect(list.context().state.scroll).toBe(700);
                expect(list.context().state.scrollingTo).toBeUndefined();
            } finally {
                list.unmount();
            }
        });

        it.each([false, true])("retains a 27px initial gap through growth (late momentum: %s)", async (late) => {
            const list = await mountFollowingList({ echoCommands: true, itemSize: 27 });
            try {
                list.beginDrag();
                list.scroll(213);
                list.endDrag();
                await advanceTime(150);
                if (late) list.beginMomentum();
                expect(list.writes).toEqual([]);
                await list.append(3);
                await advanceTime(1200);
                await flushFrames();
                expect(list.writes.map(({ y }) => y)).toEqual([321]);
                expect(list.context().state.scroll).toBe(321);
            } finally {
                list.unmount();
            }
        });

        it("keeps following suspended past 100ms while native scroll events flow", async () => {
            const list = await mountFollowingList();
            try {
                list.beginDrag();
                list.scroll(690);
                list.endDrag();
                await list.append(3);
                for (let i = 0; i < 4; i++) {
                    await advanceTime(60);
                    list.scroll(690);
                }
                expect(clock!.now).toBe(240);
                expect(list.writes).toEqual([]);
                list.beginMomentum();
                list.endMomentum(690);
                await flushFrames();
                expect(list.writes.map(({ y }) => y)).toEqual([850]);
            } finally {
                list.unmount();
            }
        });
    });

    it("reports one drag gesture through momentum, and one status-bar gesture", async () => {
        const list = await mountFollowingList();
        expect(list.onUserScroll).not.toHaveBeenCalled();
        list.beginDrag();
        list.scroll(650);
        list.endDrag();
        list.beginMomentum();
        list.scroll(500);
        list.endMomentum();
        expect(list.onUserScroll).toHaveBeenCalledTimes(1);
        list.scrollToTop();
        expect(list.onUserScroll).toHaveBeenCalledTimes(2);
        list.unmount();
    });

    it("releases end following after a status-bar scroll and preserves the app callback", async () => {
        const list = await mountFollowingList();
        act(() => {
            void list.ref.current!.scrollToEnd({ animated: false });
        });
        await flushFrames();
        list.scroll(700);
        await flushFrames();
        expect(list.ref.current!.getState().isFollowingEnd).toBe(true);
        list.writes.length = 0;
        list.scroll(650);
        list.scroll(400);
        list.scroll(0);
        // UIKit can finish well after its last rounded/subpixel scroll frame.
        const completedAt = Date.now() + 1000;
        spyOn(Date, "now").mockReturnValue(completedAt);
        list.scrollToTop();
        await list.append();
        expect(list.ref.current!.getState().isFollowingEnd).toBe(false);
        expect(list.ref.current!.getState().scroll).toBe(0);
        expect(list.writes).toEqual([]);
        expect(list.events).toEqual(["scrollToTop"]);
        expect(list.onUserScroll).toHaveBeenCalledTimes(1);
        list.scrollToTop();
        expect(list.onUserScroll).toHaveBeenCalledTimes(2);
        list.unmount();
    });

    it("accepts accessibility input after a drag with no momentum pair settles", async () => {
        const list = await mountFollowingList();
        try {
            list.beginDrag();
            list.endDrag();
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 150));
            });
            list.scroll(700);
            list.scroll(650);
            list.scroll(500);
            expect(list.onUserScroll).toHaveBeenCalledTimes(enabled ? 2 : 1);
        } finally {
            list.unmount();
        }
    });

    it("treats scrollToOffset as a list-owned scroll that replaces an in-flight scroll", async () => {
        const list = await mountFollowingList();
        const handle = list.ref.current!;
        try {
            let keyedSettled = false;
            act(() => {
                void handle.scrollToKey({ animated: true, key: "2" }).then(() => {
                    keyedSettled = true;
                });
            });
            await flushFrames();
            expect(list.writes.map(({ y }) => y)).toEqual([100]);
            list.scroll(600);

            let placedSettled = false;
            act(() => {
                void handle.scrollToOffset({ animated: true, offset: 300 }).then(() => {
                    placedSettled = true;
                });
            });
            await flushFrames();
            expect(keyedSettled).toBe(true);
            expect(placedSettled).toBe(false);
            // The new animated target takes over the motion directly, without a plain stop.
            expect(list.writes.map(({ y }) => y)).toEqual([100, 300]);
            expect(handle.getState().isFollowingEnd).toBe(false);

            list.scroll(300);
            await flushFrames();
            expect(placedSettled).toBe(true);
            await list.append();
            expect(list.writes.map(({ y }) => y)).toEqual([100, 300]);

            // Landing within the end threshold resumes following as before.
            placedSettled = false;
            act(() => {
                void handle.scrollToOffset({ animated: false, offset: 750 }).then(() => {
                    placedSettled = true;
                });
            });
            await flushFrames();
            list.scroll(750);
            await flushFrames();
            expect(placedSettled).toBe(true);
            expect(handle.getState().isFollowingEnd).toBe(true);
            list.writes.length = 0;
            await list.append();
            expect(list.writes.map(({ y }) => y)).toEqual([800]);
        } finally {
            list.unmount();
        }
    });

    it("settles an active end request on unmount", async () => {
        const list = await mountFollowingList();
        list.scroll(200);
        let result: unknown = "pending";
        act(() => {
            void list.ref.current!.scrollToEnd({ animated: true }).then((value) => {
                result = value;
            });
        });
        await flushFrames();
        expect(result).toBe("pending");
        list.unmount();
        await Promise.resolve();
        expect(result).toBeUndefined();
    });

    for (const queued of [true, false]) {
        for (const interruption of ["status-bar", "drag"] as const) {
            it(`cancels a ${queued ? "queued" : "running"} explicit scrollToEnd on ${interruption} interruption`, async () => {
                const list = await mountFollowingList();
                try {
                    list.scroll(200);
                    let result: unknown = "pending";
                    const interrupt = () => {
                        list.scroll(0);
                        if (interruption === "status-bar") list.scrollToTop();
                        else list.beginDrag();
                    };
                    act(() => {
                        void list.ref.current!.scrollToEnd({ animated: true }).then((value) => {
                            result = value;
                        });
                        if (queued) {
                            expect(list.writes).toEqual([]);
                            interrupt();
                        }
                    });
                    if (!queued) {
                        await flushFrames();
                        expect(result).toBe("pending");
                        expect(list.writes.some(({ y }) => y === 700)).toBe(true);
                        interrupt();
                    }
                    await flushFrames();
                    expect(result).toBeUndefined();
                    expect(list.events).toContain(interruption === "status-bar" ? "scrollToTop" : "dragBegin");
                    expect(list.ref.current!.getState().isFollowingEnd).toBe(false);
                    list.writes.length = 0;
                    if (interruption === "drag") list.endDrag();
                    await list.append();
                    expect(list.writes).toEqual([]);
                    expect(list.ref.current!.getState().scroll).toBe(0);
                } finally {
                    list.unmount();
                }
            });
        }
    }

    it("does not pull a flick back to the end when data arrives after finger release", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        await list.append();

        expect(list.writes).toEqual([]);
        // The flick continues beyond the follow threshold. Settling must not replay it.
        list.scroll(600);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        expect(list.events).toEqual(["dragBegin", "dragEnd", "momentumBegin", "momentumEnd"]);
        list.unmount();
    });

    it("suspends following when the drag reaches the end before momentum begins", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.scroll(700);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        expect(list.writes).toEqual([]);
        list.scroll(600);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        list.unmount();
    });

    it("resumes deferred following only if the flick settles near the end", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        expect(list.writes).toEqual([]);

        list.endMomentum();
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it("does not treat programmatic momentum as a user flick", async () => {
        const list = await mountFollowingList();
        // A stationary drag can leave a pending momentum expectation. A later
        // explicit scroll owns its own native momentum events.
        list.beginDrag();
        list.endDrag();
        act(() => {
            void list.ref.current!.scrollToEnd({ animated: false });
        });
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([700]);
        list.scroll(700);
        await flushFrames();
        list.writes.length = 0;
        list.beginMomentum();
        await list.append();
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.endMomentum();
        expect(list.events).toEqual(["dragBegin", "dragEnd", "momentumBegin", "momentumEnd"]);
        list.unmount();
    });

    it("classifies a flick that interrupts an active programmatic scroll as user momentum", async () => {
        const list = await mountFollowingList();
        // Main cancels the animated request at drag start. The released drag
        // must still own subsequent native momentum and deferred following.
        act(() => {
            void list.ref.current!.scrollToOffset({ animated: true, offset: 400 });
        });
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([400]);
        list.writes.length = 0;

        // The user grabs the moving list and flicks back toward the end.
        list.beginDrag();
        list.scroll(500);
        list.endDrag();
        list.beginMomentum();
        await list.append();

        // Passing through the cancelled target must not resume following mid-flick.
        list.scroll(400);
        await flushFrames();
        expect(list.writes).toEqual([]);

        // The flick settles inside the end threshold, so the deferred follow
        // is recomputed against the final offset and runs exactly once.
        list.scroll(690);
        list.endMomentum();
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it("suspends following from finger release until a flick begins", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        // Rows arrive before the native momentum-begin event. The release must
        // already be treated as user momentum, not as an idle end follow.
        await list.append();
        expect(list.writes).toEqual([]);
        list.unmount();
    });

    it("resumes following when momentum never arrives after a release", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        await list.append();
        expect(list.writes).toEqual([]);
        // Native can drop or never emit the momentum pair (for example a
        // stationary release on iOS, or a release at a clamped edge), so the
        // safety timeout must resume the deferred follow.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 150));
        });
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it("recovers end following when momentum-end never arrives after a begin", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        // The flick suspends following while it moves.
        expect(list.writes).toEqual([]);
        // Android can abort the fling at an edge and drop the momentum-end
        // event. With the native scroll silent past the stall window, the
        // flick must be considered settled and the deferred follow recomputed.
        await waitForWrites(list.writes);
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        // Ownership is fully released: the follow's own momentum completes and
        // a later append follows again without waiting for any gesture.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
        });
        list.writes.length = 0;
        await list.append();
        expect(list.writes.length).toBeGreaterThan(0);
        list.unmount();
    });

    it("follows content growth that arrived while the flick was in flight", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        // Two appends grow the content past the follow threshold (100px vs 75px)
        // while the flick is still in flight. The flick itself stays inside the
        // threshold, so the growth is the reader's own end-follow intent, not a
        // user move away from the end: settling must follow it.
        await list.append();
        await list.append();
        expect(list.writes).toEqual([]);
        list.endMomentum();
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([800]);
        list.unmount();
    });

    it("does not follow when the flick settles away from the end despite growth", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        await list.append();
        // The flick itself ends 100px away from the end, beyond the threshold
        // even after discounting the growth. Settling must not steal that move.
        list.scroll(600);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        list.unmount();
    });

    it("does not credit growth that MVCP already carried the reader through", async () => {
        const list = await mountFollowingList({ mvcpData: true });
        // Standard chat-with-history: the reader scrolled 200px up from the end
        // and flicks upward while older messages prepend above them.
        list.scroll(500);
        await flushFrames();
        list.beginDrag();
        list.scroll(400);
        list.endDrag();
        list.beginMomentum();
        // 500px prepend: MVCP carries the reader through it, so the 500px of
        // growth leaves their 500px distance-from-end unchanged at settle.
        // Crediting it as unserved follow intent (500 - 500 <= 75 threshold)
        // would drag them to the end against a deliberate upward flick.
        await list.prepend(10);
        list.scroll(700);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        list.unmount();
    });

    it("follows after a cancelled request and a near-end momentum settle", async () => {
        const list = await mountFollowingList();
        act(() => {
            void list.ref.current!.scrollToOffset({ animated: true, offset: 400 });
        });
        await flushFrames();
        list.writes.length = 0;
        // Interrupt the request and settle inside the end threshold without
        // ever reaching its target, so nothing else can finish it.
        list.beginDrag();
        list.scroll(650);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        list.scroll(690);
        list.endMomentum();
        await flushFrames();
        // The cancelled request cannot block the deferred follow.
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it("follows after a cancelled request and a stationary release", async () => {
        const list = await mountFollowingList();
        act(() => {
            void list.ref.current!.scrollToOffset({ animated: true, offset: 400 });
        });
        await flushFrames();
        list.writes.length = 0;
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        await list.append();
        expect(list.writes).toEqual([]);
        // No momentum pair arrives; the bounded release window resumes following.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 150));
        });
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it.each([690, 500])("settles released-drag growth across Suspense before momentum at offset %s", async (offset) => {
        const list = await mountFollowingList();
        try {
            const ctx = list.context();
            const { state } = ctx;
            list.beginDrag();
            list.scroll(offset);
            list.endDrag();
            await list.append(3);
            expect(state.isMomentumScrolling).toBe(false);
            expect(list.writes).toEqual([]);

            list.setSuspended(true);
            expect(state.isUnmounted).toBe(true);
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 150));
            });
            expect(list.writes).toEqual([]);
            list.setSuspended(false);
            expect(list.context()).toBe(ctx);
            expect(state.isUnmounted).toBe(false);

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 150));
            });
            await flushFrames();
            expect(list.writes.map(({ y }) => y)).toEqual(offset === 690 ? [850] : []);
            if (offset === 690) list.scroll(850);
            await flushFrames();
            expect(peek$(ctx, "isFollowingEnd")).toBe(offset === 690);
            expect(peek$(ctx, "isScrollActive")).toBe(false);
            list.writes.length = 0;
            await list.append();
            expect(list.writes.map(({ y }) => y)).toEqual(offset === 690 ? [900] : []);
        } finally {
            list.unmount();
        }
    });

    it.each([7433, 7200])(
        "settles growth when momentum ends while Suspense hides layout effects at offset %s",
        async (offset) => {
            const list = await mountFollowingList({ itemCount: 100, itemSize: 80, viewportSize: 500 });
            const handle = list.ref.current!;
            // Keep render-range projection independent of wall-clock scheduling:
            // the drag starts after idle, then UIKit delivers one last frame 1ms later.
            let now = Date.now() + 2000;
            spyOn(Date, "now").mockImplementation(() => now);
            try {
                list.beginDrag();
                list.scroll(offset + 14);
                list.endDrag();
                list.beginMomentum();
                // Commit an append and the fallback together, as an app's native
                // momentum-begin callback can do. Hidden layout effects cannot follow.
                list.setSuspended(true, 1);
                expect(list.ref.current).toBeNull();
                expect(handle.getState().contentLength).toBe(8000);
                // UIKit can still deliver its final frame and end to the hidden view.
                now += 1;
                list.scroll(offset);
                expect(handle.getState().contentLength).toBe(8080);
                list.endMomentum(offset);
                expect(list.events).toEqual(["dragBegin", "dragEnd", "momentumBegin", "momentumEnd"]);
                expect(list.writes).toEqual([]);
                await flushFrames();
                expect(list.writes).toEqual([]);
                list.setSuspended(false);
                await act(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 150));
                });
                await flushFrames();
                // Credit the appended 80px for the reader 67px from the old end,
                // inside the 125px threshold, while preserving a reader farther away.
                expect(list.writes.map(({ y }) => y)).toEqual(offset === 7433 ? [7580] : []);
                if (offset === 7433) list.scroll(7580);
                await flushFrames();
                expect(handle.getState().isFollowingEnd).toBe(offset === 7433);
                list.writes.length = 0;
                await list.append();
                expect(list.writes.map(({ y }) => y)).toEqual(offset === 7433 ? [7660] : []);
            } finally {
                list.unmount();
            }
        },
    );

    it("follows after a cancelled request and dropped momentum-end", async () => {
        const list = await mountFollowingList();
        act(() => {
            void list.ref.current!.scrollToOffset({ animated: true, offset: 400 });
        });
        await flushFrames();
        list.writes.length = 0;
        list.beginDrag();
        list.scroll(650);
        list.endDrag();
        list.beginMomentum();
        list.scroll(690);
        await list.append();
        expect(list.writes).toEqual([]);
        // Dropped momentum-end recovery must resume the deferred follow.
        await waitForWrites(list.writes);
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it.each([false, true])("preserves a near-end release without growth (momentum: %s)", async (momentum) => {
        const list = await mountFollowingList();
        try {
            list.beginDrag();
            list.scroll(690);
            list.endDrag();
            if (momentum) list.beginMomentum();
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, momentum ? 650 : 150));
            });
            await flushFrames();
            expect(list.writes).toEqual([]);
            expect(list.ref.current!.getState().isFollowingEnd).toBe(true);
            expect(peek$(list.context(), "isScrollActive")).toBe(false);
            await list.append();
            expect(list.writes.map(({ y }) => y)).toEqual([750]);
        } finally {
            list.unmount();
        }
    });

    it.each([false, true])(
        "preserves reader movement after late momentum settles (end delivered: %s)",
        async (endDelivered) => {
            const list = await mountFollowingList();
            try {
                list.beginDrag();
                list.scroll(690);
                list.endDrag();
                await act(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 150));
                });
                expect(peek$(list.context(), "isScrollActive")).toBe(false);
                list.beginMomentum();
                if (endDelivered) list.endMomentum(690);
                await act(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 650));
                });
                expect(list.writes).toEqual([]);
                // Accessibility scroll actions can move the reader without a drag.
                list.scroll(400);
                await list.append();
                expect(list.ref.current!.getState().scroll).toBe(400);
                expect(list.ref.current!.getState().isFollowingEnd).toBe(false);
                expect(list.writes).toEqual([]);
            } finally {
                list.unmount();
            }
        },
    );

    it("preserves reader movement after an explicit request and dropped momentum end", async () => {
        const list = await mountFollowingList();
        try {
            list.beginDrag();
            list.scroll(690);
            list.endDrag();
            list.beginMomentum();
            act(() => {
                void list.ref.current!.scrollToEnd({ animated: false });
            });
            await flushFrames();
            list.scroll(700);
            await flushFrames();
            expect(list.writes.map(({ y }) => y)).toEqual([700]);
            list.writes.length = 0;
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 1200));
            });
            list.scroll(400);
            await list.append();
            expect(list.writes).toEqual([]);
            expect(list.ref.current!.getState().scroll).toBe(400);
        } finally {
            list.unmount();
        }
    });

    for (const offset of [690, 500]) {
        for (const growth of [0, 3]) {
            it(`settles hidden momentum at ${offset} with ${growth} appended rows`, async () => {
                const list = await mountFollowingList();
                const handle = list.ref.current!;
                try {
                    list.beginDrag();
                    list.scroll(offset);
                    list.endDrag();
                    list.beginMomentum();
                    list.setSuspended(true, growth);
                    list.endMomentum(offset);
                    expect(list.writes).toEqual([]);
                    list.setSuspended(false);
                    await flushFrames();
                    expect(handle.getState().isFollowingEnd).toBe(offset === 690);
                    // Reveal also follows without growth on the released baseline.
                    expect(list.writes.map(({ y }) => y)).toEqual(offset === 690 ? [700 + growth * 50] : []);
                } finally {
                    list.unmount();
                }
            });
        }
    }

    it.each(["drag", "momentum"] as const)(
        "synchronizes the final %s offset without emitting public scroll events",
        async (event) => {
            const onScroll = mock(() => {});
            const list = await mountFollowingList({ onScroll });
            onScroll.mockClear();
            try {
                list.beginDrag();
                expect(onScroll).not.toHaveBeenCalled();
                list.scroll(500);
                list.endDrag(event === "drag" ? 690 : 500);
                if (event === "drag") expect(list.context().state.scroll).toBe(690);
                expect(onScroll).toHaveBeenCalledTimes(1);
                list.beginMomentum();
                await list.append(3);
                list.endMomentum(680);
                expect(list.context().state.scroll).toBe(680);
                expect(onScroll).toHaveBeenCalledTimes(1);
                await flushFrames();
                expect(list.writes.map(({ y }) => y)).toEqual([850]);
            } finally {
                list.unmount();
            }
        },
    );
});
