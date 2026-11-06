import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { calculateItemsInView } from "@/core/calculateItemsInView";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("native geometry velocity", () => {
    let ctx: StateContext;
    let time: ReturnType<typeof spyOn>;
    let now: number;

    beforeEach(() => {
        Platform.OS = "ios";
        now = 1000;
        time = spyOn(Date, "now").mockImplementation(() => now);
        ctx = createMockContext(
            {},
            {
                lastScrollAdjustForHistory: 0,
                scroll: 4010,
                scrollHistory: [{ scroll: 4010, time: now }],
                scrollLength: 700,
                triggerCalculateItemsInView: () => {},
            },
        );
    });

    afterEach(() => {
        ctx.state.scheduledWork.dispose();
        time.mockRestore();
    });

    it.each([4010, 4020])("does not project native anchor correction after geometry changes at %ipx", (scroll) => {
        const calculate = spyOn(ctx.state, "triggerCalculateItemsInView");
        ctx.state.scrollLastCalculate = 4010;
        ctx.state.scrollForNextCalculateItemsInView = { bottom: 5000, top: 3000 };
        updateScroll(ctx, scroll, false, { fromNativeScrollEvent: true, nativeGeometryChanged: true });
        expect(ctx.state.scrollHistory).toEqual([]);
        expect(ctx.state.scrollForNextCalculateItemsInView).toBeUndefined();
        expect(calculate.mock.calls.at(-1)?.[0]?.scrollVelocity).toBe(0);
        now++;
        updateScroll(ctx, 4048, true, { fromNativeScrollEvent: true, nativeGeometryChanged: false });
        expect(calculate.mock.calls.at(-1)?.[0]?.scrollVelocity).toBe(0);
        expect(ctx.state.scroll).toBe(4048);
    });

    it.each([-1, 1] as const)(
        "keeps recycled ownership stable through native geometry corrections in direction %i",
        (direction) => {
            const data = Array.from({ length: 100 }, (_, index) => ({ id: String(index) }));
            ctx.state.props = {
                ...ctx.state.props,
                data,
                drawDistance: 200,
                estimatedItemSize: 100,
                getFixedItemSize: () => 100,
                keyExtractor: (item: { id: string }) => item.id,
                recycleItems: true,
            };
            ctx.state.didContainersLayout = true;
            ctx.state.isFirst = false;
            ctx.state.scrollBufferDirection = direction;
            ctx.values.set("numContainers", 12);
            ctx.values.set("numColumns", 1);
            ctx.values.set("readyToRender", true);
            ctx.values.set("totalSize", data.length * 100);
            ctx.state.triggerCalculateItemsInView = (params) => calculateItemsInView(ctx, params);
            calculateItemsInView(ctx, { dataChanged: true });
            const ownership = () => Array.from(ctx.state.containerItemKeys!);
            const before = ownership();
            expect(before.length).toBeGreaterThan(0);
            const range = [ctx.state.startBuffered, ctx.state.endBuffered];

            for (const scroll of [4011, 4010]) {
                now++;
                updateScroll(ctx, scroll, false, { fromNativeScrollEvent: true, nativeGeometryChanged: true });
                expect(ctx.state.scroll).toBe(scroll);
                expect(ownership()).toEqual(before);
                expect([ctx.state.startBuffered, ctx.state.endBuffered]).toEqual(range);
                expect(ctx.state.scrollBufferDirection).toBe(direction);
            }

            // Content can also resize during a drag. Keep the conservative buffer direction,
            // while following every actual offset and allocating the entire visible range.
            ctx.state.isDragging = true;
            for (const scroll of [4510, 4110, 3810]) {
                now++;
                updateScroll(ctx, scroll, false, { fromNativeScrollEvent: true, nativeGeometryChanged: true });
                expect(ctx.state.scroll).toBe(scroll);
                expect(ctx.state.scrollBufferDirection).toBe(direction);
                expect(ctx.state.idsInView.length).toBeGreaterThan(0);
                for (const key of ctx.state.idsInView) {
                    expect(ctx.state.containerItemKeys!.has(key)).toBe(true);
                }
            }
            ctx.state.isDragging = false;

            // Stable-geometry user motion still changes direction on its first sample.
            now++;
            updateScroll(ctx, 3810 - direction * 2, true, {
                fromNativeScrollEvent: true,
                nativeGeometryChanged: false,
            });
            expect(ctx.state.scrollBufferDirection).toBe(-direction);
        },
    );

    it("keeps real velocity when geometry is unchanged", () => {
        const calculate = spyOn(ctx.state, "triggerCalculateItemsInView");
        now++;
        updateScroll(ctx, 4048, true, { fromNativeScrollEvent: true, nativeGeometryChanged: false });
        expect(calculate.mock.calls.at(-1)?.[0]?.scrollVelocity).toBeGreaterThan(0);
    });
});
