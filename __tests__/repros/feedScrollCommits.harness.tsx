import * as React from "react";
import { Text } from "react-native";

import { spyOn } from "bun:test";
import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { useViewabilityAmount } from "../../src/state/ContextContainer";
import { peek$, type StateContext, useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";
import { installFakeClock } from "../helpers/webScrollHarness";

// Work-count harness for a chat feed: it opens at the end, mixes fixed and
// measured rows, passes a viewability config only so rows can use
// useViewabilityAmount, and swipes once toward older rows. A Profiler around
// the list counts React commits, as the device sample did.
export const VIEWPORT = 956;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 0 };
type Row = { id: string; fixed?: number; height: number };
// Shaped like the device sample: a short thread with one row far taller than its
// estimate, which mounts only when the fling's draw window reaches it.
const TALL_ROW = 14;
const rows: Row[] = Array.from({ length: 30 }, (_, index) => {
    const kind = index % 5;
    return index === TALL_ROW
        ? { height: 1104, id: String(index) }
        : kind === 1
          ? { fixed: 28, height: 28, id: String(index) }
          : kind === 3
            ? { fixed: 44, height: 44, id: String(index) }
            : { height: 80 + ((index * 37) % 200), id: String(index) };
});

let clock: ReturnType<typeof installFakeClock>;
let ctx: StateContext;
let scrollProps: any;

function MediaRow({ item }: { item: Row }) {
    const [visible, setVisible] = React.useState(false);
    useViewabilityAmount(React.useCallback((token) => setVisible(token.sizeVisible > 0), []));
    return <Text>{`${item.id}:${visible}`}</Text>;
}

export const FeedSurface = React.forwardRef(function FeedScrollSurface(props: any, ref: React.Ref<any>) {
    ctx = useStateContext();
    scrollProps = props;
    React.useImperativeHandle(ref, () => ({
        getScrollableNode: () => null,
        getScrollResponder() {
            return this;
        },
        measure: () => {},
        scrollTo: ({ y }: { y: number }) => requestAnimationFrame(() => scrollProps?.onScroll(event(y))),
    }));
    return <>{props.children}</>;
});

function event(y: number) {
    return {
        nativeEvent: {
            contentOffset: { x: 0, y },
            contentSize: { height: ctx.state.totalSize, width: 440 },
            layoutMeasurement: { height: VIEWPORT, width: 440 },
            velocity: { x: 0, y: -1 },
        },
        timeStamp: clock.now,
    };
}

// Native reports each newly mounted measured row once.
function measureMounted() {
    const measurements: { itemKey: string; size: { height: number; width: number } }[] = [];
    const numContainers = peek$(ctx, "numContainers") ?? 0;
    for (let i = 0; i < numContainers; i++) {
        const key = peek$(ctx, `containerItemKey${i}`);
        const row = key === undefined ? undefined : rows[ctx.state.indexByKey.get(key) ?? -1];
        if (key !== undefined && row && !row.fixed && !ctx.state.sizesKnown.has(key)) {
            measurements.push({ itemKey: key, size: { height: row.height, width: 440 } });
        }
    }
    if (measurements.length) updateItemSizesBatch(ctx, measurements);
}

async function frame(ms = 16) {
    await act(async () => {
        clock.advance(ms);
        measureMounted();
    });
}

export function installFeedClock() {
    clock = installFakeClock();
    spyOn(Date, "now").mockImplementation(() => clock.now);
    spyOn(performance, "now").mockImplementation(() => clock.now);
    spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    return clock;
}

// FEED_SWEEP=1 adds a grid of distances with and without momentum, for
// comparing revisions; the default run keeps the two device gestures.
const SWEEP = process.env.FEED_SWEEP === "1";
export const GESTURES: Record<string, { distance: number; dragSteps: number; momentumSteps: number }> = {
    // 3.7.2 device sample: a slow drag that stops, no momentum.
    drag: { distance: 370, dragSteps: 10, momentumSteps: 0 },
    // Candidate device sample: a fling that keeps moving through a long momentum tail.
    fling: { distance: 580, dragSteps: 10, momentumSteps: 70 },
};

if (SWEEP) {
    for (const distance of [150, 300, 450, 600, 800, 1000, 1400]) {
        for (const momentumSteps of [0, 30, 70]) {
            GESTURES[`d${distance}m${momentumSteps}`] = { distance, dragSteps: 10, momentumSteps };
        }
    }
}

// Forwarded to LegendList and its keyboard wrapper alike.
export type FeedListProps = any;

export async function runFeedGesture(
    renderList: (props: FeedListProps) => React.ReactElement,
    gesture: string,
    { recycleItems = false } = {},
) {
    let commits = 0;
    let viewabilityConfig = VIEWABILITY_CONFIG;
    const tree = () => (
        <React.Profiler id="feed" onRender={() => commits++}>
            {renderList({
                alignItemsAtEnd: true,
                data: rows,
                drawDistance: 500,
                estimatedItemSize: 180,
                estimatedListSize: { height: VIEWPORT, width: 440 },
                getFixedItemSize: (item: Row) => item.fixed,
                initialScrollAtEnd: true,
                keyExtractor: (item: Row) => item.id,
                maintainScrollAtEnd: { animated: false, on: { dataChange: true, itemLayout: true, layout: true } },
                maintainVisibleContentPosition: true,
                recycleItems,
                renderItem: ({ item }: { item: Row }) => <MediaRow item={item} />,
                scrollEventThrottle: 16,
                viewabilityConfig,
            })}
        </React.Profiler>
    );
    const rendered = render(tree());
    act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: VIEWPORT, width: 440, x: 0, y: 0 } } }));
    for (let i = 0; i < 60; i++) await frame();
    const start = ctx.state.scroll;
    const startedAtEnd = !ctx.state.sizesKnown.has(String(TALL_ROW)) && start > ctx.state.totalSize - VIEWPORT - 2;

    commits = 0;
    const { distance, dragSteps, momentumSteps } = GESTURES[gesture];
    // Native moves by deltas; MVCP adjustments shift the live offset under the finger.
    const steps = dragSteps + momentumSteps;
    let previousProgress = 0;
    act(() => scrollProps.onScrollBeginDrag(event(start)));
    for (let i = 1; i <= steps; i++) {
        const progress = 1 - (1 - i / steps) ** 3;
        const y = ctx.state.scroll - distance * (progress - previousProgress);
        previousProgress = progress;
        act(() => scrollProps.onScroll(event(y)));
        if (i === dragSteps) {
            act(() => scrollProps.onScrollEndDrag(event(y)));
            if (momentumSteps) act(() => scrollProps.onMomentumScrollBegin(event(y)));
        }
        await frame();
    }
    if (momentumSteps) act(() => scrollProps.onMomentumScrollEnd(event(ctx.state.scroll)));
    for (let i = 0; i < 60; i++) await frame();
    const scrollCommits = commits;

    // An inline config recreated by every parent render must not add commits either.
    commits = 0;
    for (let i = 0; i < 5; i++) {
        viewabilityConfig = { ...VIEWABILITY_CONFIG };
        rendered.rerender(tree());
        await frame();
    }
    const rerenderCommits = commits;

    const result = {
        measuredTallRow: ctx.state.sizesKnown.get(String(TALL_ROW)) === 1104,
        rerenderCommits,
        scrollCommits,
        startedAtEnd,
    };
    if (SWEEP) console.log(`[feed-commits] ${gesture} ${JSON.stringify(result)}`);
    rendered.unmount();
    return result;
}
