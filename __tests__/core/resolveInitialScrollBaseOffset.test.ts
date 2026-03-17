import { resolveInitialScrollBaseOffset } from "@/core/resolveInitialScrollBaseOffset";
import { describe, expect, it } from "bun:test";

describe("resolveInitialScrollBaseOffset", () => {
    it("keeps the raw offset for non-initial scrolls", () => {
        expect(
            resolveInitialScrollBaseOffset(
                {
                    queuedInitialLayout: true,
                    scroll: -81.5,
                    scrollingTo: {
                        isInitialScroll: false,
                        viewPosition: 1,
                    } as any,
                },
                39576.75,
                1,
            ),
        ).toBe(39576.75);
    });

    it("keeps the raw offset for non-end-aligned initial scrolls", () => {
        expect(
            resolveInitialScrollBaseOffset(
                {
                    queuedInitialLayout: true,
                    scroll: -81.5,
                    scrollingTo: {
                        isInitialScroll: true,
                        viewPosition: 0,
                    } as any,
                },
                39576.75,
                0,
            ),
        ).toBe(39576.75);
    });

    it("compensates the negative scroll rebase for end-aligned initial scrolls during queued layout", () => {
        expect(
            resolveInitialScrollBaseOffset(
                {
                    queuedInitialLayout: true,
                    scroll: -81.5,
                    scrollingTo: {
                        isInitialScroll: true,
                        viewPosition: 1,
                    } as any,
                },
                39576.75,
                1,
            ),
        ).toBe(39658.25);
    });
});
