import { describe, expect, it } from "bun:test";
import {
    DEFAULT_BOOTSTRAP_REVEAL_EPSILON,
    INITIAL_SCROLL_STRATEGY,
    areBootstrapRevealSnapshotsEqual,
    getBootstrapRevealStablePassCount,
    shouldAbortBootstrapReveal,
} from "../../src/components/bootstrapInitialScroll";

describe("bootstrapInitialScroll", () => {
    describe("strategy flag", () => {
        it("defaults to the legacy initial scroll strategy", () => {
            expect(INITIAL_SCROLL_STRATEGY).toBe("legacy");
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
    });

    describe("deterministic fallback scaffolding", () => {
        it("aborts when pass count reaches the configured bound", () => {
            expect(
                shouldAbortBootstrapReveal({
                    frameCount: 1,
                    maxPasses: 3,
                    passCount: 3,
                }),
            ).toBe(true);
        });

        it("aborts when frame count reaches the configured bound", () => {
            expect(
                shouldAbortBootstrapReveal({
                    frameCount: 5,
                    maxFrames: 5,
                    passCount: 1,
                }),
            ).toBe(true);
        });

        it("does not abort while still under both bounds", () => {
            expect(
                shouldAbortBootstrapReveal({
                    frameCount: 2,
                    maxFrames: 5,
                    maxPasses: 5,
                    passCount: 2,
                }),
            ).toBe(false);
        });
    });
});
