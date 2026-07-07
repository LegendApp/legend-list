import { describe, expect, it } from "bun:test";
import "../setup";

import { getLayoutOffset, getLayoutSize } from "@/core/layoutAccessors";
import { syncLayoutStoreState, syncLayoutStoreStructure } from "@/core/layoutStoreLifecycle";
import { createMockContext } from "../__mocks__/createMockContext";

function createItems(count: number) {
    return Array.from({ length: count }, (_, index) => ({ id: `item-${index}` }));
}

function createLaidOutContext(sizes: number[]) {
    const data = createItems(sizes.length);
    const ctx = createMockContext(
        {
            numColumns: 1,
            totalSize: 0,
        },
        {
            props: {
                data,
                estimatedItemSize: 100,
                keyExtractor: (item?: { id: string }) => item?.id,
            },
            totalSize: 0,
        },
    );

    sizes.forEach((size, index) => {
        const id = `item-${index}`;
        ctx.state.idCache[index] = id;
        ctx.state.indexByKey.set(id, index);
        ctx.state.sizesKnown.set(id, size);
        ctx.state.sizes.set(id, size);
    });
    syncLayoutStoreStructure(ctx);
    syncLayoutStoreState(ctx);

    return ctx;
}

describe("layout accessors", () => {
    it("reads offset and size from the current layout store", () => {
        const ctx = createLaidOutContext([40, 60, 125, 75]);

        expect(getLayoutOffset(ctx, 0)).toBe(0);
        expect(getLayoutOffset(ctx, 2)).toBe(100);
        expect(getLayoutSize(ctx, 2)).toBe(125);
        expect(ctx.state.totalSize).toBe(300);
    });

    it("returns undefined for unknown store indexes", () => {
        const ctx = createLaidOutContext([40, 60]);

        expect(getLayoutOffset(ctx, 10)).toBeUndefined();
        expect(getLayoutSize(ctx, 10)).toBeUndefined();
    });
});
