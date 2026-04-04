import * as scrollToModule from "@/core/scrollTo";
import { describe, expect, it, spyOn } from "bun:test";
import {
    evaluateBootstrapInitialScroll,
    handleBootstrapInitialScrollDataChange,
    handleBootstrapInitialScrollFooterLayout,
} from "../../src/core/bootstrapInitialScroll";
import { Platform } from "../../src/platform/Platform";
import { createMockContext } from "../__mocks__/createMockContext";

describe("bootstrapInitialScroll", () => {
    describe("initialScrollAtEnd re-targeting", () => {
        it("recomputes the tail target when more rows append during bootstrap", () => {
            const data = Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` }));
            const ctx = createMockContext(
                {
                    footerSize: 0,
                },
                {
                    initialScroll: {
                        contentOffset: undefined,
                        index: 1,
                        viewOffset: 0,
                        viewPosition: 1,
                    },
                    initialScrollSession: {
                        bootstrap: {
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
                        kind: "bootstrap",
                        previousDataLength: 0,
                    } as any,
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
                stylePaddingBottom: 0,
            });

            expect(ctx.state.initialScroll?.contentOffset).toBeUndefined();
            expect(ctx.state.initialScroll?.index).toBe(4);
            expect(ctx.state.initialScroll?.viewOffset).toBeCloseTo(0);
            expect(ctx.state.initialScroll?.viewPosition).toBe(1);
            expect(ctx.state.initialScrollSession).toMatchObject({
                bootstrap: {
                    stablePassCount: 0,
                    targetIndexSeed: 4,
                },
                kind: "bootstrap",
            });
        });

        it("rearms after late footer layout while the mount-owned footer correction is still pending", () => {
            const data = Array.from({ length: 3 }, (_, index) => ({ id: `item-${index}` }));
            const ctx = createMockContext(
                {
                    footerSize: 40,
                },
                {
                    didFinishInitialScroll: true,
                    initialScroll: {
                        contentOffset: undefined,
                        index: 2,
                        preserveForFooterLayout: true,
                        viewOffset: 0,
                        viewPosition: 1,
                    },
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
            expect(ctx.state.initialScrollSession).toMatchObject({
                bootstrap: {
                    targetIndexSeed: 2,
                },
                kind: "bootstrap",
            });
            expect(ctx.state.didFinishInitialScroll).toBe(false);
        });

        it("ignores cached contentOffset when the footer target itself did not change", () => {
            const data = Array.from({ length: 3 }, (_, index) => ({ id: `item-${index}` }));
            const ctx = createMockContext(
                {
                    footerSize: 40,
                },
                {
                    didFinishInitialScroll: true,
                    initialScroll: {
                        contentOffset: 160,
                        index: 2,
                        preserveForFooterLayout: true,
                        viewOffset: -40,
                        viewPosition: 1,
                    },
                    positions: [0, 100, 200],
                    props: {
                        data,
                        estimatedItemSize: 100,
                    },
                    scroll: 160,
                    scrollLength: 200,
                    scrollPending: 160,
                },
            );

            handleBootstrapInitialScrollFooterLayout(ctx, {
                dataLength: data.length,
                footerSize: 40,
                initialScrollAtEnd: true,
                stylePaddingBottom: 0,
            });

            expect(ctx.state.initialScroll).toEqual({
                contentOffset: 160,
                index: 2,
                viewOffset: -40,
                viewPosition: 1,
            });
            expect(ctx.state.initialScrollSession?.kind).toBe("bootstrap");
            expect(ctx.state.initialScrollSession?.bootstrap).toBeUndefined();
            expect(ctx.state.didFinishInitialScroll).toBe(true);
        });

        it("does not rearm a late footer correction after the user scrolls away from the finished target", () => {
            const data = Array.from({ length: 3 }, (_, index) => ({ id: `item-${index}` }));
            const ctx = createMockContext(
                {
                    footerSize: 40,
                },
                {
                    didFinishInitialScroll: true,
                    initialScroll: {
                        contentOffset: undefined,
                        index: 2,
                        preserveForFooterLayout: true,
                        viewOffset: 0,
                        viewPosition: 1,
                    },
                    positions: [0, 100, 200],
                    props: {
                        data,
                        estimatedItemSize: 100,
                    },
                    scroll: 40,
                    scrollLength: 200,
                    scrollPending: 40,
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
                viewOffset: 0,
                viewPosition: 1,
            });
            expect(ctx.state.initialScrollSession?.kind).toBe("bootstrap");
            expect(ctx.state.initialScrollSession?.bootstrap).toBeUndefined();
            expect(ctx.state.didFinishInitialScroll).toBe(true);
        });

        it("preserves the pending footer re-arm when bootstrap settles without scrolling", () => {
            const data = Array.from({ length: 3 }, (_, index) => ({ id: `item-${index}` }));
            const ctx = createMockContext(
                {
                    footerSize: 0,
                },
                {
                    didFinishInitialScroll: true,
                    initialScroll: {
                        contentOffset: undefined,
                        index: 2,
                        preserveForFooterLayout: true,
                        viewOffset: 0,
                        viewPosition: 1,
                    },
                    positions: [0, 100, 200],
                    props: {
                        data,
                        estimatedItemSize: 100,
                    },
                    scroll: 100,
                    scrollLength: 200,
                    scrollPending: 100,
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
            expect(ctx.state.initialScrollSession).toMatchObject({
                bootstrap: {
                    targetIndexSeed: 2,
                },
                kind: "bootstrap",
            });
            expect(ctx.state.didFinishInitialScroll).toBe(false);
        });

        it("does not resurrect a finished initialScrollAtEnd from generic end-state tracking", () => {
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

            expect(ctx.state.initialScroll).toBeUndefined();
            expect(ctx.state.initialScrollSession).toBeUndefined();
            expect(ctx.state.didFinishInitialScroll).toBe(true);
        });

        it("dispatches a real scroll when web bootstrap aborts with a mounted scroller", () => {
            const previousPlatform = Platform.OS;
            Platform.OS = "web";
            const scrollToSpy = spyOn(scrollToModule, "scrollTo").mockImplementation(() => undefined);

            try {
                const ctx = createMockContext(
                    {},
                    {
                        initialScroll: {
                            contentOffset: undefined,
                            index: 5,
                            viewOffset: 0,
                            viewPosition: 0,
                        },
                        initialScrollSession: {
                            bootstrap: {
                                anchorOffset: 240,
                                frameHandle: undefined,
                                mountFrameCount: 8,
                                passCount: 24,
                                scroll: 240,
                                seedContentOffset: 0,
                                stablePassCount: 0,
                                targetIndexSeed: 5,
                                visibleIndices: [5, 6, 7],
                            },
                            kind: "bootstrap",
                            previousDataLength: 0,
                        } as any,
                        props: {
                            data: Array.from({ length: 6 }, (_, index) => ({ id: `item-${index}` })),
                            estimatedItemSize: 50,
                        },
                        refScroller: { current: {} } as any,
                    },
                );

                evaluateBootstrapInitialScroll(ctx);

                expect(scrollToSpy).toHaveBeenCalledWith(
                    ctx,
                    expect.objectContaining({
                        animated: false,
                        forceScroll: true,
                        index: 5,
                        isInitialScroll: true,
                        offset: 240,
                        precomputedWithViewOffset: true,
                        waitForInitialScrollCompletionFrame: true,
                    }),
                );
                expect(ctx.state.initialScrollSession?.kind).toBe("bootstrap");
                expect(ctx.state.initialScrollSession?.bootstrap).toBeUndefined();
            } finally {
                scrollToSpy.mockRestore();
                Platform.OS = previousPlatform;
            }
        });
    });
});
