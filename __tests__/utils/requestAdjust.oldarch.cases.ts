import { describe, expect, it, mock } from "bun:test";
import "../setup";

import { registerBaseModuleMocks } from "../setup";

mock.restore();
registerBaseModuleMocks();

const doScrollTo = mock();

mock.module("@/constants-platform", () => ({
    IsNewArchitecture: false,
}));
mock.module("@/core/doScrollTo", () => ({
    doScrollTo,
}));

const { Platform } = await import("../../src/platform/Platform");
const { requestAdjust } = await import("../../src/utils/requestAdjust?request-adjust-old-architecture");
const { createMockContext } = await import("../__mocks__/createMockContext");

describe("requestAdjust old-architecture cases", () => {
    it("keeps the Android data-change workaround and its extended guard timeout", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            { readyToRender: true },
            {
                props: { horizontal: false },
                scroll: 100,
                scrollAdjustHandler: {
                    getAdjust: () => 0,
                    requestAdjust: mock(),
                } as any,
            },
        );
        const originalSetTimeout = globalThis.setTimeout;
        let scheduledDelay: number | undefined;
        globalThis.setTimeout = ((_callback: () => void, delay: number) => {
            scheduledDelay = delay;
            return 1;
        }) as any;

        try {
            requestAdjust(ctx, 150, "data");
        } finally {
            globalThis.setTimeout = originalSetTimeout;
        }

        expect(doScrollTo).toHaveBeenCalledWith(ctx, { horizontal: false, offset: 250 });
        expect(ctx.state.ignoreScrollFromMVCP).toEqual({ lt: 175 });
        expect(scheduledDelay).toBe(250);
    });
});
