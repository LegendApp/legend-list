import { describe, expect, it, mock } from "bun:test";
import "../setup";

import { queueDeferredGeometryBoundary } from "../../src/core/deferredGeometryFlush";
import { flushRenderedTotalSize, updateRenderedTotalSize } from "../../src/core/renderedTotalSize";
import { createMockContext } from "../__mocks__/createMockContext";

describe("renderedTotalSize", () => {
    it("defers visual size growth while scrolling upward in the safe window", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        const ctx = createMockContext(
            { renderedTotalSize: 100, totalSize: 100 },
            {
                dataChangeNeedsScrollUpdate: false,
                deferredPositionNeedsStablePass: false,
                didDataChange: false,
                didFinishInitialScroll: true,
                isAtEnd: false,
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: index })),
                    stickyIndicesArr: [],
                },
                renderedTotalSize: 100,
                scroll: 10,
                scrollHistory: [
                    { scroll: 200, time: Date.now() - 50 },
                    { scroll: 150, time: Date.now() },
                ],
                scrollLength: 50,
                totalSize: 100,
                triggerCalculateItemsInView,
            },
        );

        const didPublish = updateRenderedTotalSize(ctx, 140);

        expect(didPublish).toBe(false);
        expect(ctx.state.pendingDeferredGeometryFlush).toBe(true);
        expect(ctx.state.pendingRenderedTotalSize).toBe(140);
        expect(ctx.state.renderedTotalSize).toBe(100);
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
        expect(ctx.values.get("renderedTotalSize")).toBe(100);

        flushRenderedTotalSize(ctx);

        expect(ctx.state.pendingRenderedTotalSize).toBeUndefined();
        expect(ctx.state.renderedTotalSize).toBe(140);
        expect(ctx.values.get("renderedTotalSize")).toBe(140);
    });

    it("re-arms deferred geometry flushes when rendered size starts deferring after idle", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        const ctx = createMockContext(
            { renderedTotalSize: 100, totalSize: 100 },
            {
                dataChangeNeedsScrollUpdate: false,
                deferredPositionNeedsStablePass: false,
                didDataChange: false,
                didFinishInitialScroll: true,
                isAtEnd: false,
                pendingDeferredGeometryFlush: false,
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: index })),
                    stickyIndicesArr: [],
                },
                renderedTotalSize: 100,
                scroll: 10,
                scrollHistory: [
                    { scroll: 200, time: Date.now() - 50 },
                    { scroll: 150, time: Date.now() },
                ],
                scrollLength: 50,
                totalSize: 100,
                triggerCalculateItemsInView,
            },
        );

        updateRenderedTotalSize(ctx, 140);

        expect(ctx.state.pendingRenderedTotalSize).toBe(140);
        expect(ctx.state.pendingDeferredGeometryFlush).toBe(true);
        expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
    });

    it("publishes immediately outside the deferred window", () => {
        const ctx = createMockContext(
            { renderedTotalSize: 100, totalSize: 100 },
            {
                didFinishInitialScroll: true,
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: index })),
                    stickyIndicesArr: [],
                },
                renderedTotalSize: 100,
                scroll: 10,
                scrollHistory: [
                    { scroll: 150, time: Date.now() - 50 },
                    { scroll: 200, time: Date.now() },
                ],
                scrollLength: 120,
                totalSize: 100,
            },
        );

        const didPublish = updateRenderedTotalSize(ctx, 140);

        expect(didPublish).toBe(true);
        expect(ctx.state.pendingRenderedTotalSize).toBeUndefined();
        expect(ctx.state.renderedTotalSize).toBe(140);
        expect(ctx.values.get("renderedTotalSize")).toBe(140);
    });

    it("queues a deferred-geometry flush when only rendered size is pending", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        const ctx = createMockContext(
            {},
            {
                pendingRenderedTotalSize: 160,
                renderedTotalSize: 100,
                triggerCalculateItemsInView,
            },
        );

        queueDeferredGeometryBoundary({
            canUseDeferredGeometry: true,
            ctx,
        });

        expect(ctx.state.pendingDeferredGeometryFlush).toBe(true);
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
    });

    it("keeps deferring while the published size is still safely beyond the viewport", () => {
        const ctx = createMockContext(
            { renderedTotalSize: 100, totalSize: 100 },
            {
                dataChangeNeedsScrollUpdate: false,
                deferredPositionNeedsStablePass: false,
                didDataChange: false,
                didFinishInitialScroll: true,
                isAtEnd: false,
                pendingRenderedTotalSize: 200,
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: index })),
                    stickyIndicesArr: [],
                },
                renderedTotalSize: 100,
                scroll: 10,
                scrollHistory: [
                    { scroll: 200, time: Date.now() - 50 },
                    { scroll: 150, time: Date.now() },
                ],
                scrollLength: 50,
                totalSize: 100,
            },
        );

        const didPublish = updateRenderedTotalSize(ctx, 140);

        expect(didPublish).toBe(false);
        expect(ctx.state.pendingRenderedTotalSize).toBe(140);
        expect(ctx.state.renderedTotalSize).toBe(100);
        expect(ctx.values.get("renderedTotalSize")).toBe(100);
    });

    it("defers safe shrinks while the real tail stays below the viewport", () => {
        const ctx = createMockContext(
            { renderedTotalSize: 200, totalSize: 200 },
            {
                dataChangeNeedsScrollUpdate: false,
                deferredPositionNeedsStablePass: false,
                didDataChange: false,
                didFinishInitialScroll: true,
                isAtEnd: false,
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: index })),
                    stickyIndicesArr: [],
                },
                renderedTotalSize: 200,
                scroll: 10,
                scrollHistory: [
                    { scroll: 200, time: Date.now() - 50 },
                    { scroll: 150, time: Date.now() },
                ],
                scrollLength: 50,
                totalSize: 200,
            },
        );

        const didPublish = updateRenderedTotalSize(ctx, 120);

        expect(didPublish).toBe(false);
        expect(ctx.state.pendingRenderedTotalSize).toBe(120);
        expect(ctx.state.renderedTotalSize).toBe(200);
        expect(ctx.values.get("renderedTotalSize")).toBe(200);
    });
});
