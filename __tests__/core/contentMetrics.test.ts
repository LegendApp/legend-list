import { describe, expect, it, mock, spyOn } from "bun:test";
import { clampScrollOffset } from "../../src/core/clampScrollOffset";
import { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import { setContentInsetOverride, setFooterSize, setHeaderSize } from "../../src/core/updateContentMetrics";
import { updateContentMetricsState } from "../../src/core/updateContentMetricsState";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import { getContentSize } from "../../src/state/getContentSize";
import { peek$ } from "../../src/state/state";
import { checkThresholds } from "../../src/utils/checkThresholds";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateContentMetrics", () => {
    for (const os of ["ios", "android", "web"] as const) {
        it(`counts native prop insets in content length and clamping only on ios (${os})`, () => {
            const previous = Platform.OS;
            Platform.OS = os;
            try {
                const ctx = createMockContext(
                    { totalSize: 1000 },
                    {
                        lastLayout: { height: 500, width: 300, x: 0, y: 0 },
                        props: { contentInset: { bottom: 100 } },
                        scrollLength: 500,
                    },
                );
                const length = os === "ios" ? 1100 : 1000;
                expect(getContentSize(ctx)).toBe(length);
                expect(createImperativeHandle(ctx).getState().contentLength).toBe(length);
                expect(clampScrollOffset(ctx, 9999)).toBe(length - 500);
            } finally {
                Platform.OS = previous;
            }
        });
    }

    it.each([
        { adjustment: 0, anchored: 0, bottom: 86, expected: 947.667, minimum: 861.667, os: "ios" },
        { adjustment: 0, anchored: 200, bottom: 0, expected: 1000, minimum: 1000, os: "ios" },
        { adjustment: 0, anchored: 200, bottom: 86, expected: 1086, minimum: 1000, os: "ios" },
        { adjustment: 86, anchored: 0, bottom: 0, expected: 700, minimum: 700, os: "web" },
        { adjustment: 300, anchored: 250, bottom: 0, expected: 700, minimum: 700, os: "web" },
        { adjustment: 400, anchored: 250, bottom: 0, expected: 750, minimum: 700, os: "web" },
    ] as const)(
        "matches the physical minimum and end space: %j",
        ({ os, minimum, bottom, anchored, adjustment, expected }) => {
            Platform.OS = os;
            const ctx = createMockContext(
                { anchoredEndSpaceSize: anchored, totalSize: 350 },
                {
                    props: {
                        anchoredEndSpace: anchored ? { anchorIndex: 0 } : undefined,
                        contentContainerMinSize: minimum,
                        contentInset: { bottom, left: 0, right: 0, top: 0 },
                        contentInsetEndAdjustment: adjustment,
                    },
                    scrollLength: 600,
                },
            );
            expect(getContentSize(ctx)).toBeCloseTo(expected, 6);
            expect(clampScrollOffset(ctx, Infinity)).toBeCloseTo(expected - 600, 6);
            expect(createImperativeHandle(ctx).getState().contentLength).toBeCloseTo(expected, 6);
        },
    );

    for (const change of ["header", "footer", "row"] as const) {
        it(`rechecks end pagination after ${change} shrink without a scroll`, () => {
            const onEndReached = mock(() => {});
            const ctx = createMockContext(
                { footerSize: 100, headerSize: 100, totalSize: 1000 },
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    positions: [0],
                    props: {
                        data: [0],
                        maintainVisibleContentPosition: { data: false, size: false },
                        onEndReached,
                        onEndReachedThreshold: 1,
                    },
                    queuedInitialLayout: true,
                    scroll: 100,
                    scrollLength: 500,
                    sizes: new Map([["item_0", 1000]]),
                    sizesKnown: new Map([["item_0", 1000]]),
                },
            );
            checkThresholds(ctx);
            expect(onEndReached).not.toHaveBeenCalled();
            const shrink = () => {
                if (change === "header") setHeaderSize(ctx, 0);
                else if (change === "footer") setFooterSize(ctx, 0);
                else updateItemSizesBatch(ctx, [{ itemKey: "item_0", size: { height: 900, width: 300 } }]);
            };
            shrink();
            expect(onEndReached).toHaveBeenCalledTimes(1);
            expect(onEndReached).toHaveBeenCalledWith({ distanceFromEnd: 500 });
            expect(ctx.state.scroll).toBe(100);
            shrink();
            expect(onEndReached).toHaveBeenCalledTimes(1);
            ctx.state.scheduledWork.dispose();
        });
    }

    it("counts padding on the active scroll axis", () => {
        const ctx = createMockContext(
            {
                footerSize: 20,
                headerSize: 10,
                stylePaddingTop: 100,
                totalSize: 100,
            },
            {
                props: {
                    horizontal: true,
                    stylePaddingBottom: 200,
                    stylePaddingLeft: 12,
                    stylePaddingRight: 18,
                },
            },
        );

        expect(getContentSize(ctx)).toBe(160);
    });

    it("excludes the trailing gap removed by the containers layer", () => {
        const ctx = createMockContext(
            { totalSize: 108 },
            {
                props: { data: [1] },
            },
        );
        ctx.scrollAxisGap = 8;

        expect(getContentSize(ctx)).toBe(100);
    });

    it("uses leading padding to absorb end inset for short vertical alignItemsAtEnd content", () => {
        const ctx = createMockContext(
            {
                totalSize: 84,
            },
            {
                contentInsetOverride: { bottom: 301 },
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 84,
            },
        );

        updateContentMetricsState(ctx);

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(279);
        expect(getContentSize(ctx)).toBe(664);
        expect(clampScrollOffset(ctx, 999)).toBe(0);
    });

    it("creates scroll range only for the end inset that exceeds available leading space", () => {
        const ctx = createMockContext(
            {
                totalSize: 500,
            },
            {
                contentInsetOverride: { bottom: 301 },
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 500,
            },
        );

        updateContentMetricsState(ctx);

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(0);
        expect(getContentSize(ctx)).toBe(801);
        expect(clampScrollOffset(ctx, 999)).toBe(137);
    });

    for (const top of [0, 116]) {
        for (const totalSize of [84, 1000]) {
            it(`keeps the iOS scroll range for alignItemsAtEnd within the content (top ${top}, size ${totalSize})`, () => {
                const previous = Platform.OS;
                Platform.OS = "ios";
                try {
                    const ctx = createMockContext(
                        { totalSize },
                        {
                            props: {
                                alignItemsAtEnd: true,
                                alignItemsAtEndPaddingEnabled: true,
                                contentInset: { bottom: 0, left: 0, right: 0, top },
                                data: [1],
                            },
                            scrollLength: 664,
                            totalSize,
                        },
                    );

                    updateContentMetricsState(ctx);

                    const isShort = totalSize < 664;
                    expect(ctx.values.get("alignItemsAtEndPadding")).toBe(isShort ? 664 - totalSize - top : 0);
                    expect(getContentSize(ctx)).toBe(isShort ? 664 - top : totalSize);
                    // Scroll-to-top rests just below the inset, and a short list has no range past it.
                    expect(clampScrollOffset(ctx, -999)).toBe(0 - top);
                    expect(clampScrollOffset(ctx, 999)).toBe(isShort ? 0 - top : totalSize - 664);
                } finally {
                    Platform.OS = previous;
                }
            });
        }
    }

    for (const platform of ["ios", "android", "web"] as const) {
        for (const bottom of [0, 40, 120]) {
            it(`${platform} recomputes short-list range through growth and bottom inset ${bottom}`, () => {
                Platform.OS = platform;
                const ctx = createMockContext(
                    {},
                    {
                        lastLayout: { height: 400, width: 320, x: 0, y: 0 },
                        props: {
                            alignItemsAtEnd: true,
                            alignItemsAtEndPaddingEnabled: true,
                            contentInset: { bottom, left: 0, right: 0, top: 96 },
                            data: [1, 2],
                        },
                        scrollLength: 400,
                        totalSize: 160,
                    },
                );
                for (const [size, expectedPadding, expectedEnd] of platform === "ios"
                    ? [
                          [160, 144 - bottom, -96],
                          [400, 0, bottom],
                          [480, 0, 80 + bottom],
                          [160, 144 - bottom, -96],
                      ]
                    : [
                          [160, 240, 0],
                          [400, 0, 0],
                          [480, 0, 80],
                          [160, 240, 0],
                      ]) {
                    ctx.state.totalSize = size;
                    updateContentMetricsState(ctx);
                    expect(peek$(ctx, "alignItemsAtEndPadding")).toBe(expectedPadding);
                    expect(clampScrollOffset(ctx, 9999)).toBe(expectedEnd);
                    expect(clampScrollOffset(ctx, -9999)).toBe(platform === "ios" ? -96 : 0);
                }
                ctx.state.scheduledWork.dispose();
            });
        }
    }

    it("deducts headers, footers, both insets and padding before end-aligning short iOS content", () => {
        Platform.OS = "ios";
        const ctx = createMockContext(
            { footerSize: 20, headerSize: 64, stylePaddingTop: 12 },
            {
                props: {
                    alignItemsAtEndPaddingEnabled: true,
                    contentInset: { bottom: 40, left: 0, right: 0, top: 96 },
                    data: [1, 2],
                    stylePaddingBottom: 8,
                    stylePaddingTop: 12,
                },
                scrollLength: 400,
                totalSize: 80,
            },
        );
        updateContentMetricsState(ctx);
        expect(peek$(ctx, "alignItemsAtEndPadding")).toBe(80);
        expect(getContentSize(ctx)).toBe(304);
        expect(clampScrollOffset(ctx, -999)).toBe(-96);
        expect(clampScrollOffset(ctx, 999)).toBe(-96);
        ctx.state.scheduledWork.dispose();
    });

    it("does not add leading padding when alignItemsAtEnd padding is disabled", () => {
        const ctx = createMockContext(
            {
                totalSize: 84,
            },
            {
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: false,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 84,
            },
        );

        updateContentMetricsState(ctx);

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(0);
    });

    it("releases animation runway when no maintain pass claims it", async () => {
        const ctx = createMockContext(
            { alignItemsAtEndPadding: 250, totalSize: 200 },
            {
                didContainersLayout: true,
                isWithinMaintainScrollAtEndThreshold: true,
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                    maintainScrollAtEnd: { animated: true },
                },
                scrollLength: 400,
                totalSize: 200,
            },
        );

        updateContentMetricsState(ctx);
        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(250);

        await Promise.resolve();

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(200);
    });

    it("coalesces animation runway fallback across synchronous content growth", async () => {
        const ctx = createMockContext(
            { alignItemsAtEndPadding: 250, totalSize: 200 },
            {
                didContainersLayout: true,
                isWithinMaintainScrollAtEndThreshold: true,
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                    maintainScrollAtEnd: { animated: true },
                },
                scrollLength: 400,
                totalSize: 200,
            },
        );

        updateContentMetricsState(ctx);
        ctx.values.set("totalSize", 240);
        updateContentMetricsState(ctx);

        expect(ctx.state.scheduledWork.has("alignItemsAtEndPaddingFallback")).toBe(true);
        await Promise.resolve();

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(160);
        expect(ctx.state.scheduledWork.has("alignItemsAtEndPaddingFallback")).toBe(false);
    });

    it("does not schedule fallback work after animated maintenance claims the runway", async () => {
        const ctx = createMockContext(
            { alignItemsAtEndPadding: 250, totalSize: 240 },
            {
                didContainersLayout: true,
                maintainingScrollAtEnd: "animated",
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                    maintainScrollAtEnd: { animated: true },
                },
                scrollLength: 400,
                totalSize: 240,
            },
        );

        updateContentMetricsState(ctx);
        ctx.state.maintainingScrollAtEnd = undefined;
        await Promise.resolve();

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(250);
    });

    it("updates content metrics when header size changes through the domain setter", () => {
        const ctx = createMockContext(
            {
                headerSize: 20,
                totalSize: 84,
            },
            {
                contentInsetOverride: { bottom: 301 },
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 84,
            },
        );

        updateContentMetricsState(ctx);
        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(259);

        setHeaderSize(ctx, 0);

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(279);
    });

    it("updates content metrics when reported content inset changes", () => {
        const ctx = createMockContext(
            {
                totalSize: 84,
            },
            {
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 84,
            },
        );

        updateContentMetricsState(ctx);
        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(580);

        expect(setContentInsetOverride(ctx, { bottom: 301 })).toBe(true);
        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(279);
        expect(setContentInsetOverride(ctx, { bottom: 301 })).toBe(false);
    });

    it("updates content metrics when footer size changes through the domain setter", () => {
        const ctx = createMockContext(
            {
                footerSize: 20,
                totalSize: 84,
            },
            {
                contentInsetOverride: { bottom: 301 },
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 84,
            },
        );

        updateContentMetricsState(ctx);
        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(259);

        expect(setFooterSize(ctx, 0)).toBe(true);

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(279);
    });

    it("reports unchanged footer sizes without updating content metrics", () => {
        const ctx = createMockContext(
            {
                footerSize: 12,
                totalSize: 1000,
            },
            {
                props: {},
            },
        );

        expect(setFooterSize(ctx, 12)).toBe(false);
        expect(ctx.values.get("footerSize")).toBe(12);
    });

    for (const platformOS of ["web", "ios", "android"] as const) {
        it(`compensates MVCP on ${platformOS} when a measured header changes above the viewport`, () => {
            const prevPlatform = Platform.OS;
            Platform.OS = platformOS;
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const ctx = createMockContext(
                {
                    headerSize: 60,
                    readyToRender: true,
                    totalSize: 1000,
                },
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    props: {
                        data: [1],
                        maintainVisibleContentPosition: { data: false, size: true },
                    },
                    scroll: 200,
                    scrollLength: 500,
                    totalSize: 1000,
                },
            );

            try {
                setHeaderSize(ctx, 60);
                expect(requestAdjustSpy).not.toHaveBeenCalled();

                requestAdjustSpy.mockClear();
                setHeaderSize(ctx, 120);

                expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 60);

                requestAdjustSpy.mockClear();
                setHeaderSize(ctx, 60);

                expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, -60);
            } finally {
                requestAdjustSpy.mockRestore();
                Platform.OS = prevPlatform;
            }
        });

        it(`settles the scroll position on ${platformOS} when a measured header grows above the viewport`, () => {
            const prevPlatform = Platform.OS;
            Platform.OS = platformOS;
            const ctx = createMockContext(
                {
                    headerSize: 60,
                    readyToRender: true,
                    totalSize: 1000,
                },
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    props: {
                        data: [1],
                        maintainVisibleContentPosition: { data: false, size: true },
                    },
                    scroll: 200,
                    scrollLength: 500,
                    totalSize: 1000,
                },
            );
            // Drive the real adjust handler so the assertion is about the resulting scroll
            // position the user sees, not just that an adjustment was requested.
            ctx.state.scrollAdjustHandler = new ScrollAdjustHandler(ctx);

            try {
                setHeaderSize(ctx, 60);
                setHeaderSize(ctx, 120);

                // The header grew by 60 above the viewport, so the same content stays put.
                expect(ctx.state.scroll).toBe(260);
                expect(ctx.values.get("scrollAdjust")).toBe(60);
            } finally {
                ctx.state.scheduledWork.dispose();
                Platform.OS = prevPlatform;
            }
        });
    }

    it("does not compensate the initial web MVCP header measurement", () => {
        const prevPlatform = Platform.OS;
        Platform.OS = "web";
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        const ctx = createMockContext(
            {
                readyToRender: true,
                totalSize: 1000,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                props: {
                    data: [1],
                    maintainVisibleContentPosition: { data: false, size: true },
                },
                scroll: 200,
                scrollLength: 500,
                totalSize: 1000,
            },
        );

        try {
            setHeaderSize(ctx, 60);

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        } finally {
            requestAdjustSpy.mockRestore();
            Platform.OS = prevPlatform;
        }
    });

    it("compensates the first non-zero web MVCP header measurement after a known absent header", () => {
        const prevPlatform = Platform.OS;
        Platform.OS = "web";
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        const ctx = createMockContext(
            {
                readyToRender: true,
                totalSize: 1000,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                props: {
                    data: [1],
                    maintainVisibleContentPosition: { data: false, size: true },
                },
                scroll: 200,
                scrollLength: 500,
                totalSize: 1000,
            },
        );

        try {
            setHeaderSize(ctx, 0);
            expect(requestAdjustSpy).not.toHaveBeenCalled();

            requestAdjustSpy.mockClear();
            setHeaderSize(ctx, 60);

            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 60);
        } finally {
            requestAdjustSpy.mockRestore();
            Platform.OS = prevPlatform;
        }
    });

    it("compensates the first measured web MVCP header size when replacing an estimate", () => {
        const prevPlatform = Platform.OS;
        Platform.OS = "web";
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        const ctx = createMockContext(
            {
                headerSize: 40,
                readyToRender: true,
                totalSize: 1000,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                props: {
                    data: [1],
                    maintainVisibleContentPosition: { data: false, size: true },
                },
                scroll: 200,
                scrollLength: 500,
                totalSize: 1000,
            },
        );

        try {
            setHeaderSize(ctx, 60);

            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 20);
        } finally {
            requestAdjustSpy.mockRestore();
            Platform.OS = prevPlatform;
        }
    });

    for (const platformOS of ["web", "ios", "android"] as const) {
        it(`does not compensate MVCP header changes on ${platformOS} while the header is visible`, () => {
            const prevPlatform = Platform.OS;
            Platform.OS = platformOS;
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const ctx = createMockContext(
                {
                    headerSize: 60,
                    readyToRender: true,
                    totalSize: 1000,
                },
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    didMeasureHeader: true,
                    props: {
                        data: [1],
                        maintainVisibleContentPosition: { data: false, size: true },
                    },
                    scroll: 20,
                    scrollLength: 500,
                    totalSize: 1000,
                },
            );

            try {
                setHeaderSize(ctx, 120);

                expect(requestAdjustSpy).not.toHaveBeenCalled();
            } finally {
                requestAdjustSpy.mockRestore();
                Platform.OS = prevPlatform;
            }
        });
    }
});
