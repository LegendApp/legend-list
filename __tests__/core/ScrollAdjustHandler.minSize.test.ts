import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { finishScrollTo } from "../../src/core/finishScrollTo";
import * as platform from "../../src/platform/Platform";
import { createMockContext } from "../__mocks__/createMockContext";

beforeEach(() => {
    mock.module("@/platform/Platform", () => ({ ...platform, PlatformAdjustBreaksScroll: true }));
});

describe("ScrollAdjustHandler content container minimum size", () => {
    it.each([
        { expected: 300, flag: true, name: "keeps an animated scrollToOffset past the logical end" },
        { expected: 0, flag: undefined, name: "keeps unflagged offset targets on the logical max" },
        { canceled: true, expected: 300, flag: undefined, name: "keeps a canceled target inside the physical range" },
    ])("$name", async ({ expected, flag, canceled }) => {
        const { ScrollAdjustHandler } = await import("../../src/core/ScrollAdjustHandler?min-size");
        const ctx = createMockContext(
            {},
            {
                props: { contentContainerMinSize: 800 },
                scroll: 250,
                scrollingTo: { animated: true, clampToContentContainerMinSize: flag, offset: 300 },
                scrollLength: 500,
                totalSize: 350,
            },
        );
        const handler = new ScrollAdjustHandler(ctx);
        ctx.state.scrollAdjustHandler = handler;

        handler.requestAdjust(50);
        expect(ctx.values.get("scrollAdjustPending")).toBe(50);
        expect(handler.getAdjust()).toBe(0);

        // The animation lands before completion commits the queued MVCP adjustment.
        ctx.state.scroll = 300;
        if (canceled) {
            ctx.state.scrollingTo = undefined;
            handler.commitPendingAdjust();
        } else {
            finishScrollTo(ctx);
        }

        expect(ctx.state.scroll).toBe(expected);
        expect(handler.getAdjust()).toBe(expected - 300);
        expect(ctx.values.get("scrollAdjustPending")).toBe(0);
        expect(ctx.state.scrollingTo).toBeUndefined();
    });
});

it("keeps the committed web end when an animated follow releases deferred adjustments", async () => {
    platform.Platform.OS = "web";
    const { ScrollAdjustHandler } = await import("../../src/core/ScrollAdjustHandler?web-end-commit");
    const ctx = createMockContext(
        {},
        {
            didContainersLayout: true,
            didFinishInitialScroll: true,
            maintainingScrollAtEnd: "animated",
            props: { data: [0], estimatedItemSize: 100, maintainScrollAtEnd: { animated: true } },
            scroll: 900,
            scrollingTo: {
                animated: true,
                clampToContentContainerMinSize: true,
                index: 0,
                isScrollToEnd: true,
                offset: 0,
                viewPosition: 1,
            },
            scrollLength: 500,
            totalSize: 1400,
        },
    );
    ctx.state.idCache[0] = "item_0";
    ctx.state.positions[0] = 0;
    ctx.state.sizes.set("item_0", 1400);
    ctx.state.refScroller.current = { getMaxScrollOffset: () => 938 } as any;
    const handler = new ScrollAdjustHandler(ctx);
    ctx.state.scrollAdjustHandler = handler;
    handler.requestAdjust(-43);
    expect(ctx.values.get("scrollAdjustPending")).toBe(-43);
    ctx.state.scroll = 938;
    handler.commitPendingAdjust(ctx.state.scrollingTo);
    expect(ctx.state.scroll).toBe(938);
    expect(handler.getAdjust()).toBe(0);
    expect(ctx.values.get("scrollAdjustPending")).toBe(0);
});
