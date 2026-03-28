import { describe, expect, it } from "bun:test";
import "../setup";

import { isInMVCPActiveMode as isInMVCPActiveModeWeb } from "../../src/utils/isInMVCPActiveMode";
import { isInMVCPActiveMode as isInMVCPActiveModeNative } from "../../src/utils/isInMVCPActiveMode.native";
import { createMockContext } from "../__mocks__/createMockContext";

describe("isInMVCPActiveMode", () => {
    it("treats mvcp-owned prepend transactions as active on native and web", () => {
        const ctx = createMockContext({}, {});
        ctx.state.pendingPrependTransaction = {
            anchorIndex: 2,
            anchorKey: "item_2",
            anchorPosition: 200,
            estimatedInsertedTotal: 100,
            insertedKeys: new Set(["new-1", "new-2"]),
            remainingKeys: new Set(["new-1"]),
        };

        expect(isInMVCPActiveModeNative(ctx.state)).toBe(true);
        expect(isInMVCPActiveModeWeb(ctx.state)).toBe(true);
    });

    it("does not treat deferred-owned prepend transactions as mvcp active", () => {
        const ctx = createMockContext({}, {});
        ctx.state.pendingPrependTransaction = {
            anchorIndex: 2,
            anchorKey: "item_2",
            anchorPosition: 200,
            estimatedInsertedTotal: 100,
            insertedKeys: new Set(["new-1", "new-2"]),
            remainingKeys: new Set(["new-1"]),
            usesDeferredGeometry: true,
        };

        expect(isInMVCPActiveModeNative(ctx.state)).toBe(false);
        expect(isInMVCPActiveModeWeb(ctx.state)).toBe(false);
    });
});
