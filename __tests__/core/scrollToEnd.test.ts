import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import * as doScrollToModule from "@/core/doScrollTo";
import { scrollToEnd } from "../../src/core/scrollToEnd";
import { getContentSize } from "../../src/state/getContentSize";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { createMockContext } from "../__mocks__/createMockContext";

const ITEM_SIZE = 100;
const ITEM_COUNT = 3;
const SCROLL_LENGTH = 200;

describe("scrollToEnd", () => {
    let doScrollToSpy: ReturnType<typeof spyOn>;
    let scrollOffsets: number[];

    beforeEach(() => {
        scrollOffsets = [];
        doScrollToSpy = spyOn(doScrollToModule, "doScrollTo").mockImplementation((_ctx, params) => {
            scrollOffsets.push(params.offset);
        });
    });

    afterEach(() => {
        doScrollToSpy.mockRestore();
    });

    function createCtx(props: Partial<InternalState["props"]>): StateContext {
        const ctx = createMockContext(
            { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: ITEM_COUNT * ITEM_SIZE },
            {
                didFinishInitialScroll: true,
                positions: Array.from({ length: ITEM_COUNT }, (_, i) => i * ITEM_SIZE),
                props: {
                    data: Array.from({ length: ITEM_COUNT }, (_, i) => ({ id: i })),
                    estimatedItemSize: ITEM_SIZE,
                    keyExtractor: (_item: any, index: number) => `item-${index}`,
                    ...props,
                },
                scrollLength: SCROLL_LENGTH,
                sizesKnown: new Map(
                    Array.from({ length: ITEM_COUNT }, (_, i) => [`item-${i}`, ITEM_SIZE] as [string, number]),
                ),
            },
        );
        return ctx;
    }

    it("lands at the end of a vertical list with bottom padding", () => {
        const ctx = createCtx({ stylePaddingBottom: 50 });
        const endOffset = getContentSize(ctx) - SCROLL_LENGTH;

        scrollToEnd(ctx);

        expect(endOffset).toBe(150);
        expect(scrollOffsets).toEqual([150]);
    });

    it("lands at the end of a horizontal list with trailing padding", () => {
        const ctx = createCtx({ horizontal: true, stylePaddingRight: 50 });
        const endOffset = getContentSize(ctx) - SCROLL_LENGTH;

        scrollToEnd(ctx);

        expect(endOffset).toBe(150);
        expect(scrollOffsets).toEqual([150]);
    });

    it("uses the leading padding as the end padding on a horizontal RTL list", () => {
        const ctx = createCtx({ horizontal: true, rtl: true, stylePaddingLeft: 50 });
        const endOffset = getContentSize(ctx) - SCROLL_LENGTH;

        scrollToEnd(ctx);

        expect(endOffset).toBe(150);
        expect(scrollOffsets).toEqual([150]);
    });

    it("ignores cross axis bottom padding on a horizontal list", () => {
        const ctx = createCtx({ horizontal: true, stylePaddingBottom: 50 });
        const endOffset = getContentSize(ctx) - SCROLL_LENGTH;

        scrollToEnd(ctx);

        expect(endOffset).toBe(100);
        expect(scrollOffsets).toEqual([100]);
    });
});
