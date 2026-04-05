import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as scrollToModule from "@/core/scrollTo";
import { performInitialScroll } from "../../src/utils/performInitialScroll";
import { createMockContext } from "../__mocks__/createMockContext";

describe("performInitialScroll", () => {
    const ctx = createMockContext();
    let scrollToSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        scrollToSpy = spyOn(scrollToModule, "scrollTo").mockImplementation(() => undefined);
    });

    afterEach(() => {
        scrollToSpy.mockRestore();
    });

    it("dispatches offset-only targets through scrollTo", () => {
        performInitialScroll(ctx, {
            forceScroll: true,
            resolvedOffset: 180,
            target: { contentOffset: 180, viewOffset: 0 },
        });

        expect(scrollToSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                animated: false,
                forceScroll: true,
                index: undefined,
                isInitialScroll: true,
                offset: 180,
                precomputedWithViewOffset: true,
            }),
        );
    });

    it("dispatches index targets with resolved offsets through scrollTo", () => {
        const indexedCtx = createMockContext(
            {},
            {
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` })),
                    estimatedItemSize: 50,
                },
            },
        );

        performInitialScroll(indexedCtx, {
            forceScroll: true,
            resolvedOffset: 216,
            target: { index: 4, viewOffset: 16, viewPosition: 1 },
        });

        expect(scrollToSpy).toHaveBeenCalledWith(
            indexedCtx,
            expect.objectContaining({
                animated: false,
                forceScroll: true,
                index: 4,
                isInitialScroll: true,
                itemSize: 50,
                offset: 216,
                precomputedWithViewOffset: true,
                viewOffset: 16,
                viewPosition: 1,
            }),
        );
    });

    it("dispatches index targets with resolved offsets through scrollTo", () => {
        const indexedCtx = createMockContext(
            {},
            {
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` })),
                    estimatedItemSize: 50,
                },
            },
        );

        performInitialScroll(indexedCtx, {
            forceScroll: false,
            resolvedOffset: 240,
            target: { index: 4, viewOffset: 16, viewPosition: 1 },
        });

        expect(scrollToSpy).toHaveBeenCalledWith(
            indexedCtx,
            expect.objectContaining({
                animated: false,
                forceScroll: false,
                index: 4,
                isInitialScroll: true,
                itemSize: 50,
                offset: 240,
                precomputedWithViewOffset: true,
                viewOffset: 16,
                viewPosition: 1,
            }),
        );
    });

    it("dispatches offset-only targets with resolved offsets through scrollTo", () => {
        performInitialScroll(ctx, {
            forceScroll: true,
            resolvedOffset: 260,
            target: { contentOffset: 180, viewOffset: 0 },
        });

        expect(scrollToSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                animated: false,
                forceScroll: true,
                index: undefined,
                isInitialScroll: true,
                offset: 260,
                precomputedWithViewOffset: true,
            }),
        );
    });

    it("clamps resolved index targets before reading item metrics", () => {
        const indexedCtx = createMockContext(
            {},
            {
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` })),
                    estimatedItemSize: 50,
                },
            },
        );

        performInitialScroll(indexedCtx, {
            forceScroll: true,
            resolvedOffset: 240,
            target: { index: 999, viewOffset: 16, viewPosition: 1 },
        });

        expect(scrollToSpy).toHaveBeenCalledWith(
            indexedCtx,
            expect.objectContaining({
                index: 4,
                itemSize: 50,
            }),
        );
    });
});
