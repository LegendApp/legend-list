import { describe, expect, it } from "bun:test";
import "../setup";

import { createLayoutEngine, getLayoutEngineKind, getPrefixLayoutStoreForEngine } from "@/core/LayoutEngine";
import { syncPrefixLayoutStoreStructure } from "@/core/prefixLayoutStoreLifecycle";
import { createMockContext } from "../__mocks__/createMockContext";

function createLayoutContext() {
    return createMockContext(
        {
            numColumns: 1,
            readyToRender: true,
        },
        {
            props: {
                data: Array.from({ length: 3 }, (_, index) => ({ id: `item-${index}` })),
                estimatedItemSize: 100,
                keyExtractor: (item: { id: string }) => item.id,
                numColumns: 1,
            },
        },
    );
}

describe("LayoutEngine boundary", () => {
    it("selects array layout when no prefix store is active", () => {
        const ctx = createLayoutContext();
        const engine = createLayoutEngine(ctx);

        expect(getLayoutEngineKind(ctx)).toBe("array");
        expect(getPrefixLayoutStoreForEngine(ctx)).toBeUndefined();
        expect(engine.kind).toBe("array");
    });

    it("selects prefix layout when the current state has an active prefix store", () => {
        const ctx = createLayoutContext();
        const store = syncPrefixLayoutStoreStructure(ctx);
        const engine = createLayoutEngine(ctx);

        expect(getLayoutEngineKind(ctx)).toBe("prefix");
        expect(getPrefixLayoutStoreForEngine(ctx)).toBe(store);
        expect(engine.kind).toBe("prefix");
    });

    it("selects array layout for unsupported layout modes even if sync was requested", () => {
        const ctx = createLayoutContext();
        ctx.state.props.numColumns = 2;

        syncPrefixLayoutStoreStructure(ctx);

        expect(getLayoutEngineKind(ctx)).toBe("array");
        expect(getPrefixLayoutStoreForEngine(ctx)).toBeUndefined();
    });

    it("uses the supplied state snapshot when reading a non-current state", () => {
        const ctx = createLayoutContext();
        const store = syncPrefixLayoutStoreStructure(ctx)!;
        const snapshot = {
            ...ctx.state,
            layoutStore: store,
        };

        ctx.state.layoutStore = undefined;

        expect(getLayoutEngineKind(ctx, snapshot)).toBe("prefix");
        expect(getPrefixLayoutStoreForEngine(ctx, snapshot)).toBe(store);
        expect(getLayoutEngineKind(ctx)).toBe("array");
    });
});
