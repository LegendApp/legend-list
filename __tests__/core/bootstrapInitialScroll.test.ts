import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import {
    evaluateBootstrapInitialScroll,
    handleBootstrapInitialScrollFooterLayout,
    handleBootstrapInitialScrollLayoutChange,
} from "../../src/core/bootstrapInitialScroll";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("bootstrapInitialScroll", () => {
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

    it("preserves footer relayout tracking across repeated end-target rebuilds", () => {
        const data = Array.from({ length: 3 }, (_, index) => ({ id: `item-${index}` }));
        const ctx = createMockContext(
            {
                footerSize: 20,
                totalSize: 150,
            },
            {
                idCache: ["item-0", "item-1", "item-2"],
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    contentOffset: undefined,
                    index: 2,
                    preserveForFooterLayout: true,
                    viewOffset: -20,
                    viewPosition: 1,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: undefined,
                        mountFrameCount: 1,
                        passCount: 0,
                        scroll: 0,
                        seedContentOffset: 0,
                        targetIndexSeed: 2,
                    },
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 50, 100],
                props: {
                    data,
                    estimatedItemSize: 50,
                    stylePaddingBottom: 0,
                },
                scrollHistory: [{ scroll: 0, time: Date.now() }],
                scrollingTo: {
                    animated: false,
                    isInitialScroll: true,
                    offset: 0,
                } as StateContext["state"]["scrollingTo"],
                sizes: new Map(
                    data.map((item) => {
                        return [item.id, 50];
                    }),
                ),
                sizesKnown: new Map(
                    data.map((item) => {
                        return [item.id, 50];
                    }),
                ),
                totalSize: 150,
            },
        );

        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: data.length,
            footerSize: 40,
            initialScrollAtEnd: true,
            stylePaddingBottom: 0,
        });

        expect(ctx.state.initialScroll).toMatchObject({
            index: 2,
            preserveForFooterLayout: true,
            viewOffset: -40,
            viewPosition: 1,
        });

        finishScrollTo(ctx);

        expect(ctx.state.initialScroll).toMatchObject({
            index: 2,
            preserveForFooterLayout: true,
            viewOffset: -40,
            viewPosition: 1,
        });
        expect(ctx.state.initialScrollSession).toMatchObject({
            kind: "bootstrap",
        });

        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: data.length,
            footerSize: 60,
            initialScrollAtEnd: true,
            stylePaddingBottom: 0,
        });

        expect(ctx.state.initialScroll).toMatchObject({
            index: 2,
            preserveForFooterLayout: true,
            viewOffset: -60,
            viewPosition: 1,
        });
        expect(ctx.state.initialScrollSession).toMatchObject({
            bootstrap: {
                passCount: 0,
                targetIndexSeed: 2,
            },
            kind: "bootstrap",
        });
    });

    it("clears preserved footer state once footer layout settles after bootstrap has finished", () => {
        const data = Array.from({ length: 3 }, (_, index) => ({ id: `item-${index}` }));
        const ctx = createMockContext(
            {
                footerSize: 40,
                totalSize: 150,
            },
            {
                didFinishInitialScroll: true,
                idCache: ["item-0", "item-1", "item-2"],
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    contentOffset: undefined,
                    index: 2,
                    preserveForFooterLayout: true,
                    viewOffset: -40,
                    viewPosition: 1,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 50, 100],
                props: {
                    data,
                    estimatedItemSize: 50,
                    stylePaddingBottom: 0,
                },
                scroll: 10,
                scrollPending: 10,
                sizes: new Map(
                    data.map((item) => {
                        return [item.id, 50];
                    }),
                ),
                sizesKnown: new Map(
                    data.map((item) => {
                        return [item.id, 50];
                    }),
                ),
                totalSize: 150,
            },
        );

        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: data.length,
            footerSize: 40,
            initialScrollAtEnd: true,
            stylePaddingBottom: 0,
        });

        expect(ctx.state.initialScroll).toMatchObject({
            contentOffset: undefined,
            index: 2,
            preserveForBottomPadding: true,
            preserveForFooterLayout: undefined,
            viewPosition: 1,
        });
        expect(ctx.state.initialScroll?.viewOffset).toBeCloseTo(0);
        expect(ctx.state.initialScrollSession).toMatchObject({
            kind: "bootstrap",
        });
    });

    it("finishes once the visible bootstrap slice stabilizes even if unrelated mounted extras are missing sizes", () => {
        const data = Array.from({ length: 8 }, (_, index) => ({ id: `item-${index}` }));
        const ctx = createMockContext(
            {
                totalSize: 800,
            },
            {
                containerItemKeys: new Map([
                    ["item-1", 0],
                    ["item-5", 1],
                    ["item-6", 2],
                ]),
                didFinishInitialScroll: false,
                endBuffered: 6,
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    contentOffset: 500,
                    index: 5,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: undefined,
                        mountFrameCount: 0,
                        passCount: 0,
                        scroll: 500,
                        seedContentOffset: 500,
                        targetIndexSeed: 5,
                    },
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400, 500, 600, 700],
                props: {
                    data,
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                refScroller: {
                    current: {
                        getCurrentScrollOffset: () => 500,
                    },
                } as StateContext["state"]["refScroller"],
                scrollLength: 200,
                sizesKnown: new Map([
                    ["item-5", 100],
                    ["item-6", 100],
                ]),
                startBuffered: 5,
                triggerCalculateItemsInView: () => {},
            },
        );

        evaluateBootstrapInitialScroll(ctx);

        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(ctx.state.initialScrollSession).toMatchObject({
            bootstrap: {
                passCount: 1,
                previousResolvedOffset: 500,
                scroll: 500,
            },
            kind: "bootstrap",
        });

        evaluateBootstrapInitialScroll(ctx);

        expect(ctx.state.didFinishInitialScroll).toBe(true);
        expect(ctx.state.initialScroll).toBeUndefined();
        expect(ctx.state.initialScrollSession).toBeUndefined();
    });

    it("does not finish while a mounted buffered item is still unmeasured", () => {
        const data = Array.from({ length: 8 }, (_, index) => ({ id: `item-${index}` }));
        const ctx = createMockContext(
            {
                totalSize: 800,
            },
            {
                containerItemKeys: new Map([
                    ["item-5", 1],
                    ["item-6", 2],
                ]),
                didFinishInitialScroll: false,
                endBuffered: 6,
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    contentOffset: 500,
                    index: 5,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: undefined,
                        mountFrameCount: 0,
                        passCount: 0,
                        scroll: 500,
                        seedContentOffset: 500,
                        targetIndexSeed: 5,
                    },
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400, 500, 600, 700],
                props: {
                    data,
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                scrollLength: 200,
                sizesKnown: new Map([["item-5", 100]]),
                startBuffered: 5,
                triggerCalculateItemsInView: () => {},
            },
        );

        evaluateBootstrapInitialScroll(ctx);

        expect(ctx.state.didFinishInitialScroll).not.toBe(true);
        expect(ctx.state.initialScrollSession).toMatchObject({
            bootstrap: {
                passCount: 1,
                scroll: 500,
            },
            kind: "bootstrap",
        });
    });

    it("waits for one matching follow-up pass after the resolved offset changes", () => {
        const data = Array.from({ length: 8 }, (_, index) => ({ id: `item-${index}` }));
        const ctx = createMockContext(
            {
                totalSize: 800,
            },
            {
                containerItemKeys: new Map([
                    ["item-5", 1],
                    ["item-6", 2],
                ]),
                didFinishInitialScroll: false,
                endBuffered: 6,
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    contentOffset: 500,
                    index: 5,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: undefined,
                        mountFrameCount: 0,
                        passCount: 0,
                        scroll: 450,
                        seedContentOffset: 500,
                        targetIndexSeed: 5,
                    },
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400, 500, 600, 700],
                props: {
                    data,
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                refScroller: {
                    current: {
                        getCurrentScrollOffset: () => 500,
                    },
                } as StateContext["state"]["refScroller"],
                scrollLength: 200,
                sizesKnown: new Map([
                    ["item-5", 100],
                    ["item-6", 100],
                ]),
                startBuffered: 5,
                triggerCalculateItemsInView: () => {},
            },
        );

        evaluateBootstrapInitialScroll(ctx);

        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(ctx.state.initialScrollSession).toMatchObject({
            bootstrap: {
                passCount: 1,
                previousResolvedOffset: 500,
                scroll: 500,
            },
            kind: "bootstrap",
        });

        evaluateBootstrapInitialScroll(ctx);

        expect(ctx.state.didFinishInitialScroll).toBe(true);
        expect(ctx.state.initialScrollSession).toBeUndefined();
        expect(ctx.state.scroll).toBe(500);
    });

    it("dispatches a final Android scroll even when the bootstrap seed already matches the resolved offset", () => {
        Platform.OS = "android";

        const data = Array.from({ length: 8 }, (_, index) => ({ id: `item-${index}` }));
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            {
                totalSize: 800,
            },
            {
                containerItemKeys: new Map([
                    ["item-5", 1],
                    ["item-6", 2],
                ]),
                didFinishInitialScroll: false,
                endBuffered: 6,
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    contentOffset: 500,
                    index: 5,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: undefined,
                        mountFrameCount: 0,
                        passCount: 0,
                        scroll: 500,
                        seedContentOffset: 500,
                        targetIndexSeed: 5,
                    },
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as StateContext["state"]["initialScrollSession"],
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
                    ["item-5", 100],
                    ["item-6", 100],
                ]),
                startBuffered: 5,
                triggerCalculateItemsInView: () => {},
            },
        );

        evaluateBootstrapInitialScroll(ctx);
        evaluateBootstrapInitialScroll(ctx);

        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 500 }]);
        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(ctx.state.initialScroll).toMatchObject({
            contentOffset: 500,
            index: 5,
            viewOffset: 0,
        });
        expect(ctx.state.initialScrollSession).toMatchObject({
            bootstrap: undefined,
            completion: {
                watchdog: {
                    startScroll: 0,
                    targetOffset: 500,
                },
            },
            kind: "bootstrap",
            previousDataLength: data.length,
        });
        expect(ctx.state.scrollingTo).toMatchObject({
            animated: false,
            index: 5,
            isInitialScroll: true,
            offset: 500,
            targetOffset: 500,
        });
    });

    it("dispatches a final iOS scroll when the bootstrap seed matches but the observed offset does not", () => {
        Platform.OS = "ios";

        const data = Array.from({ length: 8 }, (_, index) => ({ id: `item-${index}` }));
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            {
                totalSize: 800,
            },
            {
                containerItemKeys: new Map([
                    ["item-5", 1],
                    ["item-6", 2],
                ]),
                didFinishInitialScroll: false,
                endBuffered: 6,
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    contentOffset: 500,
                    index: 5,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: undefined,
                        mountFrameCount: 0,
                        passCount: 0,
                        scroll: 500,
                        seedContentOffset: 500,
                        targetIndexSeed: 5,
                    },
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400, 500, 600, 700],
                props: {
                    data,
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                refScroller: {
                    current: {
                        getCurrentScrollOffset: () => 0,
                        getScrollableNode: () => ({}),
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as StateContext["state"]["refScroller"],
                scrollLength: 200,
                sizesKnown: new Map([
                    ["item-5", 100],
                    ["item-6", 100],
                ]),
                startBuffered: 5,
                triggerCalculateItemsInView: () => {},
            },
        );

        evaluateBootstrapInitialScroll(ctx);
        evaluateBootstrapInitialScroll(ctx);

        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 500 }]);
        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(ctx.state.initialScrollSession).toMatchObject({
            bootstrap: undefined,
            completion: {
                watchdog: {
                    startScroll: 0,
                    targetOffset: 500,
                },
            },
            kind: "bootstrap",
            previousDataLength: data.length,
        });
    });

    it("adjusts a finished bottom-aligned bootstrap target when the viewport size changes", () => {
        const data = Array.from({ length: 8 }, (_, index) => ({ id: `item-${index}` }));
        const ctx = createMockContext(
            {
                totalSize: 800,
            },
            {
                containerItemKeys: new Map([
                    ["item-5", 1],
                    ["item-6", 2],
                ]),
                didFinishInitialScroll: false,
                endBuffered: 6,
                idCache: data.map((item) => item.id),
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    contentOffset: 500,
                    index: 5,
                    viewOffset: 0,
                    viewPosition: 1,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: undefined,
                        mountFrameCount: 0,
                        passCount: 0,
                        scroll: 500,
                        seedContentOffset: 500,
                        targetIndexSeed: 5,
                    },
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400, 500, 600, 700],
                props: {
                    data,
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                scroll: 500,
                scrollLength: 200,
                scrollPending: 500,
                sizes: new Map(
                    data.map((item) => {
                        return [item.id, 100];
                    }),
                ),
                sizesKnown: new Map(
                    data.map((item) => {
                        return [item.id, 100];
                    }),
                ),
                startBuffered: 5,
                triggerCalculateItemsInView: () => {},
            },
        );

        ctx.state.didFinishInitialScroll = true;
        ctx.state.initialScrollSession = undefined;
        ctx.state.scrollLength = 150;

        handleBootstrapInitialScrollLayoutChange(ctx);

        expect(ctx.state.didFinishInitialScroll).toBe(true);
        expect(ctx.state.initialScroll).toBeUndefined();
        expect(ctx.state.initialScrollSession).toBeUndefined();
        expect(ctx.state.scroll).toBe(450);
    });

    it("adjusts an active initial scroll target on late viewport layout without rearming bootstrap", () => {
        const data = Array.from({ length: 8 }, (_, index) => ({ id: `item-${index}` }));
        const ctx = createMockContext(
            {
                totalSize: 800,
            },
            {
                hasScrolled: true,
                idCache: data.map((item) => item.id),
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    contentOffset: 500,
                    index: 5,
                    viewOffset: 0,
                    viewPosition: 1,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    bootstrap: undefined,
                    completion: {
                        watchdog: {
                            startScroll: 500,
                            targetOffset: 500,
                        },
                    },
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400, 500, 600, 700],
                props: {
                    data,
                    estimatedItemSize: 100,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                scroll: 500,
                scrollingTo: {
                    animated: false,
                    isInitialScroll: true,
                    offset: 500,
                    targetOffset: 500,
                } as StateContext["state"]["scrollingTo"],
                scrollLength: 150,
                scrollPending: 500,
                sizes: new Map(
                    data.map((item) => {
                        return [item.id, 100];
                    }),
                ),
                sizesKnown: new Map(
                    data.map((item) => {
                        return [item.id, 100];
                    }),
                ),
                totalSize: 800,
            },
        );

        handleBootstrapInitialScrollLayoutChange(ctx);

        expect(ctx.state.initialScrollSession?.kind).toBe("bootstrap");
        expect(ctx.state.initialScrollSession?.bootstrap).toBeUndefined();
        expect(ctx.state.scrollingTo).toMatchObject({
            offset: 450,
            targetOffset: 450,
        });
        expect(ctx.state.initialScroll).toMatchObject({
            contentOffset: 450,
        });
        expect(ctx.state.hasScrolled).toBe(false);
        expect(ctx.state.initialScrollSession?.completion?.watchdog).toEqual({
            startScroll: 500,
            targetOffset: 450,
        });
        expect(ctx.state.scroll).toBe(450);
    });
});
