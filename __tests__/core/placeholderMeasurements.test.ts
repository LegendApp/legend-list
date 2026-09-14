import { expect, it, mock } from "bun:test";
import "../setup";

import { doInitialAllocateContainers } from "../../src/core/doInitialAllocateContainers";
import { LayoutStoreRuntime } from "../../src/core/LayoutStoreRuntime";
import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { checkAllSizesKnown } from "../../src/utils/checkAllSizesKnown";
import { createMockContext } from "../__mocks__/createMockContext";

it("measures unloaded placeholders without calling loaded-item callbacks", () => {
    const source = {
        getItem: () => undefined,
        getKey: (i: number) => `k${i}`,
        getLength: () => 2,
        getRevision: () => 0,
        subscribe: () => () => {},
    };
    const getFixedItemSize = mock(() => {
        throw Error("unloaded item");
    });
    const onItemSizeChanged = mock(() => {});
    const getItemType = mock(() => {
        throw Error("unloaded item");
    });
    const ctx = createMockContext(
        { containerItemKey0: "k0", containerItemKey1: "k1" },
        {
            containerItemKeys: new Map([
                ["k0", 0],
                ["k1", 1],
            ]),
            didContainersLayout: true,
            endBuffered: 1,
            idCache: ["k0", "k1"],
            indexByKey: new Map([
                ["k0", 0],
                ["k1", 1],
            ]),
            layoutStoreRuntime: new LayoutStoreRuntime(new PrefixLayoutStore(2, 20), 20),
            props: { dataSource: source, getFixedItemSize, getItemType, onItemSizeChanged },
            startBuffered: 0,
        },
    );
    updateItemSizesBatch(
        ctx,
        [0, 1].map((i) => ({ containerId: i, itemKey: `k${i}`, size: { height: 30, width: 320 } })),
    );
    expect(ctx.state.sizesKnown.size).toBe(2);
    expect(ctx.state.layoutStoreRuntime!.store.getTotalSize()).toBe(60);
    expect(checkAllSizesKnown(ctx.state, 0, 1)).toBe(true);
    expect(getFixedItemSize).not.toHaveBeenCalled();
    expect(getItemType).not.toHaveBeenCalled();
    expect(onItemSizeChanged).toHaveBeenCalledWith(
        expect.objectContaining({
            index: 0,
            itemData: undefined,
            itemKey: "k0",
            size: 30,
        }),
    );
    ctx.state.scheduledWork.dispose();
});

it("uses estimated placeholder sizes when allocating the initial container pool", () => {
    const getFixedItemSize = mock(() => 50);
    const source = {
        getItem: () => undefined,
        getKey: (i: number) => `k${i}`,
        getLength: () => 1000000,
        getRevision: () => 0,
        subscribe: () => () => {},
    };
    const ctx = createMockContext(
        { numContainers: 0 },
        { props: { dataSource: source, drawDistance: 0, estimatedItemSize: 100, getFixedItemSize }, scrollLength: 500 },
    );
    expect(doInitialAllocateContainers(ctx)).toBe(true);
    expect(ctx.values.get("numContainers")).toBe(5);
    expect(getFixedItemSize).not.toHaveBeenCalled();
    ctx.state.scheduledWork.dispose();
});

it("subtracts the trailing layout gap for a nonempty sparse source", async () => {
    const { getContentSize } = await import("../../src/state/getContentSize");
    const source = {
        getItem: () => undefined,
        getKey: (i: number) => `k${i}`,
        getLength: () => 2,
        getRevision: () => 0,
        subscribe: () => () => {},
    };
    const ctx = createMockContext({}, { props: { data: [], dataSource: source }, totalSize: 220 });
    ctx.scrollAxisGap = 10;
    expect(getContentSize(ctx)).toBe(210);
});
