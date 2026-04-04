import { describe, expect, it } from "bun:test";
import "../setup";

import { finishInitialScroll, setInitialScrollTarget } from "../../src/core/initialScroll";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("initialScrollSession", () => {
    it("derives an offset session from legacy offset-only state", () => {
        const state = createMockState({
            initialScroll: {
                contentOffset: 120,
                index: 0,
                viewOffset: 0,
            } as any,
            initialScrollPreviousDataLength: 4,
            initialScrollUsesOffset: true,
        });

        expect(state.initialScrollSession).toMatchObject({
            kind: "offset",
            previousDataLength: 4,
        });
    });

    it("derives a bootstrap session from legacy index-based state", () => {
        const state = createMockState({
            bootstrapInitialScroll: {
                mountFrameCount: 2,
                passCount: 3,
                scroll: 250,
                seedContentOffset: 0,
                stablePassCount: 1,
                targetIndexSeed: 5,
                visibleIndices: [5, 6],
            },
            initialScroll: {
                contentOffset: 250,
                index: 5,
                viewOffset: 12,
            } as any,
            initialScrollPreviousDataLength: 8,
            initialScrollUsesOffset: false,
        });

        expect(state.initialScrollSession).toMatchObject({
            bootstrap: {
                mountFrameCount: 2,
                passCount: 3,
                scroll: 250,
                seedContentOffset: 0,
                stablePassCount: 1,
                targetIndexSeed: 5,
                visibleIndices: [5, 6],
            },
            kind: "bootstrap",
            previousDataLength: 8,
        });
    });

    it("keeps the session kind in sync when the active target changes", () => {
        const state = createMockState({
            initialScrollSession: {
                kind: "offset",
                previousDataLength: 0,
            } as any,
        });

        setInitialScrollTarget(state, {
            contentOffset: 320,
            index: 0,
            viewOffset: 0,
        });

        expect(state.initialScrollSession).toMatchObject({
            kind: "offset",
        });
    });

    it("keeps a finished session when preserving the target after completion", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: {
                    contentOffset: 220,
                    index: 0,
                    viewOffset: 0,
                } as any,
                initialScrollUsesOffset: true,
                props: {
                    data: [],
                },
            },
        );

        finishInitialScroll(ctx, {
            preserveTarget: true,
        });

        expect(ctx.state.initialScrollSession).toMatchObject({
            kind: "offset",
        });
    });
});
