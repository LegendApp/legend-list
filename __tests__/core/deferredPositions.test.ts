import { describe, expect, it, mock } from "bun:test";
import "../setup";

import { maybeCompleteDeferredInitialScroll } from "../../src/core/deferredPositions";
import { createMockContext } from "../__mocks__/createMockContext";

describe("deferredPositions", () => {
    it("rebases settled initial scroll with a final native scroll instead of a scroll adjust", () => {
        const requestAdjust = mock();
        const scrollToNative = mock();
        const data = Array.from({ length: 20 }, (_, index) => ({ id: index }));
        const idCache = data.map((_, index) => `item_${index}`);
        const indexByKey = new Map(idCache.map((id, index) => [id, index]));

        const ctx = createMockContext(
            { totalSize: 8000 },
            {
                deferredPositions: {
                    anchorKey: "item_10",
                    anchorRenderPosition: 4000,
                    desiredScrollOffset: 4000,
                    drift: -198,
                    minInvalidatedIndex: 9,
                },
                didContainersLayout: true,
                endBuffered: 10,
                idCache,
                indexByKey,
                positions: Array.from({ length: 20 }, (_, index) => index * 400),
                props: {
                    data,
                },
                refScroller: {
                    current: {
                        scrollTo: scrollToNative,
                    },
                } as any,
                scroll: 4000,
                totalSizeExact: 8000,
                scrollAdjustHandler: {
                    getAdjust: () => 0,
                    requestAdjust,
                    setMounted: () => {},
                } as any,
                startBuffered: 10,
            },
        );

        for (const id of idCache) {
            ctx.state.sizes.set(id, 400);
            ctx.state.sizesKnown.set(id, 400);
        }

        const result = maybeCompleteDeferredInitialScroll(ctx);

        expect(result).toBe(true);
        expect(requestAdjust).not.toHaveBeenCalled();
        expect(ctx.state.scrollingTo?.targetOffset).toBe(3802);
        expect(ctx.state.scrollingTo?.offset).toBe(3802);
        expect(ctx.state.scroll).toBe(3802);
        expect(scrollToNative).toHaveBeenCalledWith({
            animated: false,
            x: 0,
            y: 3802,
        });
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });
});
