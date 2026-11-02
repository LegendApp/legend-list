import * as React from "react";

import { afterEach, expect, it, mock, spyOn } from "bun:test";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import * as mvcp from "../../src/core/mvcp";
import { Platform } from "../../src/platform/Platform";
import { type StateContext, set$ } from "../../src/state/state";
import { setDidLayout } from "../../src/utils/setDidLayout";
import { act, render } from "../helpers/testingLibrary";

let ctx: StateContext;
let Containers: React.ComponentType<any>;

async function setup() {
    Platform.OS = "web";
    Containers = (await import("../../src/components/Containers?initial-end-repro")).Containers;
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (props: any) => {
            ctx = props.scrollAdjustHandler.ctx;
            return <Containers {...props} />;
        },
    }));
    return (await import("../../src/components/LegendList?initial-end-repro")).LegendList;
}

afterEach(() => {
    Platform.OS = "ios";
});

function getBootstrapSession() {
    const session = ctx.state.initialScrollSession;
    return session?.kind === "bootstrap" ? session.bootstrap : undefined;
}

async function settle() {
    await act(async () => {
        for (const item of ctx.state.props.data) {
            ctx.state.sizes.set(item.id, 50);
            ctx.state.sizesKnown.set(item.id, 50);
        }
        setDidLayout(ctx);
        for (let pass = 0; pass < 4; pass++) {
            ctx.state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
        if (ctx.state.scrollingTo?.isInitialScroll) {
            finishScrollTo(ctx);
        }
    });
    for (let frame = 0; frame < 4; frame++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}

it("keeps data anchoring and existing rows stable when appending after initialScrollAtEnd is ready", async () => {
    const LegendList = await setup();
    const data = Array.from({ length: 80 }, (_, index) => ({
        id: `item-${index}`,
    }));
    const mounts: string[] = [];
    const onReady = mock(() => {});
    function Row({ id }: { id: string }) {
        React.useLayoutEffect(() => {
            mounts.push(id);
        }, [id]);
        return <span>{id}</span>;
    }
    const renderItem = ({ item }: { item: { id: string } }) => <Row id={item.id} />;
    const keyExtractor = (item: { id: string }) => item.id;
    const renderList = (items: typeof data) => (
        <LegendList
            data={items}
            drawDistance={1000}
            estimatedItemSize={50}
            estimatedListSize={{ height: 200, width: 320 }}
            getFixedItemSize={() => 50}
            initialScrollAtEnd
            keyExtractor={keyExtractor}
            maintainScrollAtEnd
            maintainVisibleContentPosition
            onReady={onReady}
            recycleItems={false}
            renderItem={renderItem}
        />
    );
    const rendered = render(renderList(data));
    let observedOffset = 0;
    ctx.state.refScroller.current = {
        getCurrentScrollOffset: () => observedOffset,
        getScrollableNode: () => ({}),
        scrollTo: ({ y }: { y: number }) => {
            observedOffset = y;
        },
    } as any;
    await settle();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(ctx.state.didFinishInitialScroll).toBe(true);
    expect(ctx.state.scroll).toBe(3800);
    expect(observedOffset).toBe(3800);
    expect(getBootstrapSession()).toBeUndefined();
    const existingSlots = new Map(ctx.state.containerItemKeys);
    mounts.length = 0;
    const prepareMVCP = spyOn(mvcp, "prepareMVCP");
    const assignments: string[] = [];
    const originalSet = ctx.values.set.bind(ctx.values);
    spyOn(ctx.values, "set").mockImplementation((key, value) => {
        if (key.startsWith("containerItemKey") && typeof value === "string") {
            assignments.push(value);
        }
        return originalSet(key, value);
    });
    await act(async () => {
        set$(ctx, "isAtEnd", true);
        set$(ctx, "isWithinMaintainScrollAtEndThreshold", true);
        rendered.rerender(renderList([...data, { id: "item-80" }]));
    });
    await settle();
    const dataAnchoringPasses = prepareMVCP.mock.calls.filter((call) => call[1] === true).length;
    const retainedSlotsStable = [...existingSlots].every(([id, slot]) => {
        const current = ctx.state.containerItemKeys.get(id);
        return current === slot || current === undefined;
    });
    console.log(
        JSON.stringify({
            assignments,
            dataAnchoringPasses,
            mounts,
            retainedSlotsStable,
        }),
    );
    expect(dataAnchoringPasses).toBeGreaterThan(0);
    expect(mounts).toEqual(["item-80"]);
    expect(assignments.every((id) => id === "item-80")).toBe(true);
    expect(retainedSlotsStable).toBe(true);
    expect(observedOffset).toBe(3850);
    expect(getBootstrapSession()).toBeUndefined();
    rendered.unmount();
});

it("lands at the end when async data arrives before ready", async () => {
    const LegendList = await setup();
    const onReady = mock(() => {});
    const renderList = (data: { id: string }[]) => (
        <LegendList
            data={data}
            estimatedItemSize={50}
            estimatedListSize={{ height: 200, width: 320 }}
            getFixedItemSize={() => 50}
            initialScrollAtEnd
            keyExtractor={(item: { id: string }) => item.id}
            onReady={onReady}
            renderItem={({ item }: { item: { id: string } }) => <span>{item.id}</span>}
        />
    );
    const rendered = render(renderList([]));
    expect(onReady).not.toHaveBeenCalled();
    let observedOffset = 0;
    ctx.state.refScroller.current = {
        getCurrentScrollOffset: () => observedOffset,
        getScrollableNode: () => ({}),
        scrollTo: ({ y }: { y: number }) => {
            observedOffset = y;
        },
    } as any;
    rendered.rerender(renderList(Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}` }))));
    await settle();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(ctx.state.didFinishInitialScroll).toBe(true);
    expect(ctx.state.scroll).toBe(800);
    expect(observedOffset).toBe(800);
    rendered.unmount();
});
