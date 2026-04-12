import { describe, expect, it } from "bun:test";
import "../setup";

import { refreshMountedContainerData } from "../../src/core/refreshMountedContainerData";
import { set$ } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("refreshMountedContainerData", () => {
    it("updates mounted container data for same-key item replacements", () => {
        const previousData = [{ id: "item-1", value: "A" }];
        const nextData = [{ id: "item-1", value: "B" }];
        const ctx = createMockContext({}, {
            containerItemKeys: new Map([["item-1", 0]]),
            indexByKey: new Map([["item-1", 0]]),
            props: {
                data: nextData,
                keyExtractor: (item: { id: string }) => item.id,
            },
        });

        set$(ctx, "containerItemKey0", "item-1");
        set$(ctx, "containerItemData0", previousData[0]);

        refreshMountedContainerData(ctx);

        expect(ctx.values.get("containerItemData0")).toBe(nextData[0]);
    });

    it("respects itemsAreEqual when refreshing mounted container data", () => {
        const previousData = [{ id: "item-1", value: "A" }];
        const nextData = [{ id: "item-1", value: "B" }];
        const ctx = createMockContext({}, {
            containerItemKeys: new Map([["item-1", 0]]),
            indexByKey: new Map([["item-1", 0]]),
            props: {
                data: nextData,
                itemsAreEqual: () => true,
                keyExtractor: (item: { id: string }) => item.id,
            },
        });

        set$(ctx, "containerItemKey0", "item-1");
        set$(ctx, "containerItemData0", previousData[0]);

        refreshMountedContainerData(ctx);

        expect(ctx.values.get("containerItemData0")).toBe(previousData[0]);
    });
});
