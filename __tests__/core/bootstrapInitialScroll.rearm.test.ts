import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import {
    evaluateBootstrapInitialScroll,
    handleBootstrapInitialScrollDataChange,
    handleBootstrapInitialScrollFooterLayout,
} from "../../src/core/bootstrapInitialScroll";
import { setFooterSize } from "../../src/core/updateContentMetrics";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

type InitialScroll = StateContext["state"]["initialScroll"];
type InitialScrollSession = StateContext["state"]["initialScrollSession"];

function createItems(length: number) {
    return Array.from({ length }, (_, index) => ({ id: `item-${index}` }));
}

function createIndexByKey(data: Array<{ id: string }>) {
    return new Map(data.map((item, index) => [item.id, index] as const));
}

describe("bootstrapInitialScroll rearm", () => {
    let originalRequestAnimationFrame: typeof requestAnimationFrame;
    let originalPlatform: typeof Platform.OS;
    let rafHandle = 0;

    beforeEach(() => {
        originalPlatform = Platform.OS;
        originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((_cb: FrameRequestCallback) => ++rafHandle) as typeof requestAnimationFrame;
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        rafHandle = 0;
    });

    it("seeds a rearmed end target from the observed offset while the new last row has no position yet", () => {
        // A row appended in this commit has no position until calculateItemsInView runs.
        const data = createItems(6);
        const ctx = createMockContext(
            {
                footerSize: 0,
                totalSize: 300,
            },
            {
                didContainersLayout: true,
                idCache: data.slice(0, 5).map((item) => item.id),
                indexByKey: createIndexByKey(data),
                initialScroll: {
                    contentOffset: 200,
                    index: 4,
                    preserveForBottomPadding: true,
                    viewOffset: 0,
                    viewPosition: 1,
                } as InitialScroll,
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: undefined,
                        mountFrameCount: 2,
                        passCount: 1,
                        scroll: 200,
                        seedContentOffset: 200,
                        targetIndexSeed: 4,
                    },
                    kind: "bootstrap",
                    previousDataLength: 5,
                } as InitialScrollSession,
                positions: [0, 50, 100, 150, 200],
                props: {
                    data,
                    estimatedItemSize: 50,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                refScroller: {
                    current: {
                        getCurrentScrollOffset: () => 200,
                        getScrollableNode: () => ({}),
                        scrollTo: () => {},
                    },
                } as unknown as StateContext["state"]["refScroller"],
                scroll: 200,
                scrollLength: 100,
                scrollPending: 200,
                triggerCalculateItemsInView: () => {},
            },
        );

        handleBootstrapInitialScrollDataChange(ctx, {
            dataLength: data.length,
            didDataChange: true,
            initialScrollAtEnd: true,
            previousDataLength: 5,
            stylePaddingEnd: 0,
        });

        expect(ctx.state.initialScroll).toMatchObject({ index: 5, viewPosition: 1 });
        // The session must not be seeded with 0, which is what a missing position resolves to.
        expect(ctx.state.initialScrollSession).toMatchObject({
            bootstrap: { scroll: 200, targetIndexSeed: 5 },
            kind: "bootstrap",
        });
    });

    it("resolves the target again when the frame watchdog aborts instead of scrolling to the stale seed", () => {
        Platform.OS = "android";

        const data = createItems(8);
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            {
                totalSize: 800,
            },
            {
                containerItemKeys: new Map([
                    ["item-6", 1],
                    ["item-7", 2],
                ]),
                didFinishInitialScroll: false,
                endBuffered: 7,
                idCache: data.map((item) => item.id),
                indexByKey: createIndexByKey(data),
                initialScroll: {
                    contentOffset: 0,
                    index: 7,
                    preserveForBottomPadding: true,
                    viewOffset: 0,
                    viewPosition: 1,
                } as InitialScroll,
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: undefined,
                        // Seeded while item-7 had no position, before the watchdog budget ran out.
                        mountFrameCount: 8,
                        passCount: 0,
                        scroll: 0,
                        seedContentOffset: 0,
                        targetIndexSeed: 7,
                    },
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as InitialScrollSession,
                positions: [0, 100, 200, 300, 400, 500, 600, 700],
                props: {
                    data,
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                refScroller: {
                    current: {
                        getScrollableNode: () => ({}),
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as StateContext["state"]["refScroller"],
                scrollLength: 200,
                sizesKnown: new Map([
                    ["item-6", 100],
                    ["item-7", 100],
                ]),
                startBuffered: 6,
                triggerCalculateItemsInView: () => {},
            },
        );

        evaluateBootstrapInitialScroll(ctx);

        // The end of an 800px list in a 200px viewport is 600, not the seed that was cached at 0.
        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 600 }]);
    });

    it("keeps retargeting the end while its own initial scroll is still in flight", () => {
        const data = createItems(6);
        const ctx = createMockContext(
            {
                footerSize: 0,
                totalSize: 300,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                idCache: data.map((item) => item.id),
                indexByKey: createIndexByKey(data),
                initialScroll: {
                    contentOffset: 100,
                    index: 4,
                    preserveForBottomPadding: true,
                    viewOffset: 0,
                    viewPosition: 1,
                } as InitialScroll,
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 5,
                } as InitialScrollSession,
                positions: [0, 50, 100, 150, 200, 250],
                props: {
                    data,
                    estimatedItemSize: 50,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                refScroller: {
                    current: {
                        // The native view is still on its way from 40 to the end.
                        getCurrentScrollOffset: () => 40,
                        getScrollableNode: () => ({}),
                        scrollTo: () => {},
                    },
                } as unknown as StateContext["state"]["refScroller"],
                scroll: 40,
                scrollingTo: {
                    animated: false,
                    index: 4,
                    isInitialScroll: true,
                    offset: 100,
                    targetOffset: 100,
                } as StateContext["state"]["scrollingTo"],
                scrollLength: 100,
                scrollPending: 100,
                triggerCalculateItemsInView: () => {},
            },
        );

        handleBootstrapInitialScrollDataChange(ctx, {
            dataLength: data.length,
            didDataChange: true,
            initialScrollAtEnd: true,
            previousDataLength: 5,
            stylePaddingEnd: 0,
        });

        // Being mid-scroll is not the user moving away: the target follows the new last row.
        expect(ctx.state.initialScroll).toMatchObject({ index: 5, viewPosition: 1 });
        expect(ctx.state.initialScrollSession).toMatchObject({
            bootstrap: { targetIndexSeed: 5 },
            kind: "bootstrap",
        });
    });
});
