import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { handleBootstrapInitialScrollFooterLayout } from "../../src/core/bootstrapInitialScroll";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("bootstrapInitialScroll", () => {
    let originalRequestAnimationFrame: typeof requestAnimationFrame;
    let rafHandle = 0;

    beforeEach(() => {
        originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((_cb: FrameRequestCallback) => ++rafHandle) as typeof requestAnimationFrame;
    });

    afterEach(() => {
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
                        anchorOffset: undefined,
                        frameHandle: undefined,
                        mountFrameCount: 1,
                        passCount: 0,
                        scroll: 0,
                        seedContentOffset: 0,
                        stablePassCount: 0,
                        targetIndexSeed: 2,
                        visibleIndices: undefined,
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
                stablePassCount: 0,
                targetIndexSeed: 2,
            },
            kind: "bootstrap",
        });
    });
});
