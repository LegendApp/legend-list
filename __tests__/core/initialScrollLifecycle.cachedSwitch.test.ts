import { describe, expect, it } from "bun:test";
import "../setup";

import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { setInitialScrollTarget } from "../../src/core/initialScroll";
import { handleInitialScrollDataChange, initializeInitialScrollOnMount } from "../../src/core/initialScrollLifecycle";
import { onScroll } from "../../src/core/onScroll";
import { updateItemPositions } from "../../src/core/updateItemPositions";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import { resetInitialRenderState, setInitialRenderState } from "../../src/utils/setInitialRenderState";
import { createMockContext } from "../__mocks__/createMockContext";

// A retained list publishes A's extent in a later commit than the data-key change.
// The browser clamps any earlier scroll request against B's still-mounted extent.
describe("cached tall-row initial placement", () => {
    for (const recycleItems of [false, true]) {
        for (const [targetIndex, fresh] of [
            [75, false],
            [130, false],
            [150, false],
            [150, true],
        ] as const) {
            it(`lands on ${targetIndex} after ${fresh ? "a fresh mount" : "a completed B bootstrap"} and late growth (recycle ${recycleItems})`, () => {
                const previousPlatform = Platform.OS;
                const previousRAF = globalThis.requestAnimationFrame;
                const previousCAF = globalThis.cancelAnimationFrame;
                const frames = new Map<number, FrameRequestCallback>();
                let nextFrame = 0;
                Platform.OS = "web";
                globalThis.requestAnimationFrame = (callback) => {
                    frames.set(++nextFrame, callback);
                    return nextFrame;
                };
                globalThis.cancelAnimationFrame = (handle) => {
                    frames.delete(handle);
                };

                const dataA = Array.from({ length: 151 }, (_, index) => ({ id: `a-${index}` }));
                const dataB = Array.from({ length: 19 }, (_, index) => ({ id: `b-${index}` }));
                const heightAt = (index: number) => (index % 7 === 0 ? 600 : 86);
                const ctx = createMockContext(
                    {
                        headerSize: 0,
                        numColumns: 1,
                        numContainers: 32,
                        numContainersPooled: 32,
                        readyToRender: true,
                        stylePaddingTop: 0,
                    },
                    {
                        didContainersLayout: true,
                        didFinishInitialScroll: true,
                        hasHadNonEmptyData: true,
                        props: {
                            data: fresh ? dataA : dataB,
                            drawDistance: 1000,
                            estimatedItemSize: 86,
                            keyExtractor: (item: { id: string }) => item.id,
                            recycleItems,
                        },
                        queuedInitialLayout: true,
                        scrollLength: 804,
                    },
                );
                const state = ctx.state;
                for (const data of fresh ? [dataA] : [dataA, dataB]) {
                    data.forEach((item, index) => {
                        state.sizes.set(item.id, heightAt(index));
                        state.sizesKnown.set(item.id, heightAt(index));
                    });
                }
                updateItemPositions(ctx, true);
                let domHeight = state.totalSize;
                let physicalScroll = fresh ? 0 : state.positions[10]!;
                let pendingScrollEvent = false;
                const clamp = (offset: number) => Math.max(0, Math.min(offset, domHeight - state.scrollLength));
                state.scroll = physicalScroll;
                state.scrollPending = physicalScroll;
                state.refScroller.current = {
                    getCurrentScrollOffset: () => physicalScroll,
                    getMaxScrollOffset: () => domHeight - state.scrollLength,
                    getScrollableNode: () => ({}),
                    scrollTo: ({ y = 0 }: { y?: number }) => {
                        physicalScroll = clamp(y);
                        pendingScrollEvent = true;
                    },
                } as any;
                state.triggerCalculateItemsInView = (options) => calculateItemsInView(ctx, options);
                state.scrollAdjustHandler.requestAdjust = () => {
                    // ScrollAdjust pads the old extent until React commits the new height.
                    if (targetIndex === 150) {
                        domHeight = state.totalSize + 1320;
                        requestAnimationFrame(() => {
                            domHeight = state.totalSize;
                        });
                    }
                    physicalScroll = clamp(state.scroll);
                    pendingScrollEvent = true;
                };
                const flushFrame = (time: number) => {
                    // Browser scroll events run before the scroll completion RAF.
                    if (pendingScrollEvent) {
                        pendingScrollEvent = false;
                        onScroll(ctx, {
                            nativeEvent: {
                                contentOffset: { x: 0, y: physicalScroll },
                                contentSize: { height: domHeight, width: 1000 },
                                layoutMeasurement: { height: state.scrollLength, width: 1000 },
                            },
                        } as any);
                    }
                    const pending = [...frames.values()];
                    frames.clear();
                    for (const callback of pending) callback(time);
                    domHeight = state.totalSize;
                };

                try {
                    state.props.data = dataA;
                    resetInitialRenderState(ctx, { resetInitialScroll: true, resetLayout: true });
                    const target = { index: targetIndex, viewOffset: 0, viewPosition: targetIndex === 150 ? 1 : 0 };
                    if (fresh) {
                        setInitialScrollTarget(ctx, target);
                        updateItemPositions(ctx, true);
                        initializeInitialScrollOnMount(ctx, {
                            dataLength: dataA.length,
                            hasFooterComponent: false,
                            initialContentOffset: 0,
                            initialScrollAtEnd: true,
                            useBootstrapInitialScroll: true,
                        });
                    } else {
                        handleInitialScrollDataChange(ctx, {
                            dataLength: dataA.length,
                            didDataChange: true,
                            didStartFreshData: true,
                            initialScrollAtEnd: targetIndex === 150,
                            latestInitialScroll: target,
                            latestInitialScrollSessionKind: "bootstrap",
                            stylePaddingEnd: 0,
                            useBootstrapInitialScroll: true,
                        });
                    }
                    calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });
                    // React now commits the newly published total size to the DOM.
                    domHeight = state.totalSize;
                    for (let frame = 1; frame <= 5; frame++) flushFrame(frame * 16);

                    if (targetIndex === 150) {
                        expect(Math.abs(domHeight - state.scrollLength - physicalScroll)).toBeLessThanOrEqual(1);
                        setInitialRenderState(ctx, { didLayout: true });
                        calculateItemsInView(ctx);
                    }
                    // Rows 136-150 grow by 900px in total after initial placement.
                    // MVCP alone follows the interior anchor by 720px, leaving 180px unseen.
                    updateItemSizesBatch(
                        ctx,
                        (targetIndex === 150
                            ? dataA.slice(136).map((item) => item.id)
                            : [...state.containerItemKeys.keys()]
                        ).map((itemKey) => ({
                            itemKey,
                            size: { height: heightAt(state.indexByKey.get(itemKey)!) + 60, width: 1000 },
                        })),
                    );
                    domHeight = state.totalSize;
                    for (let frame = 6; frame <= 12; frame++) flushFrame(frame * 16);

                    expect(state.didFinishInitialScroll).toBe(true);
                    expect(
                        Math.abs(
                            physicalScroll -
                                (targetIndex === 150 ? domHeight - state.scrollLength : state.positions[targetIndex]!),
                        ),
                    ).toBeLessThanOrEqual(1);
                    expect(state.startBuffered).toBeLessThanOrEqual(targetIndex);
                    expect(state.endBuffered).toBeGreaterThanOrEqual(targetIndex);
                } finally {
                    state.scheduledWork.dispose();
                    globalThis.requestAnimationFrame = previousRAF;
                    globalThis.cancelAnimationFrame = previousCAF;
                    Platform.OS = previousPlatform;
                }
            });
        }
    }
});
