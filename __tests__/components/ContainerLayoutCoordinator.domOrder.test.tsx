import type * as React from "react";

import { afterEach, expect, it } from "bun:test";
import "../setup";

import { ContainerLayoutCoordinator } from "../../src/components/ContainerLayoutCoordinator";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { resetLayoutCachesForDataChange } from "../../src/core/resetLayoutCachesForDataChange";
import { updateScroll } from "../../src/core/updateScroll";
import { Platform } from "../../src/platform/Platform";
import { peek$, type StateContext, StateProvider, useStateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";
import TestRenderer, { act } from "../helpers/testRenderer";

const originalPlatform = Platform.OS;
let renderer: TestRenderer.ReactTestRenderer | undefined;
let ctx: StateContext | undefined;

afterEach(() => {
    act(() => renderer?.unmount());
    ctx?.state.scheduledWork.dispose();
    ctx = undefined;
    renderer = undefined;
    Platform.OS = originalPlatform;
});

function setup(count: number, platform: typeof Platform.OS = "web") {
    Platform.OS = platform;
    // Physical order of every container element; unallocated slots are not rendered.
    const order: HTMLElement[] = [];
    const ids = new Map<HTMLElement, number>();
    let moves = 0;
    let unsortedMeasurements = 0;
    const move = (element: HTMLElement, before: HTMLElement | null) => {
        moves++;
        order.splice(order.indexOf(element), 1);
        order.splice(before ? order.indexOf(before) : order.length, 0, element);
    };
    const parent = {
        appendChild: (element: HTMLElement) => move(element, null),
        get children() {
            return order.filter((element) => peek$(ctx!, `containerItemKey${ids.get(element)}`) !== undefined);
        },
        getRootNode: () => ({ activeElement: null }),
        insertBefore: move,
        isConnected: true,
        moveBefore: move,
    } as unknown as HTMLDivElement;
    const indices = () =>
        Array.from(parent.children, (element) => peek$(ctx!, `containerItemIndex${ids.get(element)}`));
    const isSorted = () => indices().every((index, i, all) => i === 0 || all[i - 1]! < index!);

    function Probe() {
        const context = useStateContext();
        if (!ctx) {
            ctx = Object.assign(
                context,
                createMockContext(
                    { headerSize: 0, numColumns: 1, numContainers: 20, stylePaddingTop: 0, totalSize: count * 50 },
                    {
                        didContainersLayout: true,
                        props: {
                            data: Array.from({ length: count }, (_, i) => ({ id: `row-${i}` })),
                            getFixedItemSize: () => 50,
                            keyExtractor: (item: { id: string }) => item.id,
                        },
                    },
                ),
            );
            for (let id = 0; id < 20; id++) {
                const element = {
                    getBoundingClientRect: () => {
                        unsortedMeasurements += isSorted() ? 0 : 1;
                        return { height: 50, width: 100 };
                    },
                    getRootNode: parent.getRootNode,
                    parentElement: parent,
                } as unknown as HTMLElement;
                order.push(element);
                ids.set(element, id);
                ctx.viewRefs.set(id, { current: element } as React.RefObject<any>);
            }
            calculateItemsInView(ctx, { dataChanged: true });
            // Start from a physical order that disagrees with item order.
            order.reverse();
        }
        return <ContainerLayoutCoordinator>{null}</ContainerLayoutCoordinator>;
    }

    act(() => {
        renderer = TestRenderer.create(
            <StateProvider>
                <Probe />
            </StateProvider>,
        );
    });
    const context = ctx!;
    return {
        indices,
        isSorted,
        get moves() {
            return moves;
        },
        scroll: (offset: number) => act(() => updateScroll(context, offset, false, { fromNativeScrollEvent: true })),
        setData: (data: { id: string }[]) =>
            act(() => {
                context.state.props.data = data;
                resetLayoutCachesForDataChange(context.state);
                calculateItemsInView(context, { dataChanged: true });
            }),
        get unsortedMeasurements() {
            return unsortedMeasurements;
        },
    };
}

it("orders rows in the same commit when retained rows swap order", () => {
    const s = setup(2);
    s.setData([{ id: "row-1" }, { id: "row-0" }]);
    expect(s.indices()).toEqual([0, 1]);
    const moves = s.moves;
    s.setData([{ id: "row-0" }, { id: "row-1" }]);
    expect(s.indices()).toEqual([0, 1]);
    expect(s.moves).toBe(moves + 1);
});

it("orders rows in the same commit when data is replaced with new keys", () => {
    const s = setup(4);
    s.setData(Array.from({ length: 4 }, (_, i) => ({ id: `new-${3 - i}` })));
    expect(s.isSorted()).toBe(true);
    expect(s.unsortedMeasurements).toBe(0);
});

it("keeps rows in order on every frame while scrolling recycles containers", () => {
    const s = setup(200);
    for (const offset of [100, 400, 900, 2000, 2050, 2100, 1500, 300, 0]) {
        s.scroll(offset);
        expect(s.isSorted()).toBe(true);
    }
    expect(s.unsortedMeasurements).toBe(0);
    // Only recycled rows move once order is established.
    const moves = s.moves;
    s.scroll(50);
    s.scroll(100);
    expect(s.moves - moves).toBeLessThanOrEqual(2);
});

it("does not reorder on native", () => {
    const s = setup(2, "ios");
    s.setData([{ id: "row-1" }, { id: "row-0" }]);
    expect(s.moves).toBe(0);
});
