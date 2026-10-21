import { afterEach, beforeEach, describe, expect, it, type Mock, mock, spyOn } from "bun:test";
import "../setup";

import { evaluateBootstrapInitialScroll } from "../../src/core/bootstrapInitialScroll";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import * as checkFinishedScrollModule from "../../src/core/checkFinishedScroll";
import { checkResetContainers } from "../../src/core/checkResetContainers";
import * as initialScrollModule from "../../src/core/initialScroll";
import {
    handleInitialScrollDataChange,
    handleInitialScrollLayoutReady,
    retargetActiveInitialScrollAtEnd,
} from "../../src/core/initialScrollLifecycle";
import { resetLayoutCachesForDataChange } from "../../src/core/resetLayoutCachesForDataChange";
import { updateItemPositions } from "../../src/core/updateItemPositions";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("initialScrollLifecycle", () => {
    let advanceCurrentInitialScrollSessionSpy: Mock<typeof initialScrollModule.advanceCurrentInitialScrollSession>;
    let checkFinishedScrollSpy: Mock<typeof checkFinishedScrollModule.checkFinishedScroll>;
    let originalRAF: typeof requestAnimationFrame;
    let originalPlatform: typeof Platform.OS;
    let rafCallbacks: FrameRequestCallback[];

    beforeEach(() => {
        rafCallbacks = [];
        originalPlatform = Platform.OS;
        originalRAF = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length;
        }) as any;
        advanceCurrentInitialScrollSessionSpy = spyOn(
            initialScrollModule,
            "advanceCurrentInitialScrollSession",
        ).mockImplementation(() => true);
        checkFinishedScrollSpy = spyOn(checkFinishedScrollModule, "checkFinishedScroll").mockImplementation(() => {});
    });

    afterEach(() => {
        rafCallbacks = [];
        globalThis.requestAnimationFrame = originalRAF;
        Platform.OS = originalPlatform;
        advanceCurrentInitialScrollSessionSpy.mockRestore();
        checkFinishedScrollSpy.mockRestore();
    });

    for (const didStartFreshData of [false, true]) {
        it(`only cancels previous scroll ownership and end-follow state for a fresh dataset (${didStartFreshData})`, () => {
            const ctx = createMockContext({ isFollowingEnd: true, isScrollActive: true });
            const state = ctx.state;
            const resolve = mock(() => {});
            const cancelCompletion = mock(() => {});
            const oldTarget = { animated: false, index: 3, isInitialScroll: true, offset: 6 };
            state.hasHadNonEmptyData = true;
            state.initialScroll = { index: 3, viewPosition: 1 };
            state.scrollingTo = oldTarget;
            state.pendingScrollResolve = resolve;
            state.maintainingScrollAtEnd = "pending-instant";
            state.pendingMaintainScrollAtEnd = true;
            state.didDeferMaintainScrollAtEndForMomentum = true;
            state.momentumSuspendContentSize = 1000;
            state.momentumSuspendCompensated = true;
            state.scheduledWork.register("platformScrollCompletion", cancelCompletion);
            state.endFollowInterrupted = true;
            state.visibleContentAnchor = { key: "reader", offset: 20 };
            state.pendingEndMeasurements = new Set(["tail"]);
            state.scrollElementTarget = { element: {} as Element };

            handleInitialScrollDataChange(ctx, {
                dataLength: 25,
                didDataChange: true,
                didStartFreshData,
                initialScrollAtEnd: true,
                latestInitialScroll: { index: 24, viewPosition: 1 },
                latestInitialScrollSessionKind: "bootstrap",
                stylePaddingEnd: 0,
                useBootstrapInitialScroll: false,
            });

            expect(state.scrollingTo).toBe(didStartFreshData ? undefined : oldTarget);
            expect(state.pendingMaintainScrollAtEnd).toBe(!didStartFreshData);
            expect(state.didDeferMaintainScrollAtEndForMomentum).toBe(!didStartFreshData);
            expect(state.momentumSuspendContentSize).toBe(didStartFreshData ? undefined : 1000);
            expect(state.momentumSuspendCompensated).toBe(!didStartFreshData);
            expect(resolve).toHaveBeenCalledTimes(didStartFreshData ? 1 : 0);
            expect(cancelCompletion).toHaveBeenCalledTimes(didStartFreshData ? 1 : 0);
            expect(state.endFollowInterrupted).toBe(!didStartFreshData);
            expect(state.visibleContentAnchor).toEqual(didStartFreshData ? undefined : { key: "reader", offset: 20 });
            expect(state.pendingEndMeasurements).toEqual(didStartFreshData ? undefined : new Set(["tail"]));
            expect(state.scrollElementTarget).toEqual(didStartFreshData ? undefined : { element: {} });
            expect(ctx.values.get("isFollowingEnd")).toBe(!didStartFreshData);
            // Releasing the old request must not leave scroll-gated transitions disabled.
            expect(ctx.values.get("isScrollActive")).toBe(!didStartFreshData);
        });
    }

    for (const measured of [false, true]) {
        for (const target of ["end", "unread", "jump"] as const) {
            it(`seeds rapid mid-flight dataset switches from incoming positions (${target}, cached ${measured})`, () => {
                Platform.OS = "web";
                const dataA = Array.from({ length: 151 }, (_, index) => ({ id: `a-${index}` }));
                const dataB = Array.from({ length: 19 }, (_, index) => ({ id: `b-${index}` }));
                const ctx = createMockContext(
                    { footerSize: 0, numColumns: 1, stylePaddingTop: 0 },
                    {
                        hasHadNonEmptyData: true,
                        initialScrollSession: {
                            bootstrap: { mountFrameCount: 0, passCount: 0, scroll: 1298, seedContentOffset: 1298 },
                            kind: "bootstrap",
                            previousDataLength: 19,
                        },
                        props: {
                            data: dataB,
                            estimatedItemSize: 86,
                            keyExtractor: (item: { id: string }) => item.id,
                        },
                        scrollLength: 648,
                    },
                );
                const sizeAt = (index: number) => (index % 7 === 0 ? 600 : 86);
                if (measured) {
                    for (const data of [dataA, dataB]) {
                        data.forEach((item, index) => {
                            ctx.state.sizes.set(item.id, sizeAt(index));
                            ctx.state.sizesKnown.set(item.id, sizeAt(index));
                        });
                    }
                }
                updateItemPositions(ctx, true);
                expect(ctx.state.positions).toHaveLength(19);

                // Do not run queued frames between switches: each destination supersedes an active bootstrap.
                for (const data of [dataA, dataB, dataA]) {
                    const index =
                        target === "end" ? data.length - 1 : data === dataB ? 10 : target === "unread" ? 75 : 130;
                    ctx.state.props.data = data;
                    handleInitialScrollDataChange(ctx, {
                        dataLength: data.length,
                        didDataChange: true,
                        didStartFreshData: true,
                        initialScrollAtEnd: target === "end",
                        latestInitialScroll: { index, viewPosition: target === "end" ? 1 : 0 },
                        latestInitialScrollSessionKind: "bootstrap",
                        stylePaddingEnd: 0,
                        useBootstrapInitialScroll: true,
                    });
                    const position = Array.from({ length: index }, (_, i) => (measured ? sizeAt(i) : 86)).reduce(
                        (a, b) => a + b,
                        0,
                    );
                    const expectedOffset =
                        target === "end" ? position + (measured ? sizeAt(index) : 86) - 648 : position;
                    expect(ctx.state.positions).toHaveLength(data.length);
                    expect(ctx.state.positions[index]).toBe(position);
                    expect(ctx.state.initialScrollSession?.bootstrap?.scroll).toBe(expectedOffset);
                }

                // Measurements arriving after the last switch must refine the new target, never restore B's offset.
                dataA.forEach((item, index) => {
                    ctx.state.sizes.set(item.id, sizeAt(index) + 60);
                    ctx.state.sizesKnown.set(item.id, sizeAt(index) + 60);
                });
                resetLayoutCachesForDataChange(ctx.state);
                updateItemPositions(ctx, true);
                evaluateBootstrapInitialScroll(ctx);
                const finalTargetIndex = ctx.state.initialScroll!.index!;
                const expected =
                    ctx.state.positions[finalTargetIndex]! +
                    (target === "end" ? sizeAt(finalTargetIndex) + 60 - 648 : 0);
                expect(ctx.state.initialScrollSession?.bootstrap?.scroll).toBe(expected);
            });
        }
    }

    for (const fresh of [false, true]) {
        it(`prepares uncached destination geometry before rearming bootstrap (fresh: ${fresh})`, () => {
            Platform.OS = "web";
            const data = Array.from({ length: 20 }, (_, index) => ({ id: `next-${index}` }));
            const ctx = createMockContext(
                { footerSize: 0, headerSize: 0, numColumns: 1, numContainers: 8, stylePaddingTop: 0 },
                {
                    averageSizes: { "": { avg: 60, num: 3 } },
                    dataChangeEpoch: 1,
                    hasHadNonEmptyData: true,
                    idCache: ["old-0", "old-1", "old-2"],
                    initialScroll: { index: 2, viewPosition: 1 },
                    initialScrollSession: {
                        bootstrap: { mountFrameCount: 0, passCount: 0, scroll: 0, seedContentOffset: 0 },
                        kind: "bootstrap",
                        previousDataLength: 3,
                    },
                    positions: [0, 50, 100],
                    props: { data, estimatedItemSize: 50, keyExtractor: (item: { id: string }) => item.id },
                    scrollLength: 200,
                },
            );
            const resolve = mock(() => {});
            if (fresh) {
                ctx.state.scrollingTo = { animated: true, averageSizeSnapshot: { "": 900 }, offset: 500 };
                ctx.state.pendingScrollResolve = resolve;
            }
            // Measured sizes and pooled containers belong to the list, not the departing scroll.
            ctx.state.sizes.set("cached-other", 73);
            ctx.state.sizesKnown.set("cached-other", 73);
            ctx.values.set("numContainersPooled", 12);

            handleInitialScrollDataChange(ctx, {
                dataLength: data.length,
                didDataChange: true,
                didStartFreshData: fresh,
                initialScrollAtEnd: true,
                latestInitialScroll: { index: 19, viewPosition: 1 },
                latestInitialScrollSessionKind: "bootstrap",
                stylePaddingEnd: 0,
                useBootstrapInitialScroll: true,
            });

            expect(ctx.state.initialScrollSession?.bootstrap?.scroll).toBe(1000);
            expect(ctx.state.positions[19]).toBe(1140);
            expect(ctx.state.idCache[0]).toBe("next-0");
            expect(resolve).toHaveBeenCalledTimes(fresh ? 1 : 0);
            expect(ctx.state.sizesKnown.get("cached-other")).toBe(73);
            expect(ctx.values.get("numContainersPooled")).toBe(12);
            ctx.state.scheduledWork.dispose();
        });
    }

    it("invalidates column-dependent measurements before seeding a fresh destination", () => {
        Platform.OS = "web";
        const data = Array.from({ length: 80 }, (_, index) => ({ id: `row-${index}` }));
        const ctx = createMockContext(
            { footerSize: 0, headerSize: 0, numColumns: 1, numContainers: 8, stylePaddingTop: 0 },
            {
                dataChangeEpoch: 1,
                didColumnsChange: true,
                hasHadNonEmptyData: true,
                props: {
                    data,
                    estimatedItemSize: 50,
                    getFixedItemSize: () => 50,
                    keyExtractor: (item: { id: string }) => item.id,
                    numColumns: 2,
                },
                scrollLength: 200,
                sizes: new Map(data.map((item) => [item.id, 100])),
                sizesKnown: new Map(data.map((item) => [item.id, 100])),
            },
        );
        handleInitialScrollDataChange(ctx, {
            dataLength: data.length,
            didDataChange: true,
            didStartFreshData: true,
            initialScrollAtEnd: true,
            latestInitialScroll: { index: 79, viewPosition: 1 },
            latestInitialScrollSessionKind: "bootstrap",
            stylePaddingEnd: 0,
            useBootstrapInitialScroll: true,
        });
        expect(ctx.state.initialScrollSession?.bootstrap?.scroll).toBe(1800);
        checkResetContainers(ctx, data, { didColumnsChange: true });
        expect(ctx.state.startBuffered).toBeGreaterThan(0);
        expect(ctx.state.containerItemKeys.has("row-79")).toBe(true);
        ctx.state.scheduledWork.dispose();
    });

    it("invalidates column sizes after a prepared layout could not allocate a viewport", () => {
        const data = [{ id: "row" }];
        const ctx = createMockContext(
            { numColumns: 1, numContainers: 8 },
            {
                dataChangeEpoch: 1,
                props: { data, estimatedItemSize: 50, keyExtractor: (item: { id: string }) => item.id },
                scrollLength: 0,
                sizesKnown: new Map([["row", 100]]),
            },
        );
        handleInitialScrollDataChange(ctx, {
            dataLength: 1,
            didDataChange: true,
            didStartFreshData: true,
            initialScrollAtEnd: false,
            latestInitialScroll: undefined,
            latestInitialScrollSessionKind: "bootstrap",
            stylePaddingEnd: 0,
            useBootstrapInitialScroll: true,
        });
        checkResetContainers(ctx, data);
        // A columns-only update has the same data epoch, but the old measurements are invalid.
        ctx.state.props.numColumns = 2;
        checkResetContainers(ctx, data, { didColumnsChange: true });
        expect(ctx.state.sizesKnown.size).toBe(0);
        ctx.state.scheduledWork.dispose();
    });

    it("reuses prepared geometry once and invalidates it for a later data epoch", () => {
        Platform.OS = "web";
        const data = Array.from({ length: 20 }, (_, index) => ({ id: `next-${index}` }));
        const ctx = createMockContext(
            { footerSize: 0, headerSize: 0, numColumns: 1, numContainers: 8, stylePaddingTop: 0 },
            {
                dataChangeEpoch: 1,
                hasHadNonEmptyData: true,
                props: { data, estimatedItemSize: 50, keyExtractor: (item: { id: string }) => item.id },
                scrollLength: 200,
            },
        );
        handleInitialScrollDataChange(ctx, {
            dataLength: data.length,
            didDataChange: true,
            didStartFreshData: true,
            initialScrollAtEnd: true,
            latestInitialScroll: { index: 19, viewPosition: 1 },
            latestInitialScrollSessionKind: "bootstrap",
            stylePaddingEnd: 0,
            useBootstrapInitialScroll: true,
        });
        const clear = spyOn(ctx.state.indexByKey, "clear");
        try {
            calculateItemsInView(ctx, { dataChanged: true });
            expect(clear).not.toHaveBeenCalled();
            expect(ctx.state.startBuffered).toBeGreaterThan(0);
            ctx.state.dataChangeEpoch++;
            ctx.state.props.data = Array.from({ length: 10 }, (_, index) => ({ id: `new-${index}` }));
            calculateItemsInView(ctx, { dataChanged: true });
            expect(clear).toHaveBeenCalledTimes(1);
            expect(ctx.state.indexByKey.has("next-19")).toBe(false);
            expect(ctx.state.idCache).toHaveLength(10);
        } finally {
            clear.mockRestore();
            ctx.state.scheduledWork.dispose();
        }
    });

    it("replays finished offset-only initial scrolls when data arrives after an empty mount", () => {
        const ctx = createMockContext(
            {
                adaptiveRender: "normal",
                readyToRender: true,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                initialScroll: {
                    contentOffset: 250,
                    index: 0,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                props: {
                    adaptiveRender: {
                        initialMode: "light",
                    },
                    data: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` })),
                },
                queuedInitialLayout: true,
            },
        );

        handleInitialScrollDataChange(ctx, {
            dataLength: ctx.state.props.data.length,
            didDataChange: true,
            initialScrollAtEnd: false,
            latestInitialScroll: ctx.state.initialScroll,
            latestInitialScrollSessionKind: "offset",
            stylePaddingEnd: 0,
            useBootstrapInitialScroll: false,
        });

        expect(ctx.state.didContainersLayout).toBe(true);
        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(ctx.values.get("readyToRender")).toBe(false);
        expect(ctx.values.get("adaptiveRender")).toBe("light");
        expect(ctx.state.initialScrollSession).toMatchObject({
            kind: "offset",
            previousDataLength: ctx.state.props.data.length,
        });
        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenCalledWith(ctx);
    });

    it("replays layout-ready measured initial scrolls from the lifecycle owner", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: { index: 5, viewOffset: 100 } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
            },
        );

        handleInitialScrollLayoutReady(ctx);
        rafCallbacks.shift()?.(0);

        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenCalledTimes(2);
        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenNthCalledWith(
            1,
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenNthCalledWith(
            2,
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
    });

    it("does not schedule a second layout-ready pass for offset-only initial scrolls", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: {
                    contentOffset: 250,
                    index: 0,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
            },
        );

        handleInitialScrollLayoutReady(ctx);

        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenCalledTimes(1);
        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
    });

    it("queues aligned completion checks from lifecycle-owned layout handling", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: { index: 5, viewOffset: 100 } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                scrollingTo: {
                    animated: false,
                    index: 5,
                    isInitialScroll: true,
                    offset: 220,
                    targetOffset: 220,
                    viewOffset: 0,
                } as StateContext["state"]["scrollingTo"],
                scrollPending: 220,
            },
        );

        handleInitialScrollLayoutReady(ctx);
        rafCallbacks.shift()?.(0);

        expect(checkFinishedScrollSpy).toHaveBeenCalledWith(ctx, { onlyIfAligned: true });
    });

    it("retargets unfinished bottom-aligned bootstrap initial scrolls", () => {
        const ctx = createMockContext(
            {},
            {
                didFinishInitialScroll: false,
                initialScroll: {
                    index: 2,
                    viewPosition: 1,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 3,
                } as StateContext["state"]["initialScrollSession"],
                props: {
                    data: [1, 2, 3],
                },
            },
        );

        expect(retargetActiveInitialScrollAtEnd(ctx)).toBe(true);
        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
    });

    it("corrects finished bottom-aligned end anchors after inset changes", () => {
        const data = Array.from({ length: 4 }, (_, index) => ({ id: `item-${index}` }));
        const ctx = createMockContext(
            {
                readyToRender: true,
                totalSize: 400,
            },
            {
                didFinishInitialScroll: true,
                idCache: data.map((item) => item.id),
                indexByKey: new Map(
                    data.map((item, index) => {
                        return [item.id, index];
                    }),
                ),
                initialScroll: {
                    index: 2,
                    viewOffset: 0,
                    viewPosition: 1,
                } as StateContext["state"]["initialScroll"],
                positions: [0, 100, 200, 300],
                props: {
                    data,
                    estimatedItemSize: 100,
                },
                scroll: 150,
                scrollLength: 100,
                scrollPending: 150,
                sizes: new Map(
                    data.map((item) => {
                        return [item.id, 100];
                    }),
                ),
            },
        );
        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => ctx.state.scroll,
                getScrollableNode: () => ({}),
                scrollTo: () => {},
            },
        } as StateContext["state"]["refScroller"];

        expect(retargetActiveInitialScrollAtEnd(ctx)).toBe(true);
        rafCallbacks.shift()?.(0);
        ctx.state.scheduledWork.cancel("ignoreScrollFromMVCP");
        expect(advanceCurrentInitialScrollSessionSpy).not.toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
        expect(ctx.state.scroll).toBe(200);
        expect(ctx.state.initialScroll).toMatchObject({
            index: 2,
            viewOffset: 0,
            viewPosition: 1,
        });
    });

    it("recomputes initialScrollAtEnd targets from the lifecycle-owned data-change path", () => {
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
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    bootstrap: {
                        frameHandle: 1,
                        mountFrameCount: 2,
                        passCount: 4,
                        scroll: 50,
                        seedContentOffset: 50,
                        targetIndexSeed: 1,
                    },
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 50, 100, 150, 200],
                props: {
                    data,
                    estimatedItemSize: 50,
                },
                scrollLength: 100,
            },
        );

        handleInitialScrollDataChange(ctx, {
            dataLength: data.length,
            didDataChange: true,
            initialScrollAtEnd: true,
            latestInitialScroll: ctx.state.initialScroll,
            latestInitialScrollSessionKind: "bootstrap",
            stylePaddingEnd: 0,
            useBootstrapInitialScroll: true,
        });

        expect(ctx.state.initialScroll?.contentOffset).toBeUndefined();
        expect(ctx.state.initialScroll?.index).toBe(4);
        expect(ctx.state.initialScroll?.viewOffset).toBeCloseTo(0);
        expect(ctx.state.initialScroll?.viewPosition).toBe(1);
        expect(ctx.state.initialScrollSession).toMatchObject({
            bootstrap: {
                passCount: 0,
                targetIndexSeed: 4,
            },
            kind: "bootstrap",
        });
    });
});
