import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import "../setup";

import { doScrollTo } from "@/core/doScrollTo.native";
import { Platform } from "@/platform/Platform";
import { createMockContext } from "../__mocks__/createMockContext";

describe("doScrollTo (native)", () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        Platform.OS = originalPlatform;
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    it("uses the Android RTL default before the native horizontal mode is detected", () => {
        Platform.OS = "android";
        const scrollTo = mock();
        const ctx = createMockContext(
            {
                totalSize: 1000,
            },
            {
                props: {
                    data: [],
                    horizontal: true,
                    rtl: true,
                },
                refScroller: {
                    current: {
                        scrollTo,
                    },
                } as any,
                scrollLength: 300,
            },
        );

        doScrollTo(ctx, { animated: true, horizontal: true, offset: 100 });

        expect(scrollTo).toHaveBeenCalledWith({ animated: true, x: 600, y: 0 });
        expect(ctx.state.horizontalRTLScrollType).toBeUndefined();
    });

    it("uses the iOS RTL default before the native horizontal mode is detected", () => {
        Platform.OS = "ios";
        const scrollTo = mock();
        const ctx = createMockContext(
            {
                totalSize: 1000,
            },
            {
                props: {
                    data: [],
                    horizontal: true,
                    rtl: true,
                },
                refScroller: {
                    current: {
                        scrollTo,
                    },
                } as any,
                scrollLength: 300,
            },
        );

        doScrollTo(ctx, { animated: true, horizontal: true, offset: 100 });

        expect(scrollTo).toHaveBeenCalledWith({ animated: true, x: 600, y: 0 });
        expect(ctx.state.horizontalRTLScrollType).toBeUndefined();
    });
});
