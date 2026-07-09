import { describe, expect, it } from "bun:test";
import "../setup";

import { ArrayDataAdapter, DataSourceAdapter, getDataLength } from "../../src/core/IndexedData";
import { syncLayoutStoreStructure } from "../../src/core/layoutStoreLifecycle";
import type { DataSourceMutationBatch, LegendListDataSource } from "../../src/types.base";
import { getId } from "../../src/utils/getId";
import { createMockContext } from "../__mocks__/createMockContext";

interface Item {
    id: string;
}

function createDataSource(items: Array<Item | undefined>): LegendListDataSource<Item> {
    return {
        getItem: (index) => items[index],
        getKey: (index) => items[index]?.id ?? `unloaded-${index}`,
        getLength: () => items.length,
        getRevision: () => 0,
        subscribe: (_listener: (batch: DataSourceMutationBatch) => void) => () => {},
    };
}

describe("IndexedData", () => {
    it("adapts arrays without changing item or key semantics", () => {
        const data = [{ id: "a" }, { id: "b" }];
        const adapter = new ArrayDataAdapter(data, (item) => item.id);

        expect(adapter.kind).toBe("array");
        expect(adapter.getLength()).toBe(2);
        expect(adapter.getItem(1)).toBe(data[1]);
        expect(adapter.getItem(2)).toBeUndefined();
        expect(adapter.getKey(1)).toBe("b");
        expect(adapter.getLegacyData()).toBe(data);
    });

    it("uses index keys for arrays without a key extractor", () => {
        const adapter = new ArrayDataAdapter([{ id: "a" }]);

        expect(adapter.getKey(0)).toBe(0 as unknown as string);
    });

    it("adapts sparse data sources without materializing an array", () => {
        const source = createDataSource([{ id: "a" }, undefined, { id: "c" }]);
        const adapter = new DataSourceAdapter(source);

        expect(adapter.kind).toBe("dataSource");
        expect(adapter.getLength()).toBe(3);
        expect(adapter.getItem(1)).toBeUndefined();
        expect(adapter.getKey(1)).toBe("unloaded-1");
        expect(adapter.getLegacyData()).toBeUndefined();
    });

    it("drives core identity and layout length without a backing array", () => {
        const source = createDataSource([{ id: "a" }, undefined, { id: "c" }]);
        const ctx = createMockContext({}, { props: { data: [], dataSource: source, estimatedItemSize: 25 } });

        expect(getDataLength(ctx.state)).toBe(3);
        expect(getId(ctx.state, 1)).toBe("unloaded-1");

        const store = syncLayoutStoreStructure(ctx);
        expect(store?.length).toBe(3);
        expect(store?.getTotalSize()).toBe(75);
    });
});
