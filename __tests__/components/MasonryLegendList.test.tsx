import * as React from "react";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import type { StateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types.base";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

const handlerInstances: ScrollAdjustHandler[] = [];
let lastListProps: any;

function registerMasonryListMocks() {
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (props: any) => {
            lastListProps = props;
            return null;
        },
    }));

    mock.module("@/core/ScrollAdjustHandler", () => ({
        ScrollAdjustHandler: class {
            context: StateContext;

            constructor(ctx: StateContext) {
                this.context = ctx;
                handlerInstances.push(this as any);
            }

            requestAdjust() {}
            setMounted() {}
            getAdjust() {
                return 0;
            }
            commitPendingAdjust() {}
        },
    }));
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    registerMasonryListMocks();
    handlerInstances.length = 0;
    lastListProps = undefined;
});

describe("MasonryLegendList", () => {
    it("places each item in the shortest column", async () => {
        const { LegendList } = await import("../../src/components/LegendList?masonry-shortest-column-core");
        mock.module("@legendapp/list/react-native", () => ({ LegendList }));
        const { MasonryLegendList } = await import("../../src/integrations/masonry?shortest-column");
        const ref = React.createRef<LegendListRef>();
        const data = [
            { height: 100, id: "a" },
            { height: 200, id: "b" },
            { height: 50, id: "c" },
            { height: 60, id: "d" },
        ];

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(
                <MasonryLegendList
                    data={data}
                    getFixedItemSize={(item) => item.height}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    recycleItems={false}
                    ref={ref}
                    renderItem={() => null}
                />,
            );
        });

        const state = ref.current?.getState();
        expect([0, 1, 2, 3].map((index) => state?.positionAtIndex(index))).toEqual([0, 0, 100, 150]);
        expect(state?.contentLength).toBe(210);

        await act(async () => {
            renderer?.unmount();
        });
    });

    it("reflows downstream items when an estimated item is measured", async () => {
        const { LegendList } = await import("../../src/components/LegendList?masonry-dynamic-size-core");
        mock.module("@legendapp/list/react-native", () => ({ LegendList }));
        const { MasonryLegendList } = await import("../../src/integrations/masonry?dynamic-size");
        const ref = React.createRef<LegendListRef>();
        const data = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(
                <MasonryLegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    recycleItems={false}
                    ref={ref}
                    renderItem={() => null}
                />,
            );
        });

        expect([0, 1, 2, 3].map((index) => ref.current?.getState().positionAtIndex(index))).toEqual([0, 0, 100, 100]);

        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 300, width: 320, x: 0, y: 0 } },
            });
        });
        const internalState = (handlerInstances.at(-1) as any).context.state;
        internalState.didContainersLayout = true;
        internalState.startBuffered = 0;
        internalState.endBuffered = 3;

        await act(async () => {
            ref.current?.setItemSize("a", { height: 200, width: 160 });
        });

        const state = ref.current?.getState();
        expect([0, 1, 2, 3].map((index) => state?.positionAtIndex(index))).toEqual([0, 0, 200, 200]);
        expect(state?.contentLength).toBe(400);

        await act(async () => {
            renderer?.unmount();
        });
    });

    it("falls back to one column when numColumns is not finite", async () => {
        const { LegendList } = await import("../../src/components/LegendList?masonry-invalid-columns-core");
        mock.module("@legendapp/list/react-native", () => ({ LegendList }));
        const { MasonryLegendList } = await import("../../src/integrations/masonry?invalid-columns");
        const ref = React.createRef<LegendListRef>();

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(
                <MasonryLegendList
                    data={[{ id: "a" }, { id: "b" }]}
                    estimatedItemSize={100}
                    keyExtractor={(item) => item.id}
                    numColumns={Number.NaN}
                    recycleItems={false}
                    ref={ref}
                    renderItem={() => null}
                />,
            );
        });

        expect([0, 1].map((index) => ref.current?.getState().positionAtIndex(index))).toEqual([0, 100]);

        await act(async () => {
            renderer?.unmount();
        });
    });

    it("uses the scroll-axis gap when balancing columns", async () => {
        const { LegendList } = await import("../../src/components/LegendList?masonry-gap-core");
        mock.module("@legendapp/list/react-native", () => ({ LegendList }));
        const { MasonryLegendList } = await import("../../src/integrations/masonry?gap");
        const ref = React.createRef<LegendListRef>();
        const data = [
            { height: 100, id: "a" },
            { height: 50, id: "b" },
            { height: 100, id: "c" },
        ];

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(
                <MasonryLegendList
                    contentContainerStyle={{ columnGap: 12, rowGap: 10 }}
                    data={data}
                    getFixedItemSize={(item) => item.height}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    recycleItems={false}
                    ref={ref}
                    renderItem={() => null}
                />,
            );
        });

        const state = ref.current?.getState();
        expect([0, 1, 2].map((index) => state?.positionAtIndex(index))).toEqual([0, 0, 60]);
        expect(state?.contentLength).toBe(170);

        await act(async () => {
            renderer?.unmount();
        });
    });

    it("rebalances when data is appended", async () => {
        const { LegendList } = await import("../../src/components/LegendList?masonry-append-core");
        mock.module("@legendapp/list/react-native", () => ({ LegendList }));
        const { MasonryLegendList } = await import("../../src/integrations/masonry?append");
        const ref = React.createRef<LegendListRef>();
        const initialData = [
            { height: 100, id: "a" },
            { height: 200, id: "b" },
            { height: 50, id: "c" },
        ];
        const renderList = (data: typeof initialData) => (
            <MasonryLegendList
                data={data}
                getFixedItemSize={(item) => item.height}
                keyExtractor={(item) => item.id}
                numColumns={2}
                recycleItems={false}
                ref={ref}
                renderItem={() => null}
            />
        );

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(renderList(initialData));
        });
        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 300, width: 320, x: 0, y: 0 } },
            });
        });

        await act(async () => {
            renderer?.update(renderList([...initialData, { height: 60, id: "d" }]));
        });

        const state = ref.current?.getState();
        expect([0, 1, 2, 3].map((index) => state?.positionAtIndex(index))).toEqual([0, 0, 100, 150]);
        expect(state?.contentLength).toBe(210);

        await act(async () => {
            renderer?.unmount();
        });
    });

    it("rebalances when numColumns changes", async () => {
        const { LegendList } = await import("../../src/components/LegendList?masonry-column-change-core");
        mock.module("@legendapp/list/react-native", () => ({ LegendList }));
        const { MasonryLegendList } = await import("../../src/integrations/masonry?column-change");
        const ref = React.createRef<LegendListRef>();
        const data = [
            { height: 100, id: "a" },
            { height: 200, id: "b" },
            { height: 50, id: "c" },
            { height: 60, id: "d" },
        ];
        const renderList = (numColumns: number) => (
            <MasonryLegendList
                data={data}
                getFixedItemSize={(item) => item.height}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                recycleItems={false}
                ref={ref}
                renderItem={() => null}
            />
        );

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(renderList(2));
        });
        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 300, width: 320, x: 0, y: 0 } },
            });
        });

        await act(async () => {
            renderer?.update(renderList(3));
        });

        const state = ref.current?.getState();
        expect([0, 1, 2, 3].map((index) => state?.positionAtIndex(index))).toEqual([0, 0, 0, 50]);
        expect(state?.contentLength).toBe(200);

        await act(async () => {
            renderer?.unmount();
        });
    });

    it("balances a large fixed-size dataset in one positioning pass", async () => {
        const { LegendList } = await import("../../src/components/LegendList?masonry-large-dataset-core");
        mock.module("@legendapp/list/react-native", () => ({ LegendList }));
        const { MasonryLegendList } = await import("../../src/integrations/masonry?large-dataset");
        const ref = React.createRef<LegendListRef>();
        const data = Array.from({ length: 10_000 }, (_, index) => ({
            height: 40 + ((index * 37) % 200),
            id: String(index),
        }));
        const getFixedItemSize = mock((item: (typeof data)[number]) => item.height);
        const expectedPositions: number[] = [];
        const expectedColumns: number[] = [];
        const columnHeights = [0, 0, 0];

        for (let index = 0; index < data.length; index++) {
            let shortestColumn = 0;
            for (let column = 1; column < columnHeights.length; column++) {
                if (columnHeights[column] < columnHeights[shortestColumn]) {
                    shortestColumn = column;
                }
            }
            expectedPositions.push(columnHeights[shortestColumn]);
            expectedColumns.push(shortestColumn + 1);
            columnHeights[shortestColumn] += data[index].height;
        }

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(
                <MasonryLegendList
                    data={data}
                    getFixedItemSize={getFixedItemSize}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    recycleItems
                    ref={ref}
                    renderItem={() => null}
                />,
            );
        });

        const state = ref.current?.getState();
        const internalState = (handlerInstances.at(-1) as any).context.state;
        expect(data.map((_, index) => state?.positionAtIndex(index))).toEqual(expectedPositions);
        expect(internalState.columns).toEqual(expectedColumns);
        expect(state?.contentLength).toBe(Math.max(...columnHeights));
        expect(getFixedItemSize).toHaveBeenCalledTimes(data.length);

        await act(async () => {
            renderer?.unmount();
        });
    });
});
