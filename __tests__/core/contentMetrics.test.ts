import { describe, expect, it, spyOn } from "bun:test";
import { clampScrollOffset } from "../../src/core/clampScrollOffset";
import { setContentInsetOverride, setFooterSize, setHeaderSize } from "../../src/core/updateContentMetrics";
import { updateContentMetricsState } from "../../src/core/updateContentMetricsState";
import { Platform } from "../../src/platform/Platform";
import { getContentSize } from "../../src/state/getContentSize";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateContentMetrics", () => {
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

    it("compensates web MVCP when a measured header changes above the viewport", () => {
        const prevPlatform = Platform.OS;
        Platform.OS = "web";
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
        } finally {
            requestAdjustSpy.mockRestore();
            Platform.OS = prevPlatform;
        }
    });

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

    it("does not compensate web MVCP header changes while the header is visible", () => {
        const prevPlatform = Platform.OS;
        Platform.OS = "web";
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
});
