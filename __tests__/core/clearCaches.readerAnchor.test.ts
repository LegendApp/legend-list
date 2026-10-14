import { afterEach, describe, expect, it } from "bun:test";
import "../setup";

import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { interruptUserScroll } from "../../src/core/cancelScroll";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import { updateItemPositions } from "../../src/core/updateItemPositions";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import { listen$ } from "../../src/state/state";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";

const originalPlatform = Platform.OS;

afterEach(() => {
    Platform.OS = originalPlatform;
});

describe("size-cache invalidation reader anchoring", () => {
    it("does not restore the old reader after a queued target executes and late sizes arrive", async () => {
        Platform.OS = "ios";
        const originalRAF = globalThis.requestAnimationFrame;
        const originalCancelRAF = globalThis.cancelAnimationFrame;
        const frames = new Map<number, FrameRequestCallback>();
        let nextFrame = 0;
        globalThis.requestAnimationFrame = (callback) => {
            frames.set(++nextFrame, callback);
            return nextFrame;
        };
        globalThis.cancelAnimationFrame = (id) => {
            frames.delete(id);
        };
        const flushFrame = () => {
            const callbacks = Array.from(frames.values());
            frames.clear();
            for (const callback of callbacks) callback(Date.now());
        };
        const data = Array.from({ length: 30 }, (_, index) => index);
        const ctx = createMockContext(
            { headerSize: 0, numColumns: 1, numContainers: 16, readyToRender: true, stylePaddingTop: 0 },
            {
                didContainersLayout: true,
                didDataChange: true,
                didFinishInitialScroll: true,
                didLoad: true,
                endBuffered: 8,
                idCache: data.map((index) => `item_${index}`),
                indexByKey: new Map(data.map((index) => [`item_${index}`, index])),
                positions: data.map((index) => index * 100),
                props: { data, estimatedItemSize: 100 },
                scroll: 425,
                scrollLength: 320,
                sizes: new Map(data.map((index) => [`item_${index}`, 100])),
                sizesKnown: new Map(data.map((index) => [`item_${index}`, 100])),
                startBuffered: 3,
                totalSize: 3000,
                visibleContentAnchor: { key: "item_4", offset: 25 },
            },
        );
        const dispatchedOffsets: number[] = [];
        ctx.state.refScroller.current = {
            getScrollableNode: () => ({}),
            scrollTo: ({ y }) => {
                dispatchedOffsets.push(y!);
            },
        } as NonNullable<typeof ctx.state.refScroller.current>;
        ctx.state.triggerCalculateItemsInView = (params) => calculateItemsInView(ctx, params);
        try {
            const handle = createImperativeHandle(ctx);
            const pending = handle.scrollToIndex({ animated: false, index: 20 });
            expect(ctx.state.scrollingTo).toBeUndefined();
            expect(ctx.scrollRequestTracker?.isWaitingToRun()).toBe(true);
            handle.clearCaches();
            ctx.state.didDataChange = false;
            flushFrame();
            flushFrame();
            expect(dispatchedOffsets).toEqual([2000]);
            finishScrollTo(ctx);
            await pending;
            updateItemSizesBatch(ctx, [{ itemKey: "item_19", size: { height: 140, width: 400 } }]);
            expect(handle.getScrollAnchor()).toEqual({ key: "item_20", offset: 0 });
            expect(ctx.state.scroll).toBeGreaterThan(2000);
        } finally {
            ctx.state.scheduledWork.dispose();
            globalThis.requestAnimationFrame = originalRAF;
            globalThis.cancelAnimationFrame = originalCancelRAF;
        }
    });

    it("refreshes authoritative fixed sizes ahead of retained estimates", () => {
        let fixedSize = 80;
        const ctx = createMockContext(
            { numColumns: 1 },
            {
                props: { data: [0, 1], estimatedItemSize: 72, getFixedItemSize: () => fixedSize },
                sizes: new Map([
                    ["item_0", 80],
                    ["item_1", 80],
                ]),
                sizesKnown: new Map([
                    ["item_0", 80],
                    ["item_1", 80],
                ]),
                totalSize: 160,
            },
        );
        const handle = createImperativeHandle(ctx);
        fixedSize = 120;
        handle.clearCaches();
        updateItemPositions(ctx, false, {
            doMVCP: false,
            forceFullUpdate: true,
            scrollBottomBuffered: 0,
            startIndex: 0,
        });
        expect(ctx.state.positions).toEqual([0, 120]);
        expect(ctx.state.totalSize).toBe(240);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(120);
    });

    for (const platform of ["ios", "android", "web"] as const) {
        it(`keeps the partially visible key and offset through grow/shrink remeasurement on ${platform}`, () => {
            Platform.OS = platform;
            const data = Array.from({ length: 30 }, (_, index) => ({ id: `row-${index}` }));
            const heights = data.map((_, index) => (index % 3 === 0 ? 180 : 80));
            let position = 0;
            const positions = heights.map((height) => {
                const top = position;
                position += height;
                return top;
            });
            const ctx = createMockContext(
                { headerSize: 0, numColumns: 1, numContainers: 16, readyToRender: true, stylePaddingTop: 0 },
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    didLoad: true,
                    endBuffered: 20,
                    idCache: data.map((item) => item.id),
                    indexByKey: new Map(data.map((item, index) => [item.id, index])),
                    positions,
                    props: {
                        data,
                        estimatedItemSize: 72,
                        keyExtractor: (item) => item.id,
                    },
                    scroll: positions[16] + 25,
                    scrollLength: 320,
                    sizes: new Map(data.map((item, index) => [item.id, heights[index]])),
                    sizesKnown: new Map(data.map((item, index) => [item.id, heights[index]])),
                    startBuffered: 14,
                    totalSize: position,
                },
            );
            ctx.state.triggerCalculateItemsInView = (params) => calculateItemsInView(ctx, params);
            const handle = createImperativeHandle(ctx);
            const publishedSizes: number[] = [];
            const stop = listen$(ctx, "totalSize", (size) => publishedSizes.push(size));
            const originalScroll = ctx.state.scroll;

            for (const scale of [1.4, 1]) {
                handle.clearCaches({ mode: "sizes" });
                expect(ctx.state.sizesKnown.size).toBe(0);
                expect(ctx.state.scroll - ctx.state.positions[16]!).toBe(25);
                // Independent committed batches arrive below, at, and above the reader.
                for (const indices of [[17, 18, 19], [16], [14, 15]]) {
                    updateItemSizesBatch(
                        ctx,
                        indices.map((index) => ({
                            itemKey: data[index].id,
                            size: { height: Math.round(heights[index] * scale), width: 400 },
                        })),
                    );
                    expect(ctx.state.scroll - ctx.state.positions[16]!).toBe(25);
                    expect(handle.getScrollAnchor()).toEqual({ key: "row-16", offset: 25 });
                }
            }

            expect(ctx.state.scroll).toBe(originalScroll);
            expect(ctx.state.totalSize).toBe(position);
            expect(publishedSizes.length).toBeGreaterThan(0);
            expect(publishedSizes.every((size) => size > 0)).toBe(true);
            interruptUserScroll(ctx);
            expect(ctx.state.visibleContentAnchor).toBeUndefined();
            stop();
            ctx.state.scheduledWork.dispose();
        });
    }
});
