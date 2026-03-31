import { describe, expect, it } from "bun:test";
import "../setup";

import { addTotalSize } from "../../src/core/addTotalSize";
import { flushDeferredPositions } from "../../src/core/deferredPositions";
import { createMockContext } from "../__mocks__/createMockContext";

describe("addTotalSize", () => {
    it("keeps the published size pinned to a deferred floor while exact size shrinks", () => {
        const ctx = createMockContext(
            { totalSize: 500 },
            {
                deferredPositions: {
                    kind: "initial_scroll",
                    anchorKey: "item_1",
                    anchorRenderPosition: 100,
                    drift: 0,
                    minInvalidatedIndex: 1,
                    publishedSizeFloor: 500,
                },
                props: {
                    data: [{ id: 0 }, { id: 1 }],
                },
                totalSize: 500,
            },
        );

        addTotalSize(ctx, null, 450);

        expect(ctx.state.totalSizeExact).toBe(450);
        expect(ctx.values.get("totalSize")).toBe(500);
    });

    it("publishes exact growth immediately when it exceeds the deferred floor", () => {
        const ctx = createMockContext(
            { totalSize: 500 },
            {
                deferredPositions: {
                    kind: "initial_scroll",
                    anchorKey: "item_1",
                    anchorRenderPosition: 100,
                    drift: 0,
                    minInvalidatedIndex: 1,
                    publishedSizeFloor: 500,
                },
                props: {
                    data: [{ id: 0 }, { id: 1 }],
                },
                totalSize: 500,
            },
        );

        addTotalSize(ctx, null, 560);

        expect(ctx.state.totalSizeExact).toBe(560);
        expect(ctx.values.get("totalSize")).toBe(560);
    });

    it("publishes the exact size again when the deferred session flushes", () => {
        const ctx = createMockContext(
            { totalSize: 500 },
            {
                deferredPositions: {
                    kind: "initial_scroll",
                    anchorKey: "item_1",
                    anchorRenderPosition: 100,
                    drift: 0,
                    minInvalidatedIndex: 1,
                    publishedSizeFloor: 500,
                },
                props: {
                    data: [{ id: 0 }, { id: 1 }],
                },
                totalSize: 500,
            },
        );

        addTotalSize(ctx, null, 450);
        flushDeferredPositions(ctx, "settled");

        expect(ctx.values.get("totalSize")).toBe(450);
        expect(ctx.state.deferredPositions).toBeUndefined();
    });

    it("keeps the published size pinned during offset-only initial scroll bootstrap", () => {
        const ctx = createMockContext(
            { totalSize: 500 },
            {
                initialScroll: {
                    contentOffset: 250,
                    viewOffset: 0,
                } as any,
                initialScrollUsesOffset: true,
                props: {
                    data: [{ id: 0 }, { id: 1 }],
                },
                totalSize: 500,
            },
        );

        addTotalSize(ctx, null, 450);

        expect(ctx.state.totalSizeExact).toBe(450);
        expect(ctx.values.get("totalSize")).toBe(500);
    });
});
