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
            initialScrollUsesOffset: true,
            target: { contentOffset: 180, index: 0, viewOffset: 0 },
        });

        expect(scrollToSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                animated: false,
                forceScroll: true,
                index: undefined,
                isInitialScroll: true,
                offset: 180,
                precomputedWithViewOffset: false,
            }),
        );
    });

    it("dispatches index targets without a resolved offset through the normalized index path", () => {
        const ctx = createMockContext(
            {},
            {
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` })),
                    estimatedItemSize: 50,
                },
            },
        );

        performInitialScroll(ctx, {
            forceScroll: true,
            initialScrollUsesOffset: false,
            target: { index: 4, viewOffset: 16, viewPosition: 1 },
        });

        expect(scrollToSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                animated: false,
                forceScroll: true,
                index: 4,
                isInitialScroll: true,
                viewOffset: 16,
                viewPosition: 1,
            }),
        );
    });

    it("dispatches index targets with resolved offsets through scrollTo", () => {
        const ctx = createMockContext({}, {
            props: {
                data: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` })),
                estimatedItemSize: 50,
            },
        });

        performInitialScroll(ctx, {
            forceScroll: false,
            initialScrollUsesOffset: false,
            resolvedOffset: 240,
            target: { index: 4, viewOffset: 16, viewPosition: 1 },
        });

        expect(scrollToSpy).toHaveBeenCalledWith(
            ctx,
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
            initialScrollUsesOffset: true,
            resolvedOffset: 260,
            target: { contentOffset: 180, index: 0, viewOffset: 0 },
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

    it("does nothing for index-based targets without an index or resolved offset", () => {
        performInitialScroll(ctx, {
            forceScroll: true,
            initialScrollUsesOffset: false,
            target: { viewOffset: 0 },
        });

        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("clamps resolved index targets before reading item metrics", () => {
        const ctx = createMockContext(
            {},
            {
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` })),
                    estimatedItemSize: 50,
                },
            },
        );

        performInitialScroll(ctx, {
            forceScroll: true,
            initialScrollUsesOffset: false,
            resolvedOffset: 240,
            target: { index: 999, viewOffset: 16, viewPosition: 1 },
        });

        expect(scrollToSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                index: 4,
                itemSize: 50,
            }),
        );
    });
});
