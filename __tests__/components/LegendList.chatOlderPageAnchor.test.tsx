import * as React from "react";
import { Animated, Text } from "react-native";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { installListRegistry, type ListCtx } from "../../examples-shared/layoutInvariants";
import { batchItemSizeUpdates } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import { getContentSize } from "../../src/state/getContentSize";
import { listen$, peek$, type StateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types.base";
import { skipLayoutInvariants } from "../helpers/layoutInvariantHarness";
import TestRenderer, { act } from "../helpers/testRenderer";
import { installFakeClock } from "../helpers/webScrollHarness";
import { registerBaseModuleMocks } from "../setup";

// A chat list opened at its end pages older history in at the top. Day pills are keyed by the
// first loaded message of their day, so an older page that ends inside the current first day
// replaces that pill: the row that was at index 0 disappears and a new pill precedes the
// prepended part of the day. The first message of the old content must keep its on-screen y.
const WIDTH = 402;
const VIEWPORT = 658;
const PILL = 36.333333333333336;

type Row = { id: string; type: "date_pill" | "default"; day: number };

interface Scenario {
    days: number[];
    initialMessages: number;
    pages: number[];
    platform: "ios" | "android";
    sizeOf: (id: string) => number;
    sticky: boolean;
}

let scrollProps: any;

const device = {
    clamp(value: number) {
        const content = device.ctx ? getContentSize(device.ctx) : 0;
        return Math.max(0, Math.min(value, content - VIEWPORT));
    },
    ctx: undefined as StateContext | undefined,
    event() {
        const content = device.ctx ? getContentSize(device.ctx) : 0;
        return {
            nativeEvent: {
                contentInset: { bottom: 0, left: 0, right: 0, top: 0 },
                contentOffset: { x: 0, y: device.offset },
                contentSize: { height: content, width: WIDTH },
                layoutMeasurement: { height: VIEWPORT, width: WIDTH },
                velocity: { x: 0, y: 0 },
            },
            timeStamp: Date.now(),
        };
    },
    offset: 0,
    pendingEvent: false,
    reset() {
        device.ctx = undefined;
        device.offset = 0;
        device.pendingEvent = false;
    },
    scroller: {
        flashScrollIndicators: () => {},
        getCurrentScrollOffset: () => device.offset,
        getScrollableNode: () => ({}),
        getScrollEventTarget: () => null,
        getScrollResponder: () => null,
        measure: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, WIDTH, VIEWPORT),
        scrollTo: ({ y = 0 }: { animated?: boolean; y?: number }) => {
            device.offset = device.clamp(y);
            device.pendingEvent = true;
        },
        scrollToEnd: () => device.scroller.scrollTo({ y: Number.MAX_SAFE_INTEGER }),
    },
};

const DeviceScrollView = React.forwardRef(function DeviceScrollViewComponent(props: any, ref: React.Ref<unknown>) {
    scrollProps = props;
    React.useImperativeHandle(ref, () => device.scroller, []);
    return <>{props.children}</>;
});
const renderScrollComponent = (props: any) => <DeviceScrollView {...props} />;

// History: message ids sorted oldest first, grouped into days.
function makeHistory(days: number[]) {
    const messages: { id: string; day: number }[] = [];
    days.forEach((count, day) => {
        for (let i = 0; i < count; i++) messages.push({ day, id: `m${String(messages.length).padStart(4, "0")}` });
    });
    return messages;
}

function toRows(messages: { id: string; day: number }[]): Row[] {
    const rows: Row[] = [];
    let day = -1;
    for (const message of messages) {
        if (message.day !== day) {
            day = message.day;
            rows.push({ day, id: `date-${message.id}`, type: "date_pill" });
        }
        rows.push({ day, id: message.id, type: "default" });
    }
    return rows;
}

