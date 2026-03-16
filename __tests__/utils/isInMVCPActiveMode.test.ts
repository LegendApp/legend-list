import { describe, expect, it } from "bun:test";
import "../setup";

import { isInMVCPActiveMode as isInMVCPActiveModeWeb } from "../../src/utils/isInMVCPActiveMode";
import { isInMVCPActiveMode as isInMVCPActiveModeNative } from "../../src/utils/isInMVCPActiveMode.native";
import { createMockContext } from "../__mocks__/createMockContext";

describe("isInMVCPActiveMode", () => {
    it("treats a pending prepend transaction as active on native and web", () => {
        const ctx = createMockContext({}, {});
        ctx.state.pendingPrependTransaction = {
            insertedKeys: new Set(["new-1", "new-2"]),
            remainingKeys: new Set(["new-1"]),
        };

        expect(isInMVCPActiveModeNative(ctx.state)).toBe(true);
        expect(isInMVCPActiveModeWeb(ctx.state)).toBe(true);
    });
});
