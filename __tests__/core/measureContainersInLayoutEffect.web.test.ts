import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { cancelScroll } from "../../src/core/cancelScroll";
import { getContainerLayoutBaseline } from "../../src/core/containerLayoutBaseline";
import { handleInitialScrollDataChange } from "../../src/core/initialScrollLifecycle";
import { Platform } from "../../src/platform/Platform";
import { peek$ } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

const originalPlatform = Platform.OS;
const originalRAF = globalThis.requestAnimationFrame;
afterEach(() => {
    Platform.OS = originalPlatform;
    globalThis.requestAnimationFrame = originalRAF;
    mock.restore();
});

describe("measureContainersInLayoutEffect web", () => {
    function setupCachedReturn(height: number, drawDistance = 0) {
        Platform.OS = "web";
        const frames: FrameRequestCallback[] = [];
        globalThis.requestAnimationFrame = (callback) => {
            frames.push(callback);
            return frames.length;
        };
        const data = [
            { height: 70, id: "a" },
            { height: 130, id: "b" },
            { height, id: "tail" },
        ];
        const ctx = createMockContext(
            {
                footerSize: 0,
                headerSize: 0,
                numColumns: 1,
                numContainers: 3,
                numContainersPooled: 3,
                stylePaddingTop: 0,
            },
            {
                dataChangeEpoch: 1,
                didContainersLayout: false,
                didFinishInitialScroll: false,
                hasHadNonEmptyData: true,
                props: {
                    data: [{ height: 100, id: "other" }],
                    dataKey: "B",
                    drawDistance,
                    estimatedItemSize: 100,
                    keyExtractor: (item) => item.id,
                },
                scrollLength: 100,
                sizes: new Map([
                    ["a", 70],
                    ["b", 130],
                    ["tail", 100],
                ]),
                sizesKnown: new Map([
                    ["a", 70],
                    ["b", 130],
                    ["tail", 100],
                ]),
            },
        );
        let observed = 0;
        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => observed,
                getMaxScrollOffset: () => Math.max(0, ctx.state.totalSize - ctx.state.scrollLength),
                getScrollableNode: () => ({}),
                scrollTo: ({ y }: { y: number }) => {
                    observed = Math.min(y, Math.max(0, ctx.state.totalSize - ctx.state.scrollLength));
                },
            },
        } as any;
        ctx.state.triggerCalculateItemsInView = (params) =>
            calculateItemsInViewModule.calculateItemsInView(ctx, params);
        ctx.state.previousData = ctx.state.props.data;
        ctx.state.props.data = data;
        ctx.state.props.dataKey = "A";
        ctx.state.dataChangeEpoch++;
        handleInitialScrollDataChange(ctx, {
            dataLength: data.length,
            didDataChange: true,
            didStartFreshData: true,
            initialScrollAtEnd: true,
            latestInitialScroll: { index: 2, preserveForBottomPadding: true, viewPosition: 1 },
            latestInitialScrollSessionKind: "bootstrap",
            stylePaddingEnd: 0,
            useBootstrapInitialScroll: true,
        });
        calculateItemsInViewModule.calculateItemsInView(ctx, { dataChanged: true });
        for (const [key, containerId] of ctx.state.containerItemKeys) {
            ctx.viewRefs.set(containerId, {
                current: {
                    getBoundingClientRect: () => ({ height: data.find((item) => item.id === key)!.height, width: 320 }),
                },
            } as any);
        }
        return { ctx, frames };
    }

    it("settles a cached dataKey viewport in the real measurement batch when its payload height changed", async () => {
        const { measureContainersInLayoutEffect } = await import(
            "../../src/core/measureContainersInLayoutEffect.ts?web-layout-cached-bootstrap"
        );
        const { ctx } = setupCachedReturn(122);
        try {
            expect(ctx.state.scrollingTo).toBeUndefined();
            measureContainersInLayoutEffect(ctx);
            await Promise.resolve();
            expect(ctx.state.scrollingTo?.targetOffset).toBe(222);
            expect(
                ctx.state.initialScrollSession?.kind === "bootstrap" && ctx.state.initialScrollSession.bootstrap,
            ).toBeUndefined();
            expect(ctx.state.sizesKnown.get("tail")).toBe(122);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    for (const commitsBeforeMicrotask of [true, false]) {
        it(`waits for the real footer extent before dispatching a clamped transport (${commitsBeforeMicrotask})`, async () => {
            const { measureContainersInLayoutEffect } = await import(
                "../../src/core/measureContainersInLayoutEffect.ts?web-layout-committed-footer"
            );
            const { ctx, frames } = setupCachedReturn(122);
            ctx.values.set("footerSize", 40);
            ctx.state.initialScroll!.viewOffset = -40;
            let physicalMax = 240;
            let observed = physicalMax;
            const scrollTo = mock(({ y }: { y: number }) => {
                observed = Math.min(y, physicalMax);
            });
            ctx.state.refScroller = {
                current: {
                    getCurrentScrollOffset: () => observed,
                    getMaxScrollOffset: () => physicalMax,
                    getScrollableNode: () => ({}),
                    scrollTo,
                },
            } as any;
            try {
                measureContainersInLayoutEffect(ctx);
                expect(scrollTo).not.toHaveBeenCalled();
                expect(ctx.state.totalSize).toBe(322);
                if (commitsBeforeMicrotask) physicalMax = 262;
                await Promise.resolve();
                if (!commitsBeforeMicrotask) {
                    expect(scrollTo).not.toHaveBeenCalled();
                    expect(ctx.state.scrollingTo).toBeUndefined();
                    physicalMax = 262;
                    for (let count = 0; count < 20 && !ctx.state.scrollingTo; count++) frames.shift()?.(count * 16);
                }
                expect(scrollTo).toHaveBeenCalledTimes(1);
                expect(ctx.state.scrollingTo?.targetOffset).toBe(262);
                expect(physicalMax - observed).toBe(0);
            } finally {
                ctx.state.scheduledWork.dispose();
            }
        });
    }

    it("waits when measured shrink allocates a cached row that was not in the committed batch", async () => {
        const { measureContainersInLayoutEffect } = await import(
            "../../src/core/measureContainersInLayoutEffect.ts?web-layout-new-cached-row"
        );
        const { ctx } = setupCachedReturn(50);
        try {
            measureContainersInLayoutEffect(ctx);
            await Promise.resolve();
            expect(ctx.state.scrollingTo).toBeUndefined();
            expect(ctx.state.containerItemKeys.has("b")).toBe(true);
            expect(ctx.state.sizesKnown.get("b")).toBe(130);
            const containerId = ctx.state.containerItemKeys.get("b")!;
            ctx.viewRefs.set(containerId, {
                current: { getBoundingClientRect: () => ({ height: 130, width: 320 }) },
            } as any);
            measureContainersInLayoutEffect(ctx);
            await Promise.resolve();
            expect(ctx.state.scrollingTo?.targetOffset).toBe(150);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("waits for a cached mounted buffer row even when the measured viewport is unchanged", async () => {
        const { measureContainersInLayoutEffect } = await import(
            "../../src/core/measureContainersInLayoutEffect.ts?web-layout-buffer-proof"
        );
        const { ctx } = setupCachedReturn(122, 100);
        ctx.viewRefs.delete(ctx.state.containerItemKeys.get("b")!);
        try {
            measureContainersInLayoutEffect(ctx, new Set([ctx.state.containerItemKeys.get("tail")!]));
            await Promise.resolve();
            expect(
                ctx.state.initialScrollSession?.kind === "bootstrap" &&
                    ctx.state.initialScrollSession.bootstrap?.visibleIndices,
            ).toEqual([2]);
            expect(ctx.state.containerItemKeys.has("b")).toBe(true);
            expect(ctx.state.scrollingTo).toBeUndefined();
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("keeps a complete current DOM cohort when a partial pass replaces the pending microtask", async () => {
        const { measureContainersInLayoutEffect } = await import(
            "../../src/core/measureContainersInLayoutEffect.ts?web-layout-coalesced-full-cohort"
        );
        const { ctx } = setupCachedReturn(122, 100);
        ctx.values.set("footerSize", 40);
        ctx.state.initialScroll!.viewOffset = -40;
        let physicalMax = 240;
        let observed = physicalMax;
        const scrollTo = mock(({ y }: { y: number }) => {
            observed = Math.min(y, physicalMax);
        });
        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => observed,
                getMaxScrollOffset: () => physicalMax,
                getScrollableNode: () => ({}),
                scrollTo,
            },
        } as any;
        const bufferElement = ctx.viewRefs.get(ctx.state.containerItemKeys.get("b")!)!.current!;
        const bufferRead = spyOn(bufferElement, "getBoundingClientRect");
        try {
            measureContainersInLayoutEffect(ctx);
            expect(ctx.state.scheduledWork.has("bootstrapMeasuredLayout")).toBe(true);
            bufferRead.mockClear();
            const tailId = ctx.state.containerItemKeys.get("tail")!;
            ctx.viewRefs.set(tailId, {
                current: { getBoundingClientRect: () => ({ height: 145, width: 320 }) },
            } as any);
            measureContainersInLayoutEffect(ctx, new Set([tailId]));
            expect(bufferRead).toHaveBeenCalledTimes(1);
            expect(scrollTo).not.toHaveBeenCalled();
            physicalMax = 285;
            await Promise.resolve();
            expect(ctx.state.sizesKnown.get("tail")).toBe(145);
            expect(ctx.state.scrollingTo?.targetOffset).toBe(285);
            expect(scrollTo).toHaveBeenCalledTimes(1);
            expect(physicalMax - observed).toBe(0);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("keeps targeted measurement narrow after bootstrap has finished", async () => {
        const { measureContainersInLayoutEffect } = await import(
            "../../src/core/measureContainersInLayoutEffect.ts?web-layout-post-bootstrap-scope"
        );
        const { ctx } = setupCachedReturn(122, 100);
        ctx.state.initialScrollSession = undefined;
        ctx.state.initialScroll = undefined;
        ctx.state.didFinishInitialScroll = true;
        ctx.state.didContainersLayout = true;
        const bufferElement = ctx.viewRefs.get(ctx.state.containerItemKeys.get("b")!)!.current!;
        const bufferRead = spyOn(bufferElement, "getBoundingClientRect");
        try {
            measureContainersInLayoutEffect(ctx, new Set([ctx.state.containerItemKeys.get("tail")!]));
            await Promise.resolve();
            expect(bufferRead).not.toHaveBeenCalled();
            expect(ctx.state.sizesKnown.get("tail")).toBe(122);
            expect(ctx.state.scheduledWork.has("bootstrapMeasuredLayout")).toBe(false);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    for (const invalidation of ["assignment", "data epoch", "interruption"] as const) {
        for (const afterMeasurement of [false, true]) {
            it(`does not reuse a measurement batch after ${invalidation} (${afterMeasurement})`, async () => {
                const { measureContainersInLayoutEffect } = await import(
                    "../../src/core/measureContainersInLayoutEffect.ts?web-layout-invalidated-proof"
                );
                const { ctx } = setupCachedReturn(122);
                const containerId = ctx.state.containerItemKeys.get("tail")!;
                const invalidate = () => {
                    if (invalidation === "assignment") ctx.values.set(`containerItemKey${containerId}`, "replacement");
                    else if (invalidation === "data epoch") ctx.state.dataChangeEpoch++;
                    else cancelScroll(ctx);
                };
                if (!afterMeasurement && invalidation === "assignment") {
                    ctx.viewRefs.set(containerId, {
                        current: {
                            getBoundingClientRect: () => {
                                invalidate();
                                return { height: 122, width: 320 };
                            },
                        },
                    } as any);
                } else if (!afterMeasurement) {
                    ctx.state.props.onItemSizeChanged = invalidate;
                }
                try {
                    measureContainersInLayoutEffect(ctx);
                    if (afterMeasurement) invalidate();
                    await Promise.resolve();
                    expect(ctx.state.scrollingTo).toBeUndefined();
                    if (!afterMeasurement && invalidation === "assignment")
                        expect(ctx.state.sizesKnown.get("tail")).toBe(100);
                } finally {
                    ctx.state.scheduledWork.dispose();
                }
            });
        }
    }

    it("rejects a same-slot ABA measurement after real container assignments advance its generation", async () => {
        const { measureContainersInLayoutEffect } = await import(
            "../../src/core/measureContainersInLayoutEffect.ts?web-layout-generation-proof"
        );
        const { ctx } = setupCachedReturn(122);
        const state = ctx.state;
        const containerId = state.containerItemKeys.get("tail")!;
        const generation = state.containerItemGenerations[containerId];
        ctx.values.set("numContainers", 1);
        ctx.values.set("numContainersPooled", 1);
        ctx.viewRefs.set(containerId, {
            current: {
                getBoundingClientRect: () => {
                    const session = state.initialScrollSession;
                    const target = state.initialScroll;
                    state.initialScroll = undefined;
                    state.initialScrollSession = undefined;
                    state.didContainersLayout = true;
                    state.didFinishInitialScroll = true;
                    state.scroll = 0;
                    calculateItemsInViewModule.calculateItemsInView(ctx, { forceFullItemPositions: true });
                    expect(peek$(ctx, `containerItemKey${containerId}`)).not.toBe("tail");
                    state.scroll = 200;
                    calculateItemsInViewModule.calculateItemsInView(ctx, { forceFullItemPositions: true });
                    expect(peek$(ctx, `containerItemKey${containerId}`)).toBe("tail");
                    expect(state.containerItemGenerations[containerId]).toBeGreaterThan(generation!);
                    state.initialScroll = target;
                    state.initialScrollSession = session;
                    state.didContainersLayout = false;
                    state.didFinishInitialScroll = false;
                    return { height: 122, width: 320 };
                },
            },
        } as any);
        try {
            measureContainersInLayoutEffect(ctx);
            await Promise.resolve();
            expect(state.scrollingTo).toBeUndefined();
        } finally {
            state.scheduledWork.dispose();
        }
    });

    it("uses the current narrower DOM width and measured height instead of cached geometry", async () => {
        const { measureContainersInLayoutEffect } = await import(
            "../../src/core/measureContainersInLayoutEffect.ts?web-layout-width-proof"
        );
        const { ctx } = setupCachedReturn(122);
        const containerId = ctx.state.containerItemKeys.get("tail")!;
        const element = { getBoundingClientRect: () => ({ height: 146, width: 240 }) } as HTMLElement;
        ctx.viewRefs.set(containerId, { current: element } as any);
        try {
            measureContainersInLayoutEffect(ctx);
            await Promise.resolve();
            expect(getContainerLayoutBaseline(element)?.width).toBe(240);
            expect(ctx.state.sizesKnown.get("tail")).toBe(146);
            expect(ctx.state.scrollingTo?.targetOffset).toBe(246);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("records the measured layout for the ResizeObserver baseline", async () => {
        const { measureContainersInLayoutEffect } = await import(
            "../../src/core/measureContainersInLayoutEffect.ts?web-layout-baseline"
        );
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const ctx = createMockContext(
            {
                containerItemKey0: "item_0",
                otherAxisSize: 400,
                readyToRender: true,
            },
            {
                didContainersLayout: true,
                endBuffered: 0,
                indexByKey: new Map([["item_0", 0]]),
                props: {
                    data: [{ id: "item_0" }],
                    estimatedItemSize: 100,
                },
                sizes: new Map([["item_0", 100]]),
                sizesKnown: new Map([["item_0", 100]]),
                startBuffered: 0,
            },
        );
        const rect = { height: 180, width: 320 } as DOMRect;
        const getBoundingClientRect = mock(() => rect);
        const element = { getBoundingClientRect } as HTMLElement;
        ctx.state.containerItemKeys.set("item_0", 0);
        ctx.viewRefs.set(0, { current: element } as any);

        measureContainersInLayoutEffect(ctx);

        expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
        expect(getContainerLayoutBaseline(element)).toBe(rect);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(180);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });
});