async function runChat(scenario: Scenario) {
    Platform.OS = scenario.platform;
    const history = makeHistory(scenario.days);
    let loaded = history.length - scenario.initialMessages;
    let rows = toRows(history.slice(loaded));
    const sizes = (row: Row) => (row.type === "date_pill" ? PILL : scenario.sizeOf(row.id));
    const lists = new Set<ListCtx>();
    const uninstall = installListRegistry(lists);
    const clock = installFakeClock();
    const ref = React.createRef<LegendListRef>();
    const { LegendList } = await import("../../src/components/LegendList?chat-older-page-anchor");
    const renderList = () => (
        <LegendList
            alignItemsAtEnd
            contentContainerStyle={{ paddingBottom: 16 }}
            data={rows}
            drawDistance={350}
            getFixedItemSize={(row: Row) => (row.type === "date_pill" ? PILL : undefined)}
            getItemType={(row: Row) => row.type}
            initialScrollAtEnd
            keyExtractor={(row: Row) => row.id}
            maintainScrollAtEnd={{ animated: true }}
            maintainVisibleContentPosition
            onEndReachedThreshold={0.1}
            onStartReached={() => {}}
            recycleItems
            ref={ref}
            renderItem={({ item }: { item: Row }) => <Text>{item.id}</Text>}
            renderScrollComponent={renderScrollComponent}
            stickyHeaderIndices={
                scenario.sticky ? rows.flatMap((row, index) => (row.type === "date_pill" ? [index] : [])) : undefined
            }
        />
    );

    let renderer: TestRenderer.ReactTestRenderer | undefined;
    let lastAdjust = 0;
    let unlisten: (() => void) | undefined;
    const measured = new WeakSet<object>();
    const measure = () => {
        const ctx = device.ctx;
        if (!ctx || !renderer) return;
        const views = renderer.root.findAll(
            (node) => typeof node.type !== "string" && typeof node.props.id === "number" && !!node.props.refView,
        );
        batchItemSizeUpdates(() => {
            for (const view of views) {
                const key = peek$(ctx, `containerItemKey${view.props.id}`);
                if (key === undefined) continue;
                const index = ctx.state.indexByKey.get(key);
                const row = index === undefined ? undefined : rows[index];
                if (!row || row.id !== key) continue;
                const size = sizes(row);
                if (ctx.state.sizesKnown.get(key) !== size || !measured.has(view)) {
                    measured.add(view);
                    view.props.onLayout?.({ nativeEvent: { layout: { height: size, width: WIDTH, x: 0, y: 0 } } });
                }
            }
        });
    };
    const frame = async () => {
        await act(async () => {
            if (!device.ctx) {
                device.ctx = [...lists][0] as StateContext | undefined;
                if (device.ctx) {
                    unlisten = listen$(device.ctx, "scrollAdjust", (value) => {
                        const delta = (value || 0) - lastAdjust;
                        lastAdjust = value || 0;
                        if (delta) {
                            device.offset = device.clamp(device.offset + delta);
                            device.pendingEvent = true;
                        }
                    });
                }
            }
            if (device.pendingEvent || device.offset !== device.clamp(device.offset)) {
                device.offset = device.clamp(device.offset);
                device.pendingEvent = false;
                scrollProps?.onScroll?.(device.event());
            }
            measure();
            clock.tick(16);
            await Promise.resolve();
        });
    };
    const frames = async (count: number) => {
        for (let i = 0; i < count; i++) await frame();
    };
    const screenY = (key: string) => {
        const ctx = device.ctx!;
        const index = ctx.state.indexByKey.get(key);
        const position = ref.current!.getState().positionAtIndex(index!);
        return position - device.offset;
    };

    const drifts: { page: number; before: number; after: number; maxAbs: number }[] = [];
    try {
        await act(async () => {
            renderer = TestRenderer.create(renderList());
        });
        await act(async () => {
            scrollProps?.onLayout?.({ nativeEvent: { layout: { height: VIEWPORT, width: WIDTH, x: 0, y: 0 } } });
        });
        await frames(60);
        for (let page = 0; page < scenario.pages.length; page++) {
            // Pull to the top: drag begin, an instant native scrollTo(0), drag end.
            await act(async () => scrollProps?.onScrollBeginDrag?.(device.event()));
            await act(async () => ref.current!.getNativeScrollRef()!.scrollTo({ animated: false, y: 0 } as any));
            await frames(6);
            await act(async () => scrollProps?.onScrollEndDrag?.(device.event()));
            await frames(60);
            const anchorRow = rows.find((row) => row.type === "default")!;
            const before = screenY(anchorRow.id);
            // The app's loader finishes: older messages are prepended and day pills re-keyed.
            loaded = Math.max(0, loaded - scenario.pages[page]!);
            rows = toRows(history.slice(loaded));
            await act(async () => renderer!.update(renderList()));
            let maxAbs = 0;
            for (let i = 0; i < 90; i++) {
                await frame();
                maxAbs = Math.max(maxAbs, Math.abs(screenY(anchorRow.id) - before));
            }
            drifts.push({ after: screenY(anchorRow.id), before, maxAbs, page: page + 1 });
        }
    } finally {
        unlisten?.();
        await act(async () => renderer?.unmount());
        clock.restore();
        uninstall();
        device.reset();
    }
    return drifts;
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    skipLayoutInvariants();
    (Animated.Value.prototype as any).interpolate = (config: unknown) => ({ __interpolation: config });
});

afterEach(() => {
    Platform.OS = "ios";
    delete (Animated.Value.prototype as any).interpolate;
});

// Deterministic message heights: a sender header, plain bubbles and taller wrapped/media rows.
function messageSize(seed: number) {
    return (id: string) => {
        const n = Number(id.slice(1)) * 7919 + seed;
        const pick = n % 11;
        return pick === 0 ? 84.33333333333333 : pick === 1 ? 69.625 : pick === 2 ? 152.66666666666666 : 65.625;
    };
}

// Page edges inside a day re-key that day's pill; an edge on a day boundary keeps it.
const HISTORIES = {
    "day-edge pages": { days: [50, 40, 52, 59, 67, 30, 64], initialMessages: 94, pages: [67, 59, 52] },
    "mid-day page edges": { days: [40, 60, 30, 45, 25, 50, 35, 40, 30, 28], initialMessages: 95, pages: [48, 54, 62] },
    "short days, four pages": {
        days: Array.from({ length: 40 }, (_, i) => 6 + ((i * 5) % 9)),
        initialMessages: 90,
        pages: [52, 59, 67, 40],
    },
} as const;

describe("older-page prepend keeps the first old row on screen", () => {
    for (const [history, config] of Object.entries(HISTORIES)) {
        for (const platform of ["ios", "android"] as const) {
            for (const sticky of [true, false]) {
                for (const seed of [3, 8]) {
                    it(`${history}, ${platform}, sticky ${sticky ? "on" : "off"}, sizes ${seed}`, async () => {
                        const drifts = await runChat({
                            days: [...config.days],
                            initialMessages: config.initialMessages,
                            pages: [...config.pages],
                            platform,
                            sizeOf: messageSize(seed),
                            sticky,
                        });
                        expect(drifts.length).toBe(config.pages.length);
                        for (const { after, before, maxAbs, page } of drifts) {
                            // 3.7.3 holds this row within 0.75 pt on device.
                            expect({ page, settled: Math.abs(after - before) <= 1 }).toEqual({
                                page,
                                settled: true,
                            });
                            expect({ page, transient: maxAbs <= 1 }).toEqual({ page, transient: true });
                        }
                    }, 60_000);
                }
            }
        }
    }
});
