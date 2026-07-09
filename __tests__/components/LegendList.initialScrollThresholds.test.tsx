import { describe, expect, it } from "bun:test";
import "../setup";

import { checkThresholds } from "../../src/utils/checkThresholds";
import { createMockContext } from "../__mocks__/createMockContext";

describe("LegendList initial scroll thresholds", () => {
    it("defers start/end reached callbacks until the initial scroll finishes", () => {
        const onStartReachedCalls: Array<{ distanceFromStart: number }> = [];
        const onEndReachedCalls: Array<{ distanceFromEnd: number }> = [];
        const ctx = createMockContext(
            {
                footerSize: 0,
                headerSize: 0,
                stylePaddingTop: 0,
                totalSize: 1000,
            },
            {
                initialScroll: { index: 9, viewOffset: 0, viewPosition: 1 },
                isEndReached: null,
                isStartReached: null,
                props: {
                    data: Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` })),
                    onEndReached: (payload) => onEndReachedCalls.push(payload),
                    onEndReachedThreshold: 10,
                    onStartReached: (payload) => onStartReachedCalls.push(payload),
                    onStartReachedThreshold: 10,
                },
                queuedInitialLayout: true,
                scroll: 800,
                scrollingTo: {
                    animated: false,
                    index: 9,
                    isInitialScroll: true,
                    offset: 800,
                    targetOffset: 800,
                } as any,
                scrollLength: 200,
            },
        );

        checkThresholds(ctx);

        expect(onStartReachedCalls).toEqual([]);
        expect(onEndReachedCalls).toEqual([]);

        ctx.state.initialScroll = undefined;
        ctx.state.scrollingTo = undefined;

        checkThresholds(ctx);

        expect(onStartReachedCalls).toEqual([{ distanceFromStart: 800 }]);
        expect(onEndReachedCalls).toEqual([{ distanceFromEnd: 0 }]);
        expect(ctx.state.isStartReached).toBe(true);
        expect(ctx.state.isEndReached).toBe(true);
    });
});
