import { describe, expect, it } from "bun:test";
import {
    areBootstrapRevealSnapshotsEqual,
    areBootstrapRevealVisibleIndicesMeasured,
    DEFAULT_BOOTSTRAP_REVEAL_EPSILON,
    getBootstrapRevealStablePassCount,
    getBootstrapRevealVisibleIndices,
    handleBootstrapInitialScrollDataChange,
    handleBootstrapInitialScrollFooterLayout,
    shouldAbortBootstrapReveal,
    shouldUseBootstrapInitialScroll,
} from "../../src/core/bootstrapInitialScroll";
import { createMockContext } from "../__mocks__/createMockContext";

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

        it("starts reveal-window scanning from the seeded neighborhood instead of the head of the list", () => {
            let getSizeCallCount = 0;

            expect(
                getBootstrapRevealVisibleIndices({
                    dataLength: 1000,
                    getSize: () => {
                        getSizeCallCount += 1;
                        return 50;
                    },
                    offset: 250,
                    positions: Array.from({ length: 1000 }, (_, index) => index * 50),
                    scrollLength: 100,
                    startIndex: 6,
                }),
            ).toEqual([5, 6]);

            expect(getSizeCallCount).toBeLessThan(10);
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
                    maxPasses: 3,
                    mountFrameCount: 1,
                    passCount: 3,
                }),
            ).toBe(true);
        });

        it("aborts when frame count reaches the configured bound", () => {
            expect(
                shouldAbortBootstrapReveal({
                    maxFrames: 5,
                    mountFrameCount: 5,
                    passCount: 1,
                }),
            ).toBe(true);
        });

        it("does not abort while still under both bounds", () => {
            expect(
                shouldAbortBootstrapReveal({
                    maxFrames: 5,
                    maxPasses: 5,
                    mountFrameCount: 2,
                    passCount: 2,
                }),
            ).toBe(false);
        });
    });

    describe("initialScrollAtEnd re-targeting", () => {
        it("recomputes the tail target when more rows append during bootstrap", () => {
            const data = Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` }));
            const ctx = createMockContext(
                {
                    footerSize: 0,
                },
                {
                    bootstrapInitialScroll: {
                        anchorOffset: undefined,
                        frameHandle: undefined,
                        mountFrameCount: 2,
                        passCount: 4,
                        scroll: 50,
                        seedContentOffset: 50,
                        stablePassCount: 1,
                        targetIndexSeed: 1,
                        visibleIndices: undefined,
                    },
                    initialScroll: {
                        contentOffset: undefined,
                        index: 1,
                        viewOffset: 0,
                        viewPosition: 1,
                    },
                    positions: [0, 50, 100, 150, 200],
                    props: {
                        data,
                        estimatedItemSize: 50,
                    },
                    scrollLength: 100,
                },
            );

            handleBootstrapInitialScrollDataChange(ctx, {
                dataLength: data.length,
                didDataChange: true,
                initialScrollAtEnd: true,
                previousDataLength: 2,
                stylePaddingBottom: 0,
            });

            expect(ctx.state.initialScroll?.contentOffset).toBeUndefined();
            expect(ctx.state.initialScroll?.index).toBe(4);
            expect(ctx.state.initialScroll?.viewOffset).toBeCloseTo(0);
            expect(ctx.state.initialScroll?.viewPosition).toBe(1);
            expect(ctx.state.bootstrapInitialScroll?.targetIndexSeed).toBe(4);
            expect(ctx.state.bootstrapInitialScroll?.stablePassCount).toBe(0);
        });

        it("rearms after late footer layout when the finished mount is still at the end", () => {
            const data = Array.from({ length: 3 }, (_, index) => ({ id: `item-${index}` }));
            const ctx = createMockContext(
                {
                    footerSize: 40,
                },
                {
                    didFinishInitialScroll: true,
                    initialScroll: undefined,
                    isAtEnd: true,
                    positions: [0, 100, 200],
                    props: {
                        data,
                        estimatedItemSize: 100,
                    },
                    scroll: 140,
                    scrollLength: 200,
                    scrollPending: 140,
                },
            );

            handleBootstrapInitialScrollFooterLayout(ctx, {
                dataLength: data.length,
                footerSize: 40,
                initialScrollAtEnd: true,
                stylePaddingBottom: 0,
            });

            expect(ctx.state.initialScroll).toEqual({
                contentOffset: undefined,
                index: 2,
                viewOffset: -40,
                viewPosition: 1,
            });
            expect(ctx.state.bootstrapInitialScroll?.targetIndexSeed).toBe(2);
            expect(ctx.state.didFinishInitialScroll).toBe(false);
        });

    });
});
