import { expect, it } from "bun:test";
import "../setup";

import { restoreItemSizeEstimates, saveItemSizeEstimates } from "../../src/core/itemSizeCache";
import { createMockContext } from "../__mocks__/createMockContext";

it("only restores estimates for the same items, indices, renderer and layout context", () => {
    const data = [{ id: "a" }, { id: "b" }];
    const keyExtractor = (item: { id: string }) => item.id;
    const renderItem = () => null;
    const extraData = {};
    const context = (items = data, render = renderItem, extra = extraData) =>
        createMockContext(
            { extraData: extra },
            {
                indexByKey: new Map(items.map((item, index) => [item.id, index])),
                lastLayout: { height: 200, width: 320, x: 0, y: 0 },
                props: { data: items, estimatedItemSize: 50, keyExtractor, renderItem: render },
            },
        );
    const measured = context();
    measured.state.sizesKnown.set("a", 400);
    measured.state.sizesKnown.set("b", 300);
    saveItemSizeEstimates(measured, keyExtractor);

    const same = context([...data]);
    restoreItemSizeEstimates(same, 320, keyExtractor);
    expect(same.state.sizes.get("a")).toBe(400);
    expect(same.state.sizesKnown.size).toBe(0);

    for (const changed of [
        context(data, () => null),
        context(data.map((item) => ({ ...item }))),
        context([...data].reverse()),
        context(data, renderItem, {}),
    ]) {
        restoreItemSizeEstimates(changed, 320, keyExtractor);
        expect(changed.state.sizes.size).toBe(0);
    }
    for (const width of [undefined, 640]) {
        const resized = context();
        restoreItemSizeEstimates(resized, width, keyExtractor);
        expect(resized.state.sizes.size).toBe(0);
    }

    const remapped = context();
    const remappedKeys = (item: { id: string }) => (item.id === "a" ? "b" : "a");
    remapped.state.props.keyExtractor = remappedKeys;
    restoreItemSizeEstimates(remapped, 320, remappedKeys);
    expect(remapped.state.sizes.size).toBe(0);

    const appended = context([...data, { id: "c" }]);
    restoreItemSizeEstimates(appended, 320, keyExtractor);
    expect(appended.state.sizes.get("a")).toBe(400);
    expect(appended.state.sizes.has("b")).toBe(false);
});

it("keeps grid measurements instance-local when cross-axis spacing can change", () => {
    const data = [{ id: "a" }];
    const keyExtractor = (item: { id: string }) => item.id;
    const renderItem = () => null;
    const context = () =>
        createMockContext(
            {},
            {
                indexByKey: new Map([["a", 0]]),
                lastLayout: { height: 200, width: 320, x: 0, y: 0 },
                props: { data, keyExtractor, numColumns: 2, renderItem },
            },
        );
    const measured = context();
    measured.columnWrapperStyle = { columnGap: 10, rowGap: 4 };
    measured.state.sizesKnown.set("a", 400);
    saveItemSizeEstimates(measured, keyExtractor);
    const resized = context();
    resized.columnWrapperStyle = { columnGap: 30, rowGap: 4 };
    restoreItemSizeEstimates(resized, 320, keyExtractor);
    expect(resized.state.sizes.size).toBe(0);
});
