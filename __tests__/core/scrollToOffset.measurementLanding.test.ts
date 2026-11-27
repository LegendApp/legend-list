import { afterEach, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as platformScroll from "@/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "@/core/doScrollTo.native";
import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { scrollTo } from "@/core/scrollTo";
import { Platform } from "@/platform/Platform";
import { requestAdjust } from "@/utils/requestAdjust";
import { createWebScrollHarness, type WebScrollHarness } from "../helpers/webScrollHarness";

const originalPlatform = Platform.OS;
let harness: WebScrollHarness | undefined;
afterEach(() => {
    harness?.ctx.state.scheduledWork.dispose();
    harness?.restore();
    harness = undefined;
    Platform.OS = originalPlatform;
});

for (const platform of ["ios", "android", "web"] as const) {
    for (const initial of [false, true]) {
        for (const offset of initial ? [0] : [0, 2119]) {
            it(`preserves the ${platform} absolute offset ${offset} during late measurements (initial: ${initial})`, () => {
                Platform.OS = platform;
                mock.module("@/platform/Platform", () => ({
                    Platform,
                    PlatformAdjustBreaksScroll: platform !== "ios",
                }));
                if (platform !== "web") spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
                const h = createWebScrollHarness();
                harness = h;
                h.state.scrollAdjustHandler = new ScrollAdjustHandler(h.ctx);
                h.ctx.values.set("readyToRender", true);
                h.state.didContainersLayout = true;
                h.state.didFinishInitialScroll = !initial;
                h.browser.moveTo(3000);
                if (initial) {
                    h.state.initialScroll = { contentOffset: offset, kind: "offset", previousDataLength: 100 };
                }
                scrollTo(h.ctx, { animated: true, forceScroll: true, isInitialScroll: initial, offset });
                // A previous selected slot shrinks while the absolute request is still moving.
                const beforeAdjust = h.state.scrollAdjustHandler.getAdjust();
                requestAdjust(h.ctx, -16, "item-size");
                expect(h.state.scrollAdjustHandler.getAdjust()).toBe(beforeAdjust);
                expect(h.state.scrollAdjustHandler.getUnsupersededPendingAdjust()).toBe(0);
                h.browser.runToEnd();
                h.clock.advance(2000);
                expect(h.browser.offset).toBe(offset);
                expect(h.state.scroll).toBe(offset);
            });
        }
    }
}
