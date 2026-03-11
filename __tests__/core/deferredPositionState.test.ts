import { describe, expect, it } from "bun:test";

import { resetDeferredPositionState } from "../../src/core/deferredPositionState";
import { createMockState } from "../__mocks__/createMockState";

describe("deferredPositionState", () => {
    it("resets deferred position state back to its idle values", () => {
        const state = createMockState({
            deferredPositionDelta: 120,
            pendingDeferredSizeShift: 40,
            pendingDeferredSizeShiftMinIndex: 3,
        });

        resetDeferredPositionState(state);

        expect(state.deferredPositionDelta).toBe(0);
        expect(state.pendingDeferredSizeShift).toBe(0);
        expect(state.pendingDeferredSizeShiftMinIndex).toBe(Infinity);
    });
});
