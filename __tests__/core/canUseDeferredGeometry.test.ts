import { canUseDeferredGeometry } from "@/core/canUseDeferredGeometry";
import { describe, expect, it } from "bun:test";
import { createMockState } from "../__mocks__/createMockState";

describe("canUseDeferredGeometry", () => {
    it("stays enabled while ignoreScrollFromMVCP is active", () => {
        const state = createMockState();
        state.didFinishInitialScroll = true;
        state.ignoreScrollFromMVCP = { lt: 20 };

        expect(canUseDeferredGeometry(state, 1)).toBe(true);
    });

    it("stays enabled while dataChangeNeedsScrollUpdate is active", () => {
        const state = createMockState();
        state.didFinishInitialScroll = true;
        state.dataChangeNeedsScrollUpdate = true;

        expect(canUseDeferredGeometry(state, 1)).toBe(true);
    });
});
