import { describe, expect, it } from "bun:test";
import "../setup";

import { LayoutStoreRuntime, type RowSpanCacheInput } from "../../src/core/LayoutStoreRuntime";
import { RowLayoutStore } from "../../src/core/RowLayoutStore";

function createCacheInput(): RowSpanCacheInput {
    return {
        data: {},
        dataKey: undefined,
        dataVersion: undefined,
        extraData: undefined,
        numColumns: 4,
        overrideItemLayout: () => {},
    };
}

describe("LayoutStoreRuntime", () => {
    it("transforms cached spans with post-removal move destinations", () => {
        const runtime = new LayoutStoreRuntime(new RowLayoutStore({ estimatedSize: 10, length: 8, numColumns: 4 }), 10);
        const input = createCacheInput();
        runtime.setCachedRowSpans(input, [1, 2, 3, 4, 1, 2, 3, 4]);

        runtime.transformCachedRowSpans([
            { count: 2, from: 2, to: 5, type: "move" },
            { deleteCount: 2, index: 1, insertCount: 3, type: "splice" },
        ]);

        expect(runtime.getCachedRowSpans(input)).toEqual([1, undefined, undefined, undefined, 2, 3, 3, 4, 4]);
    });

    it("handles large inserted span ranges without spreading arguments", () => {
        const runtime = new LayoutStoreRuntime(new RowLayoutStore({ estimatedSize: 10, length: 2, numColumns: 4 }), 10);
        const input = createCacheInput();
        runtime.setCachedRowSpans(input, [2, 3]);

        runtime.transformCachedRowSpans([{ deleteCount: 0, index: 1, insertCount: 200_000, type: "splice" }]);

        const spans = runtime.getCachedRowSpans(input)!;
        expect(spans.length).toBe(200_002);
        expect(spans[0]).toBe(2);
        expect(spans[1]).toBeUndefined();
        expect(spans[200_001]).toBe(3);
    });
});
