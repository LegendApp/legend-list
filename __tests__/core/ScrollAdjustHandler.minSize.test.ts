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
    ])("$name", async ({ expected, flag }) => {
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
        finishScrollTo(ctx);

        expect(ctx.state.scroll).toBe(expected);
        expect(handler.getAdjust()).toBe(expected - 300);
        expect(ctx.values.get("scrollAdjustPending")).toBe(0);
        expect(ctx.state.scrollingTo).toBeUndefined();
    });
});
