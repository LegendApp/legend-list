import { afterEach, expect, it, mock } from "bun:test";
import { batchItemSizeUpdates, updateItemSizes } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { setDidLayout } from "../../src/utils/setDidLayout";
import { act, render } from "../helpers/testingLibrary";

const VIEWPORT = 200;
const ESTIMATE = 100;

let ctx: StateContext;
let listProps: any;

async function setup() {
    Platform.OS = "ios";
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (props: any) => {
            listProps = props;
            ctx = props.scrollAdjustHandler.ctx;
            return null;
        },
    }));
    return (await import("../../src/components/LegendList?initial-end-measured-growth")).LegendList;
}

afterEach(() => {
    Platform.OS = "ios";
});

async function flushFrames(count: number) {
    for (let frame = 0; frame < count; frame++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}

function mountedKeys() {
    return [...ctx.state.containerItemKeys.keys()].filter((id) => ctx.state.indexByKey.get(id) !== undefined);
}

async function measure(itemKeys: string[], height: number) {
    await act(async () => {
        batchItemSizeUpdates(() => {
            for (const itemKey of itemKeys) {
                updateItemSizes(ctx, { itemKey, size: { height, width: 320 } });
            }
        });
    });
}

it("reveals initialScrollAtEnd at the measured end when rows outgrow estimates during the initial scroll", async () => {
    const LegendList = await setup();
    const data = Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}` }));
    // UIKit applies a non-animated scrollTo at once, but JS only learns the offset from a later event.
    let nativeOffset = 0;
    let reportedOffset = 0;
    let offsetAtLoad: number | undefined;
    const renderList = (items: typeof data) => (
        <LegendList
            data={items}
            estimatedItemSize={ESTIMATE}
            estimatedListSize={{ height: VIEWPORT, width: 320 }}
            initialScrollAtEnd
            keyExtractor={(item: { id: string }) => item.id}
            maintainScrollAtEnd={{ animated: false, on: { itemLayout: true } }}
            maintainVisibleContentPosition={false}
            onLoad={() => {
                offsetAtLoad = nativeOffset;
            }}
            recycleItems={false}
            renderItem={({ item }: { item: { id: string } }) => <span>{item.id}</span>}
        />
    );
    // Data arriving after mount makes the end landing a dispatched scroll rather than a mount seed.
    const rendered = render(renderList([]));
    ctx.state.refScroller.current = {
        getCurrentScrollOffset: () => reportedOffset,
        getScrollableNode: () => ({}),
        scrollTo: ({ y }: { y: number }) => {
            nativeOffset = Math.max(0, Math.min(y, ctx.state.totalSize - VIEWPORT));
        },
        scrollToEnd: () => {},
    } as any;
    const deliverScrollEvent = async () => {
        reportedOffset = nativeOffset;
        await act(async () => {
            listProps.onScroll({
                nativeEvent: {
                    contentOffset: { x: 0, y: nativeOffset },
                    contentSize: { height: ctx.state.totalSize, width: 320 },
                    layoutMeasurement: { height: VIEWPORT, width: 320 },
                },
            });
        });
    };

    await act(async () => {
        rendered.rerender(renderList(data));
    });
    await measure(mountedKeys(), ESTIMATE);
    await act(async () => {
        setDidLayout(ctx);
    });
    for (let pass = 0; pass < 6 && !ctx.state.scrollingTo; pass++) {
        await measure(mountedKeys(), ESTIMATE);
        await act(async () => {
            ctx.state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });
        await flushFrames(1);
    }
    expect(ctx.state.scrollingTo?.isInitialScroll).toBe(true);
    expect(nativeOffset).toBe(20 * ESTIMATE - VIEWPORT);

    // Before the landing is reported, the mounted rows above the last one measure taller.
    const grownKeys = mountedKeys().filter((id) => ctx.state.indexByKey.get(id)! >= 14 && id !== "item-19");
    expect(grownKeys).toHaveLength(5);
    await measure(grownKeys, ESTIMATE + 100);
    const measuredEnd = ctx.state.totalSize - VIEWPORT;
    expect(measuredEnd).toBe(20 * ESTIMATE + 500 - VIEWPORT);

    // Let the completion fallback (100ms checks) run, so a stale landing reveals instead of hanging.
    for (let pass = 0; pass < 10 && offsetAtLoad === undefined; pass++) {
        await deliverScrollEvent();
        await flushFrames(2);
        if (offsetAtLoad === undefined) {
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 120));
            });
        }
    }

    expect(offsetAtLoad).toBe(measuredEnd);
    expect(nativeOffset).toBe(measuredEnd);
    rendered.unmount();
});
