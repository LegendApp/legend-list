import { describe, expect, it } from "bun:test";

import { canUseDeferredGeometry } from "@/core/canUseDeferredGeometry";
import { createMockState } from "../__mocks__/createMockState";

describe("canUseDeferredGeometry", () => {
    it("stays enabled while ignoreScrollFromMVCP is active", () => {
        const state = createMockState();
        state.didFinishInitialScroll = true;
        state.ignoreScrollFromMVCP = { lt: 20 };

        expect(canUseDeferredGeometry(state, 1)).toBe(true);
    });
});
