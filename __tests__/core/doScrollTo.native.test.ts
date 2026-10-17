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

    it.each([false, true])("preserves released-drag ownership only for adjustment re-asserts (%s)", (isAdjustment) => {
        const ctx = createMockContext(
            {},
            {
                didDeferMaintainScrollAtEndForMomentum: true,
                momentumSuspendContentSize: 1000,
                refScroller: { current: { scrollTo: mock() } } as any,
                releasedFromUserDrag: true,
            },
        );
        ctx.state.scheduledWork.register("endFollowRearm", () => {});
        ctx.state.scheduledWork.register("userMomentumStallCheck", () => {});
        doScrollTo(ctx, { animated: true, isAdjustment, offset: 100 });
        expect(ctx.state.releasedFromUserDrag).toBe(isAdjustment);
        expect(ctx.state.didDeferMaintainScrollAtEndForMomentum).toBe(isAdjustment);
        expect(ctx.state.momentumSuspendContentSize).toBe(isAdjustment ? 1000 : undefined);
        expect(ctx.state.scheduledWork.has("endFollowRearm")).toBe(isAdjustment);
        expect(ctx.state.scheduledWork.has("userMomentumStallCheck")).toBe(isAdjustment);
        ctx.state.scheduledWork.dispose();
    });

    for (const platform of ["ios", "android"] as const) {
        it(`finishes an animated ${platform} request that is already at its target`, () => {
            Platform.OS = platform;
            const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
            let pendingFrame: FrameRequestCallback | undefined;
            globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
                pendingFrame = callback;
                return 1;
            }) as typeof requestAnimationFrame;
            const resolveScroll = mock();
            const scrollTo = mock();
            const ctx = createMockContext(
                { totalSize: 1000 },
                {
                    hasScrolled: true,
                    pendingScrollResolve: resolveScroll,
                    refScroller: {
                        current: {
                            scrollTo,
                        },
                    } as any,
                    scroll: 100,
                    scrollingTo: {
                        animated: true,
                        offset: 100,
                        targetOffset: 100,
                    } as any,
                    scrollLength: 300,
                    scrollPending: 100,
                },
            );

            try {
                doScrollTo(ctx, { animated: true, horizontal: false, offset: 100 });
                pendingFrame?.(0);
            } finally {
                globalThis.requestAnimationFrame = originalRequestAnimationFrame;
            }

            expect(scrollTo).toHaveBeenCalledWith({ animated: true, x: 0, y: 100 });
            expect(resolveScroll).toHaveBeenCalledTimes(1);
            expect(ctx.state.pendingScrollResolve).toBeUndefined();
            expect(ctx.state.scrollingTo).toBeUndefined();
        });
    }
});
