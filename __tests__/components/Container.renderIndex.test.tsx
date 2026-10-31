import type * as React from "react";

import { beforeEach, expect, it, mock } from "bun:test";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { resetLayoutCachesForDataChange } from "../../src/core/resetLayoutCachesForDataChange";
import { type StateContext, StateProvider, set$, useArr$, useStateContext } from "../../src/state/state";
import { getRenderedItem } from "../../src/utils/getRenderedItem";
import { createMockContext } from "../__mocks__/createMockContext";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

type Row = { id: string };

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    mock.module("@/components/PositionView", () => {
        const PositionView = ({ children }: { children: React.ReactNode }) => <>{children}</>;
        return { PositionView, PositionViewSticky: PositionView };
    });
});

async function renderReordered(mode: "read" | "later" | "type" | "stable-type") {
    const { Container } = await import("../../src/components/Container?render-index");
    const rows: Row[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const renders: string[] = [];
    const readLater = new Map<string, () => number>();
    let ctx: StateContext | undefined;

    function Slot({ id }: { id: number }) {
        const context = useStateContext();
        const [itemKey] = useArr$([`containerItemKey${id}`]);
        return itemKey === undefined ? null : (
            <Container
                getRenderedItem={(key: string, containerId: number, onReadIndex?: () => void) =>
                    getRenderedItem(context, key, containerId, onReadIndex)
                }
                horizontal={false}
                id={id}
                itemKey={itemKey}
                recycleItems
            />
        );
    }

    function Harness() {
        const context = useStateContext();
        if (!ctx) {
            ctx = Object.assign(
                context,
                createMockContext(
                    { headerSize: 0, numColumns: 1, numContainers: 3, stylePaddingTop: 0, totalSize: 150 },
                    {
                        didContainersLayout: true,
                        props: {
                            data: rows,
                            getFixedItemSize: () => 50,
                            getItemType:
                                mode === "type"
                                    ? (_: Row, index: number) => (index === 0 ? "first" : "row")
                                    : mode === "stable-type"
                                      ? () => "row"
                                      : undefined,
                            keyExtractor: (item: Row) => item.id,
                            renderItem: (info: { item: Row; index: number; type: string }) => {
                                readLater.set(info.item.id, () => info.index);
                                renders.push(
                                    mode === "read"
                                        ? `${info.item.id}:${info.index}`
                                        : mode === "type" || mode === "stable-type"
                                          ? `${info.item.id}:${info.type}`
                                          : info.item.id,
                                );
                                return null;
                            },
                        },
                    },
                ),
            );
            calculateItemsInView(ctx, { dataChanged: true });
        }
        return [0, 1, 2].map((id) => <Slot id={id} key={id} />);
    }

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <StateProvider>
                <Harness />
            </StateProvider>,
        );
    });
    const mounted = [...renders].sort();
    renders.length = 0;

    act(() => set$(ctx!, "numColumns", 2));
    act(() => set$(ctx!, "numColumns", 1));
    const layoutRenders = [...renders].sort();
    renders.length = 0;

    // Same item objects, a and c swap; b keeps index 1.
    act(() => {
        ctx!.state.props.data = [rows[2]!, rows[1]!, rows[0]!];
        resetLayoutCachesForDataChange(ctx!.state);
        calculateItemsInView(ctx!, { dataChanged: true });
    });
    const reordered = renders.sort();

    act(() => renderer.unmount());
    ctx!.state.scheduledWork.dispose();
    const laterIndexes = [...readLater].map(([id, read]) => `${id}:${read()}`).sort();
    return { laterIndexes, layoutRenders, mounted, reordered };
}

it("renders retained rows with their new index after a reorder, and only those rows", async () => {
    const result = await renderReordered("read");
    expect(result.layoutRenders).toEqual([]);
    expect([result.mounted, result.reordered]).toEqual([
        ["a:0", "b:1", "c:2"],
        ["a:2", "c:0"],
    ]);
});

it("does not rerender rows for a new index that renderItem never read, and later reads see it", async () => {
    expect(await renderReordered("later")).toEqual({
        laterIndexes: ["a:2", "b:1", "c:0"],
        layoutRenders: [],
        mounted: ["a", "b", "c"],
        reordered: [],
    });
});

it("rerenders rows for a new index when getItemType receives it", async () => {
    const result = await renderReordered("type");
    expect(result.layoutRenders).toEqual([]);
    expect(result.mounted).toEqual(["a:first", "b:row", "c:row"]);
    expect(result.reordered).toEqual(["a:row", "c:first"]);
});

it("does not rerender rows for a new index when getItemType returns the same type", async () => {
    const result = await renderReordered("stable-type");
    expect(result.mounted).toEqual(["a:row", "b:row", "c:row"]);
    expect(result.reordered).toEqual([]);
    expect(result.laterIndexes).toEqual(["a:2", "b:1", "c:0"]);
});
