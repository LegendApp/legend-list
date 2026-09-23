import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { handleBootstrapInitialScrollFooterLayout } from "../../src/core/bootstrapInitialScroll";
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

describe("bootstrapInitialScroll footer relayout", () => {
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

    it("ignores a footer relayout that differs by less than a pixel", () => {
        // A 10dp footer on a 3.75x screen measures 37 or 38 physical pixels depending on where it lands:
        // onLayout reports 10.1333 or 9.8667 dp on alternate layouts.
        const data = createItems(3);
        const ctx = createMockContext(
            {
                footerSize: 10.13330078125,
                readyToRender: true,
                totalSize: 160,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                idCache: data.map((item) => item.id),
                indexByKey: createIndexByKey(data),
                initialScroll: {
                    contentOffset: 0,
                    index: 2,
                    preserveForBottomPadding: true,
                    preserveForFooterLayout: true,
                    viewOffset: -10.13330078125,
                    viewPosition: 1,
                } as InitialScroll,
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: data.length,
                } as InitialScrollSession,
                positions: [0, 50, 100],
                props: {
                    data,
                    estimatedItemSize: 50,
                    keyExtractor: (item: { id: string }) => item.id,
                },
                refScroller: {
                    current: {
                        getCurrentScrollOffset: () => 0,
                        getScrollableNode: () => ({}),
                        scrollTo: () => {},
                    },
                } as unknown as StateContext["state"]["refScroller"],
                scroll: 0,
                scrollLength: 800,
                scrollPending: 0,
                triggerCalculateItemsInView: () => {},
            },
        );

        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: data.length,
            footerSize: 9.86669921875,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });

        expect(ctx.state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(
            ctx.state.initialScrollSession?.kind === "bootstrap" && ctx.state.initialScrollSession.bootstrap,
        ).toBeFalsy();
    });

    it("does not report a footer size change for sub-pixel layout jitter", () => {
        const ctx = createMockContext({ footerSize: 10.13330078125 });

        expect(setFooterSize(ctx, 9.86669921875)).toBe(false);
        expect(setFooterSize(ctx, 30)).toBe(true);
    });
});
