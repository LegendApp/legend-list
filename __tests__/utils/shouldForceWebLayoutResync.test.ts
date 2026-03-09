import { shouldForceWebLayoutResync } from "@/utils/shouldForceWebLayoutResync";
import { describe, expect, it } from "bun:test";
import { createMockState } from "../__mocks__/createMockState";

describe("shouldForceWebLayoutResync", () => {
    it("returns true when mvcp is active and no scroll target is in flight", () => {
        const state = createMockState({
            dataChangeNeedsScrollUpdate: true,
            didFinishInitialScroll: true,
            initialScroll: undefined,
            scrollingTo: undefined,
        });

        expect(shouldForceWebLayoutResync(state)).toBe(true);
    });

    it("returns false while an imperative scroll target is active", () => {
        const state = createMockState({
            dataChangeNeedsScrollUpdate: true,
            didFinishInitialScroll: true,
            initialScroll: undefined,
            scrollingTo: {
                animated: true,
                index: 10,
                isInitialScroll: false,
                offset: 1000,
            },
        });

        expect(shouldForceWebLayoutResync(state)).toBe(false);
    });
});
