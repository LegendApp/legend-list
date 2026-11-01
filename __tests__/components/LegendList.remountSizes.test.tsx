import { expect, it, mock } from "bun:test";
import { handleLayout } from "../../src/core/handleLayout";
import { updateOneItemSize } from "../../src/core/updateItemSizes";
import type { StateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";

it("reuses measurements as estimates on remount without treating them as current measurements", async () => {
    let ctx: StateContext;
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (props: any) => {
            ctx = props.scrollAdjustHandler.ctx;
            return null;
        },
    }));
    const { LegendList } = await import("../../src/components/LegendList?remount-sizes");
    const data = Array.from({ length: 40 }, (_, i) => ({ id: `row-${i}` }));
    const keyExtractor = (item: { id: string }) => item.id;
    const renderItem = ({ item }: { item: { id: string } }) => <span>{item.id}</span>;
    const extraData = { selection: null };
    const ref = { current: null as any };
    const list = (items = data, width = 320, dataVersion = 0, extractor = keyExtractor, separator?: () => any) => (
        <LegendList
            data={items}
            dataVersion={dataVersion}
            drawDistance={0}
            estimatedItemSize={50}
            estimatedListSize={{ height: 200, width }}
            extraData={extraData}
            ItemSeparatorComponent={separator}
            keyExtractor={extractor}
            recycleItems={false}
            ref={ref}
            renderItem={renderItem}
        />
    );
    const first = render(list());
    act(() => {
        handleLayout(ctx!, { height: 200, width: 320, x: 0, y: 0 }, () => {});
        for (const item of data) {
            updateOneItemSize(ctx!, item.id, { height: 400, width: 320 });
        }
    });
    first.unmount();

    const separated = render(list(data, 320, 0, keyExtractor, () => null));
    expect(ctx!.state.sizes.get("row-1")).toBe(50);
    act(() => updateOneItemSize(ctx!, "row-1", { height: 500, width: 320 }));
    separated.unmount();

    for (const initialItems of [[], [{ id: "placeholder" }]]) {
        for (const initialVersion of [0, 1]) {
            const delayed = render(list(initialItems, 320, initialVersion));
            act(() => handleLayout(ctx!, { height: 200, width: 320, x: 0, y: 0 }, () => {}));
            delayed.rerender(list([...data]));
            expect(ctx!.state.sizes.get("row-0")).toBe(400);
            expect(ctx!.state.positions[1]).toBe(400);
            expect(ctx!.state.sizesKnown.size).toBe(0);
            expect(ctx!.state.endBuffered).toBeLessThan(3);
            delayed.unmount();
        }
    }

    const reopened = render(list([...data]));
    expect(ctx!.state.sizes.get("row-0")).toBe(400);
    expect(ctx!.state.positions[1]).toBe(400);
    expect(ctx!.state.sizesKnown.size).toBe(0);
    act(() => handleLayout(ctx!, { height: 200, width: 320, x: 0, y: 0 }, () => {}));
    expect(ctx!.state.endBuffered).toBeLessThan(3);
    // Equivalent arrays are not structural changes, so clearing must retain the resolved snapshot identity.
    reopened.rerender(list([...data]));
    act(() => ref.current.clearCaches({ mode: "full" }));
    reopened.rerender(list([...data, { id: "new-row" }]));
    expect(ctx!.state.sizes.get("row-1")).toBe(50);
    act(() => updateOneItemSize(ctx!, "row-0", { height: 300, width: 320 }));
    expect(ctx!.state.sizesKnown.get("row-0")).toBe(300);
    reopened.rerender(list([...data, { id: "new-row" }]));
    expect(ctx!.state.sizes.get("row-0")).toBe(300);
    reopened.unmount();

    const sameArray = render(list(data, 320, 0, (item) => item.id));
    expect(ctx!.state.sizes.get("row-0")).toBe(300);
    expect(ctx!.state.sizesKnown.size).toBe(0);
    act(() => ref.current.clearCaches());
    sameArray.unmount();

    const afterDefaultClear = render(list());
    expect(ctx!.state.sizes.get("row-0")).toBe(50);
    afterDefaultClear.unmount();

    const resized = render(list(data, 640));
    expect(ctx!.state.sizes.get("row-1")).toBe(50);
    resized.unmount();
    const revised = render(list(data, 320, 1));
    expect(ctx!.state.sizes.get("row-1")).toBe(50);
    revised.unmount();
    const unrelated = render(list(data.map((item) => ({ id: `other-${item.id}` }))));
    expect(ctx!.state.sizes.get("other-row-1")).toBe(50);
    unrelated.unmount();
});
