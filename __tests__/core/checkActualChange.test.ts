import { beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { checkActualChange } from "../../src/core/checkActualChange";
import type { InternalState } from "../../src/types";
import { createMockState } from "../__mocks__/createMockState";

describe("checkActualChange", () => {
    let state: InternalState;
    let previousData: Array<{ id: string; value: string }>;

    beforeEach(() => {
        previousData = [
            { id: "item-1", value: "A" },
            { id: "item-2", value: "B" },
        ];

        state = createMockState({
            idCache: ["item-1", "item-2"],
            props: {
                data: previousData,
                keyExtractor: (item: { id: string }) => item.id,
            },
        });
    });

    it("returns true when previousData is undefined", () => {
        const didChange = checkActualChange(state, previousData, undefined);

        expect(didChange).toBe(true);
    });

    it("returns true when data lengths differ", () => {
        const newData = [...previousData, { id: "item-3", value: "C" }];

        const didChange = checkActualChange(state, newData, previousData);

        expect(didChange).toBe(true);
    });

    it("returns true when an item reference changes", () => {
        const newData = [previousData[0], { id: "item-2", value: "changed" }];

        const didChange = checkActualChange(state, newData, previousData);

        expect(didChange).toBe(true);
    });

    it("returns true when item keys differ despite equal references", () => {
        state.idCache[1] = "renamed-item";

        const didChange = checkActualChange(state, previousData, previousData);

        expect(didChange).toBe(true);
    });

    it("returns false when data and keys match the previous render", () => {
        const didChange = checkActualChange(state, previousData, previousData);

        expect(didChange).toBe(false);
    });
});
