import { describe, expect, it } from "bun:test";
import { evaluateBootstrapInitialScroll } from "../../src/core/bootstrapInitialScroll";
import { LayoutStoreRuntime } from "../../src/core/LayoutStoreRuntime";
import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import { RowLayoutStore } from "../../src/core/RowLayoutStore";
import { createMockContext } from "../__mocks__/createMockContext";

function createContext(store: PrefixLayoutStore | RowLayoutStore, index: number, viewOffset = 0) {
    const ctx = createMockContext(
        {},
        {
            initialScroll: {
                bootstrap: {
                    mountFrameCount: 0,
                    passCount: 0,
                    scroll: 0,
                    seedContentOffset: 0,
                    targetIndexSeed: index,
                },
                index,
                kind: "index",
                viewOffset,
            },
            props: { data: Array.from({ length: store.length }, (_, i) => i), estimatedItemSize: 50 },
            scrollLength: 100,
            totalSize: store.getTotalSize(),
        },
    );
    ctx.state.layoutStoreRuntime = new LayoutStoreRuntime(store, 50);
    return ctx;
}

function visible(ctx: ReturnType<typeof createContext>) {
    evaluateBootstrapInitialScroll(ctx);
    ctx.state.scheduledWork.cancel("initialScrollFrame");
    return ctx.state.initialScroll?.bootstrap?.visibleIndices;
}

describe("sparse bootstrap viewport", () => {
    it("finds a distant viewport without walking from the requested index", () => {
        const store = new PrefixLayoutStore(100_000, 50);
        const ctx = createContext(store, 90_000, 4_000_000);
        const getOffset = store.getOffset.bind(store);
        const getSize = store.getSize.bind(store);
        let reads = 0;
        store.getOffset = (index) => {
            reads++;
            return getOffset(index);
        };
        store.getSize = (index) => {
            reads++;
            return getSize(index);
        };
        expect(visible(ctx)).toEqual([10_000, 10_001]);
        expect(reads).toBeLessThan(20);
    });

    it("keeps header, padding, and pending adjustment in viewport coordinates", () => {
        const ctx = createContext(new PrefixLayoutStore(20, 50), 8);
        ctx.values.set("headerSize", 90);
        ctx.values.set("stylePaddingTop", 30);
        ctx.values.set("scrollAdjustPending", 25);
        expect(visible(ctx)).toEqual([8, 9, 10]);
    });

    it("filters short cells and the exact trailing boundary in multi-column rows", () => {
        const store = new RowLayoutStore({ estimatedSize: 50, length: 8, numColumns: 2 });
        store.setMeasuredSize(0, 10);
        store.setMeasuredSize(1, 100);
        const ctx = createContext(store, 0, -20);
        ctx.state.scrollLength = 80;
        expect(visible(ctx)).toEqual([1]);
    });

    it("does not treat the last row as visible in a footer-only viewport", () => {
        const ctx = createContext(new PrefixLayoutStore(4, 50), 3, -100);
        ctx.values.set("footerSize", 300);
        expect(visible(ctx)).toEqual([]);
    });

    it("extends the candidate range when fixed sizes are smaller than the estimate", () => {
        const ctx = createContext(new PrefixLayoutStore(100, 50), 10);
        ctx.state.props.getFixedItemSize = () => 10;
        expect(visible(ctx)).toEqual(Array.from({ length: 10 }, (_, i) => i + 10));
        expect(ctx.state.layoutStoreRuntime!.store.getOffset(20)).toBe(600);
    });
});
