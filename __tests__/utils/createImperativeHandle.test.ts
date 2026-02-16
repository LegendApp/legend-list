import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as scrollToIndexModule from "../../src/core/scrollToIndex";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";

describe("createImperativeHandle.scrollToEnd", () => {
    let scrollToIndexSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        scrollToIndexSpy = spyOn(scrollToIndexModule, "scrollToIndex");
        scrollToIndexSpy.mockImplementation(() => undefined);
    });

    afterEach(() => {
        scrollToIndexSpy.mockRestore();
    });

    it("includes padding, footer, and custom viewOffset when scrolling to the end", () => {
        const ctx = createMockContext(
            { footerSize: 10 },
            {
                props: {
                    contentInset: { bottom: 14, left: 0, right: 0, top: 0 },
                    data: [1, 2, 3],
                    stylePaddingBottom: 6,
                },
            },
        );

        const handle = createImperativeHandle(ctx);
        handle.scrollToEnd({ animated: false, viewOffset: 5 });

        expect(scrollToIndexSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                animated: false,
                index: 2,
                viewOffset: -(6 + 10) + 5,
                viewPosition: 1,
            }),
        );
    });

    it("returns full content size in getState().contentLength", () => {
        const ctx = createMockContext(
            {
                footerSize: 12,
                headerSize: 24,
                stylePaddingTop: 8,
                totalSize: 200,
            },
            {
                props: {
                    contentInset: { bottom: 10, left: 0, right: 0, top: 0 },
                    stylePaddingBottom: 16,
                },
            },
        );

        const handle = createImperativeHandle(ctx);
        const state = handle.getState();

        expect(state.contentLength).toBe(24 + 12 + 8 + 16 + 200 + 10);
    });
});
