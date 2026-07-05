import { describe, expect, it } from "bun:test";
import "../setup";

import {
    getActivePrefixLayoutStore,
    isPrefixLayoutStoreSupported,
    syncPrefixLayoutStore,
} from "../../src/core/prefixLayoutStoreLifecycle";
import { resetLayoutCachesForDataChange } from "../../src/core/resetLayoutCachesForDataChange";
import { createMockContext } from "../__mocks__/createMockContext";

function createLayoutStoreContext() {
    return createMockContext(
        {
            numColumns: 1,
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

describe("prefix layout store lifecycle", () => {
    it("creates a store for the supported vertical single-column path", () => {
        const ctx = createLayoutStoreContext();

        const store = syncPrefixLayoutStore(ctx);

        expect(isPrefixLayoutStoreSupported(ctx)).toBe(true);
        expect(store).toBeDefined();
        expect(getActivePrefixLayoutStore(ctx)).toBe(store);
        expect(store?.length).toBe(3);
        expect(store?.getTotalSize()).toBe(300);
    });

    it("uses the scroll-axis gap in the initial estimate", () => {
        const ctx = createLayoutStoreContext();
        ctx.scrollAxisGap = 8;

        const store = syncPrefixLayoutStore(ctx);

        expect(store?.getEstimatedSize()).toBe(108);
        expect(store?.getTotalSize()).toBe(324);
    });

    it("resizes and updates estimates when supported props change", () => {
        const ctx = createLayoutStoreContext();
        const store = syncPrefixLayoutStore(ctx)!;

        ctx.state.props.data = Array.from({ length: 5 }, (_, index) => ({ id: `next-${index}` }));
        ctx.state.props.estimatedItemSize = 80;
        const nextStore = syncPrefixLayoutStore(ctx);

        expect(nextStore).toBe(store);
        expect(nextStore?.length).toBe(5);
        expect(nextStore?.getEstimatedSize()).toBe(80);
        expect(nextStore?.getTotalSize()).toBe(400);
    });

    it("clears measurements when layout caches reset", () => {
        const ctx = createLayoutStoreContext();
        const store = syncPrefixLayoutStore(ctx)!;
        store.setMeasuredSize(0, "item-0", 50);

        resetLayoutCachesForDataChange(ctx.state);

        expect(store.getSize(0)).toBe(100);
        expect(store.getTotalSize()).toBe(300);
    });

    it("disables the store for unsupported capabilities", () => {
        const cases = [
            {
                name: "horizontal",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.horizontal = true;
                },
            },
            {
                name: "multiple columns",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.numColumns = 2;
                },
            },
            {
                name: "override layout",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.overrideItemLayout = () => undefined;
                },
            },
            {
                name: "snap offsets",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.snapToIndices = [0];
                },
            },
            {
                name: "position component",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.positionComponentInternal = () => null;
                },
            },
            {
                name: "position listeners",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.positionListeners.set("item-0", new Set());
                },
            },
        ];

        for (const testCase of cases) {
            const ctx = createLayoutStoreContext();
            syncPrefixLayoutStore(ctx);

            testCase.patch(ctx);
            syncPrefixLayoutStore(ctx);

            expect(isPrefixLayoutStoreSupported(ctx), testCase.name).toBe(false);
            expect(ctx.state.layoutStore, testCase.name).toBeUndefined();
            expect(getActivePrefixLayoutStore(ctx), testCase.name).toBeUndefined();
        }
    });
});
