import { afterEach, expect, it, spyOn } from "bun:test";
import { getLayoutValue, rebuildTestLayout } from "../helpers/layoutStore";
import "../setup";

import * as platformScroll from "@/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "@/core/doScrollTo.native";
import { getCurrentTargetOffset } from "@/core/getCurrentTargetOffset";
import { updateOneItemSize } from "@/core/updateItemSizes";
import { Platform } from "@/platform/Platform";
import { createWebScrollHarness, type WebScrollHarness } from "../helpers/webScrollHarness";

const originalPlatform = Platform.OS;
let harness: WebScrollHarness | undefined;
afterEach(() => {
    harness?.ctx.state.scheduledWork.dispose();
    harness?.restore();
    harness = undefined;
    Platform.OS = originalPlatform;
});

// A horizontal 402pt gallery centers a 40pt slot, then the previous selection
// shrinks from 56pt while the new selection grows to 56pt during the request.
for (const platform of ["ios", "android", "web"] as const) {
    for (const animated of [false, true]) {
        for (const prefixKnown of [false, true]) {
            for (const order of [
                "prefix-measurement",
                "previous-only",
                "selected-only",
                "previous-first",
                "selected-first",
            ] as const) {
                it(`lands a centered measured target on ${platform} (animated: ${animated}, prefix known: ${prefixKnown}, ${order})`, async () => {
                    Platform.OS = platform;
                    if (platform !== "web") spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
                    const h = createWebScrollHarness({
                        horizontal: true,
                        itemCount: prefixKnown ? 108 : 216,
                        itemSize: 40,
                        scrollLength: 402,
                    });
                    harness = h;
                    const now = spyOn(Date, "now").mockImplementation(() => h.clock.now);
                    try {
                        const index = prefixKnown ? 57 : 165;
                        h.state.props.stylePaddingLeft = 16;
                        h.state.didContainersLayout = true;
                        h.state.didFinishInitialScroll = true;
                        h.state.props.estimatedItemSize = 40;
                        h.state.sizesKnown.set(`item_${index - 1}`, 56);
                        h.state.sizes.set(`item_${index - 1}`, 56);
                        if (!prefixKnown) {
                            for (let i = 0; i < index; i++) h.state.sizesKnown.delete(`item_${i}`);
                        }
                        rebuildTestLayout(h.ctx);
                        const consumedPrefix = getLayoutValue(h.state, "positions", 10);
                        void h.ref.scrollToIndex({ animated, index, viewOffset: 0, viewPosition: 0.5 });
                        const target = h.state.scrollingTo!;
                        const changes =
                            order === "prefix-measurement"
                                ? [[index - 10, 56]]
                                : order === "previous-only"
                                  ? [[index - 1, 40]]
                                  : order === "selected-only"
                                    ? [[index, 56]]
                                    : order === "previous-first"
                                      ? [
                                            [index - 1, 40],
                                            [index, 56],
                                        ]
                                      : [
                                            [index, 56],
                                            [index - 1, 40],
                                        ];
                        for (const [changedIndex, size] of changes) {
                            updateOneItemSize(h.ctx, `item_${changedIndex}`, { height: 40, width: size! });
                            rebuildTestLayout(h.ctx);
                        }
                        const finalSize = order === "previous-only" || order === "prefix-measurement" ? 40 : 56;
                        const expected = getLayoutValue(h.state, "positions", index)! + 16 - (402 - finalSize) / 2;
                        expect(getLayoutValue(h.state, "positions", 10)).toBe(consumedPrefix);
                        h.browser.runToEnd();
                        h.clock.advance(2000);
                        h.browser.runToEnd();
                        h.clock.advance(1000);
                        expect(h.browser.offset).toBeCloseTo(expected, 5);
                        expect(getCurrentTargetOffset(h.ctx, target)).toBeCloseTo(expected, 5);
                        expect(h.state.scrollingTo).toBeUndefined();
                    } finally {
                        now.mockRestore();
                    }
                });
            }
        }
    }
}

it.each(["ios", "android"] as const)(
    "keeps a moving %s index request owned while it passes the measured center",
    (platform) => {
        Platform.OS = platform;
        spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
        const h = createWebScrollHarness({ horizontal: true, itemCount: 108, itemSize: 40, scrollLength: 402 });
        harness = h;
        const now = spyOn(Date, "now").mockImplementation(() => h.clock.now);
        try {
            h.state.didContainersLayout = true;
            h.state.didFinishInitialScroll = true;
            h.state.sizesKnown.set("item_56", 56);
            h.state.sizes.set("item_56", 56);
            h.state.layoutStoreRuntime = undefined;
            rebuildTestLayout(h.ctx);
            h.browser.moveTo(1931);
            void h.ref.scrollToIndex({ animated: true, index: 57, viewPosition: 0.5 });
            const issued = h.browser.destination!;
            updateOneItemSize(h.ctx, "item_56", { height: 40, width: 40 });
            const expected = issued - 16;
            h.browser.step(expected - h.browser.offset);
            h.clock.tick();
            expect(h.browser.offset).toBe(expected);
            expect(h.state.scrollingTo).toBeDefined();
            h.browser.settle();
            h.clock.advance(1000);
            h.browser.runToEnd();
            h.clock.advance(1000);
            expect(h.browser.offset).toBe(expected);
            expect(h.state.scrollingTo).toBeUndefined();
        } finally {
            now.mockRestore();
        }
    },
);

// A vertical chat jumps to a row whose estimated prefix then measures taller, both before
// and after the target, while the request is in flight. The row must land at the viewport top.
for (const platform of ["ios", "android", "web"] as const) {
    for (const animated of [false, true]) {
        it(`lands a top-aligned chat index through late prefix growth on ${platform} (animated: ${animated})`, () => {
            Platform.OS = platform;
            if (platform !== "web") spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
            const h = createWebScrollHarness({ itemCount: 300, itemSize: 60, scrollLength: 700 });
            harness = h;
            const now = spyOn(Date, "now").mockImplementation(() => h.clock.now);
            try {
                const index = 200;
                h.state.didContainersLayout = true;
                h.state.didFinishInitialScroll = true;
                h.state.props.estimatedItemSize = 60;
                for (let i = 0; i < 300; i++) h.state.sizesKnown.delete(`item_${i}`);
                rebuildTestLayout(h.ctx);
                void h.ref.scrollToIndex({ animated, index, viewPosition: 0 });
                for (const changed of [index - 1, index - 6, index - 12, index + 1]) {
                    updateOneItemSize(h.ctx, `item_${changed}`, { height: 180, width: 400 });
                    rebuildTestLayout(h.ctx);
                }
                h.browser.runToEnd();
                h.clock.advance(2000);
                h.browser.runToEnd();
                h.clock.advance(1000);
                expect(h.browser.offset).toBeCloseTo(getLayoutValue(h.state, "positions", index)!, 5);
                expect(h.state.scrollingTo).toBeUndefined();
            } finally {
                now.mockRestore();
            }
        });
    }
}
