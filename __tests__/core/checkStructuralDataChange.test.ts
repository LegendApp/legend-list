import { beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { checkStructuralDataChange } from "../../src/core/checkStructuralDataChange";
import type { InternalState } from "../../src/types.internal";
import { createMockState } from "../__mocks__/createMockState";

describe("checkStructuralDataChange", () => {
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
        const didChange = checkStructuralDataChange(state, previousData, undefined);

        expect(didChange).toBe(true);
    });

    it("returns true when data lengths differ", () => {
        const newData = [...previousData, { id: "item-3", value: "C" }];

        const didChange = checkStructuralDataChange(state, newData, previousData);

        expect(didChange).toBe(true);
    });

    it("returns true when an item reference changes and itemsAreEqual is not provided", () => {
        const newData = [previousData[0], { id: "item-2", value: "changed" }];

        const didChange = checkStructuralDataChange(state, newData, previousData);

        expect(didChange).toBe(true);
    });

    it("returns false when an item reference changes, the key matches, and itemsAreEqual returns true", () => {
        state.props.itemsAreEqual = (previous, next) => previous.id === next.id;

        const newData = [previousData[0], { id: "item-2", value: "changed" }];

        const didChange = checkStructuralDataChange(state, newData, previousData);

        expect(didChange).toBe(false);
    });

    it("returns true when item keys differ for a changed item", () => {
        const newData = [previousData[0], { id: "renamed-item", value: "B" }];

        const didChange = checkStructuralDataChange(state, newData, previousData);

        expect(didChange).toBe(true);
    });

    it("returns true when keyed items reorder without a length change", () => {
        const newData = [previousData[1], previousData[0]];

        const didChange = checkStructuralDataChange(state, newData, previousData);

        expect(didChange).toBe(true);
    });

    it("returns false when data and keys match the previous render", () => {
        const didChange = checkStructuralDataChange(state, previousData, previousData);

        expect(didChange).toBe(false);
    });

    it("returns false for copied arrays with the same item references when keyExtractor is omitted", () => {
        state.props.keyExtractor = undefined;

        const didChange = checkStructuralDataChange(state, [...previousData], previousData);

        expect(didChange).toBe(false);
    });

    it("returns true when an item reference changes without a keyExtractor", () => {
        state.props.keyExtractor = undefined;

        const newData = [previousData[0], { id: "item-2", value: "changed" }];

        const didChange = checkStructuralDataChange(state, newData, previousData);

        expect(didChange).toBe(true);
    });
});
