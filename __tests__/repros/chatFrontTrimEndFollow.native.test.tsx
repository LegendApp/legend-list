import * as React from "react";
import { Text } from "react-native";

import { afterEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { LegendList } from "../../src/components/LegendList";
import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { getStartOffsetAdjustment } from "../../src/core/getStartOffsetAdjustment";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import { getContentSize } from "../../src/state/getContentSize";
import { peek$, type StateContext, useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";
import { installFakeClock } from "../helpers/webScrollHarness";

// A capped live chat (PR #462 fixture): pinned at the end, append 1-3 messages per tick and
// trim the oldest from the front once the list holds MAX. The newest message must stay fully
// visible at the bottom after every tick, and the newest message before a tick must never jump.
const VIEWPORT = 600;
const MAX = 40;
const TICKS = 50;
const FRAMES_PER_TICK = 15;
const heightOf = (id: number) => [42, 62, 82][id % 3];

type Message = { id: string };

const originalPlatform = Platform.OS;
const restores: (() => void)[] = [];
afterEach(() => {
    for (const restore of restores.splice(0)) restore();
    Platform.OS = originalPlatform;
});

// clampFirst: the shrunk content clamps the offset before the JS scroll adjust lands, instead of after.
async function runChat(platform: "ios" | "android" | "web", mvcpData: boolean, trim: boolean, clampFirst: boolean) {
    Platform.OS = platform;
    const clock = installFakeClock();
    const now = spyOn(Date, "now").mockImplementation(() => clock.now);
    const perf = spyOn(performance, "now").mockImplementation(() => clock.now);
    const dispatch = spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    restores.push(() => {
        dispatch.mockRestore();
        perf.mockRestore();
        now.mockRestore();
        clock.restore();
    });

    let ctx!: StateContext;
    let scrollProps: any;
    let scroll = 0;
    let appliedAdjust = 0;
    let pendingScroll: number | undefined;
    let idCounter = 0;
    const make = (): Message => ({ id: String(++idCounter) });

    const Surface = React.forwardRef(function ScrollSurface(props: any, ref: React.Ref<any>) {
        ctx = useStateContext();
        scrollProps = props;
        React.useImperativeHandle(ref, () => ({
            getScrollableNode: () => null,
            getScrollResponder() {
                return this;
            },
            measure: () => {},
            scrollTo: ({ y }: { y: number }) => {
                pendingScroll = y;
            },
        }));
        return <>{props.children}</>;
    });

    const observe = () =>
        scrollProps.onScroll({
            nativeEvent: {
                contentOffset: { x: 0, y: scroll },
                contentSize: { height: getContentSize(ctx), width: 400 },
                layoutMeasurement: { height: VIEWPORT, width: 400 },
            },
            timeStamp: clock.now,
        });

    const frame = async () => {
        await act(async () => {
            const measurements: { itemKey: string; size: { height: number; width: number } }[] = [];
            for (let i = 0; i < (peek$(ctx, "numContainers") ?? 0); i++) {
                const key = peek$(ctx, `containerItemKey${i}`);
                if (key === undefined || !ctx.state.indexByKey.has(key)) continue;
                const height = heightOf(Number(key));
                if (ctx.state.sizesKnown.get(key) !== height) {
                    measurements.push({ itemKey: key, size: { height, width: 400 } });
                }
            }
            if (measurements.length) updateItemSizesBatch(ctx, measurements);
            if (clampFirst) {
                const maxFirst = Math.max(0, getContentSize(ctx) - VIEWPORT);
                if (scroll > maxFirst + 0.5) {
                    scroll = maxFirst;
                    observe();
                }
            }
            const adjust = peek$(ctx, "scrollAdjust") ?? 0;
            if (adjust !== appliedAdjust) {
                scroll += adjust - appliedAdjust;
                appliedAdjust = adjust;
                observe();
            }
            if (pendingScroll !== undefined) {
                scroll = pendingScroll;
                pendingScroll = undefined;
                observe();
            }
            const maxScroll = Math.max(0, getContentSize(ctx) - VIEWPORT);
            if (scroll > maxScroll + 0.5) {
                scroll = maxScroll;
                observe();
            }
            clock.advance(16);
        });
    };

    // Screen y of an item's bottom edge, relative to the viewport top.
    const screenBottom = (key: string) => {
        const index = ctx.state.indexByKey.get(key);
        if (index === undefined) return undefined;
        const top = ctx.state.positions[index];
        const size = ctx.state.sizes.get(key);
        if (top === undefined || size === undefined) return undefined;
        return getStartOffsetAdjustment(ctx) + top + size - scroll;
    };

    let messages: Message[] = Array.from({ length: 10 }, make);
    const list = (data: Message[]) => (
        <LegendList
            alignItemsAtEnd
            data={data}
            estimatedItemSize={48}
            keyExtractor={(item: Message) => item.id}
            maintainScrollAtEnd
            maintainScrollAtEndThreshold={0.1}
            maintainVisibleContentPosition={{ data: mvcpData }}
            recycleItems
            renderItem={({ item }: { item: Message }) => <Text>{item.id}</Text>}
            renderScrollComponent={(props: any) => <Surface {...props} />}
        />
    );
    const rendered = render(list(messages));
    act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: VIEWPORT, width: 400, x: 0, y: 0 } } }));
    for (let i = 0; i < 40; i++) await frame();

    const failures: string[] = [];
    let trimmedTicks = 0;
    for (let tick = 0; tick < TICKS; tick++) {
        const tracked = messages[messages.length - 1].id;
        const before = screenBottom(tracked)!;
        const batch = 1 + (idCounter % 3);
        let next = [...messages, ...Array.from({ length: batch }, make)];
        if (trim && next.length > MAX) {
            next = next.slice(next.length - MAX);
            trimmedTicks++;
        }
        const appended = next.slice(-batch).reduce((sum, m) => sum + heightOf(Number(m.id)), 0);
        messages = next;
        act(() => rendered.rerender(list(messages)));
        // The previously newest row may move up by at most the appended height and never down.
        let worstJump = 0;
        for (let f = 0; f < FRAMES_PER_TICK; f++) {
            await frame();
            const y = screenBottom(tracked);
            if (y === undefined) continue;
            const delta = y - before;
            const jump = delta > 0 ? delta : Math.max(0, -delta - appended);
            worstJump = Math.max(worstJump, jump);
        }
        const last = messages[messages.length - 1].id;
        const gap = VIEWPORT - (screenBottom(last) ?? Number.NaN);
        if (!(Math.abs(gap) <= 1)) {
            failures.push(
                `tick ${tick} (len ${messages.length}, last #${last}): newest bottom off by ${gap.toFixed(1)}px, scroll ${scroll.toFixed(1)}, end ${(getContentSize(ctx) - VIEWPORT).toFixed(1)}, following ${peek$(ctx, "isFollowingEnd")}, withinThreshold ${peek$(ctx, "isWithinMaintainScrollAtEndThreshold")}`,
            );
        }
        if (worstJump > 1) {
            failures.push(
                `tick ${tick} (len ${messages.length}): previous newest #${tracked} jumped ${worstJump.toFixed(1)}px`,
            );
        }
    }
    rendered.unmount();
    return { failures, trimmedTicks };
}

describe.each(["ios", "android", "web"] as const)("capped chat end following (%s)", (platform) => {
    it.each([
        ["append only, mvcp data true", true, false, false],
        ["append + front trim, mvcp data true", true, true, false],
        ["append + front trim, mvcp data true, clamp first", true, true, true],
        ["append + front trim, mvcp data false", false, true, false],
        ["append + front trim, mvcp data false, clamp first", false, true, true],
    ] as const)("%s", async (_name, mvcpData, trim, clampFirst) => {
        const { failures, trimmedTicks } = await runChat(platform, mvcpData, trim, clampFirst);
        if (trim) expect(trimmedTicks).toBeGreaterThan(20);
        expect(failures.slice(0, 8)).toEqual([]);
    });
});
