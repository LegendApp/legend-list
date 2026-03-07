import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as scrollToModule from "@/core/scrollTo";
import * as scrollToIndexModule from "@/core/scrollToIndex";
import { performInitialScroll } from "../../src/utils/performInitialScroll";
import { createMockContext } from "../__mocks__/createMockContext";

describe("performInitialScroll", () => {
    const ctx = createMockContext();
    let scrollToSpy: ReturnType<typeof spyOn>;
    let scrollToIndexSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        scrollToSpy = spyOn(scrollToModule, "scrollTo").mockImplementation(() => undefined);
        scrollToIndexSpy = spyOn(scrollToIndexModule, "scrollToIndex").mockImplementation(() => undefined);
    });

    afterEach(() => {
        scrollToSpy.mockRestore();
        scrollToIndexSpy.mockRestore();
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
        expect(scrollToIndexSpy).not.toHaveBeenCalled();
    });

    it("dispatches index targets through scrollToIndex when no precomputed offset exists", () => {
        performInitialScroll(ctx, {
            forceScroll: true,
            initialScrollUsesOffset: false,
            target: { index: 4, viewOffset: 16, viewPosition: 1 },
        });

        expect(scrollToIndexSpy).toHaveBeenCalledWith(
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
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("dispatches index targets with resolved offsets through scrollTo", () => {
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
                offset: 240,
                precomputedWithViewOffset: true,
            }),
        );
        expect(scrollToIndexSpy).not.toHaveBeenCalled();
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
        expect(scrollToIndexSpy).not.toHaveBeenCalled();
    });

    it("does nothing for index-based targets without an index or resolved offset", () => {
        performInitialScroll(ctx, {
            forceScroll: true,
            initialScrollUsesOffset: false,
            target: { viewOffset: 0 },
        });

        expect(scrollToSpy).not.toHaveBeenCalled();
        expect(scrollToIndexSpy).not.toHaveBeenCalled();
    });
});
