import { describe, expect, it } from "bun:test";
import {
    areBootstrapRevealSnapshotsEqual,
    areBootstrapRevealVisibleIndicesMeasured,
    DEFAULT_BOOTSTRAP_REVEAL_EPSILON,
    getBootstrapRevealStablePassCount,
    getBootstrapRevealVisibleIndices,
    shouldUseBootstrapInitialScroll,
    shouldAbortBootstrapReveal,
} from "../../src/components/bootstrapInitialScroll";

describe("bootstrapInitialScroll", () => {
    describe("strategy boundary", () => {
        it("uses bootstrap for index-based initial scroll targets", () => {
            expect(
                shouldUseBootstrapInitialScroll({
                    hasInitialScrollIndex: true,
                    initialScrollAtEnd: false,
                }),
            ).toBe(true);
        });

        it("does not use bootstrap for offset-only initial scroll targets", () => {
            expect(
                shouldUseBootstrapInitialScroll({
                    hasInitialScrollIndex: false,
                    initialScrollAtEnd: false,
                }),
            ).toBe(false);
        });

        it("uses bootstrap for initialScrollAtEnd", () => {
            expect(
                shouldUseBootstrapInitialScroll({
                    hasInitialScrollIndex: false,
                    initialScrollAtEnd: true,
                }),
            ).toBe(true);
        });
    });

    describe("hidden convergence scaffolding", () => {
        it("treats snapshots within epsilon and with the same visible indices as stable", () => {
            expect(
                areBootstrapRevealSnapshotsEqual(
                    {
                        anchorOffset: 120,
                        visibleIndices: [4, 5, 6],
                    },
                    {
                        anchorOffset: 120 + DEFAULT_BOOTSTRAP_REVEAL_EPSILON,
                        visibleIndices: [4, 5, 6],
                    },
                ),
            ).toBe(true);
        });

        it("requires the visible reveal window membership to stay identical", () => {
            expect(
                areBootstrapRevealSnapshotsEqual(
                    {
                        anchorOffset: 120,
                        visibleIndices: [4, 5, 6],
                    },
                    {
                        anchorOffset: 120,
                        visibleIndices: [4, 5, 7],
                    },
                ),
            ).toBe(false);
        });

        it("resets stable pass counting when reveal geometry changes", () => {
            expect(
                getBootstrapRevealStablePassCount({
                    next: {
                        anchorOffset: 240,
                        visibleIndices: [8, 9, 10],
                    },
                    previous: {
                        anchorOffset: 120,
                        visibleIndices: [4, 5, 6],
                    },
                    stablePassCount: 2,
                }),
            ).toBe(1);
        });

        it("increments stable pass counting when reveal geometry is unchanged", () => {
            expect(
                getBootstrapRevealStablePassCount({
                    next: {
                        anchorOffset: 240,
                        visibleIndices: [8, 9, 10],
                    },
                    previous: {
                        anchorOffset: 240,
                        visibleIndices: [8, 9, 10],
                    },
                    stablePassCount: 1,
                }),
            ).toBe(2);
        });

        it("collects all viewport-intersecting items for the final reveal window", () => {
            expect(
                getBootstrapRevealVisibleIndices({
                    dataLength: 5,
                    getSize: () => 50,
                    offset: 25,
                    positions: [0, 50, 100, 150, 200],
                    scrollLength: 100,
                }),
            ).toEqual([0, 1, 2]);
        });

        it("requires every reveal-window item to be measured", () => {
            expect(
                areBootstrapRevealVisibleIndicesMeasured({
                    getIsMeasured: (index) => index !== 2,
                    visibleIndices: [0, 1, 2],
                }),
            ).toBe(false);
        });
    });

    describe("deterministic fallback scaffolding", () => {
        it("aborts when pass count reaches the configured bound", () => {
            expect(
                shouldAbortBootstrapReveal({
                    mountFrameCount: 1,
                    maxPasses: 3,
                    passCount: 3,
                }),
            ).toBe(true);
        });

        it("aborts when frame count reaches the configured bound", () => {
            expect(
                shouldAbortBootstrapReveal({
                    mountFrameCount: 5,
                    maxFrames: 5,
                    passCount: 1,
                }),
            ).toBe(true);
        });

        it("does not abort while still under both bounds", () => {
            expect(
                shouldAbortBootstrapReveal({
                    mountFrameCount: 2,
                    maxFrames: 5,
                    maxPasses: 5,
                    passCount: 2,
                }),
            ).toBe(false);
        });
    });
});
