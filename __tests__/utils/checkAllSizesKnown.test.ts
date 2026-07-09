import { describe, expect, it } from "bun:test";
import "../setup";

import { checkAllSizesKnown } from "../../src/utils/checkAllSizesKnown";
import { createMockState } from "../__mocks__/createMockState";

describe("checkAllSizesKnown", () => {
    it("returns false for invalid ranges", () => {
        const state = createMockState();

        expect(checkAllSizesKnown(state, null, 5)).toBe(false);
        expect(checkAllSizesKnown(state, 3, undefined)).toBe(false);
        expect(checkAllSizesKnown(state, -1, 5)).toBe(false);
        expect(checkAllSizesKnown(state, 3, -1)).toBe(false);
        expect(checkAllSizesKnown(state, 5, 3)).toBe(false);
    });

    it("returns false when no mounted indices are in range", () => {
        const state = createMockState({
            containerItemKeys: new Map([["item-1", 0]]),
            indexByKey: new Map([["item-1", 1]]),
            sizesKnown: new Map([["item-1", 100]]),
        });

        expect(checkAllSizesKnown(state, 3, 5)).toBe(false);
    });

    it("ignores mounted items outside the range", () => {
        const data = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` }));
        const state = createMockState({
            containerItemKeys: new Map([
                ["item-1", 0],
                ["item-4", 1],
                ["item-6", 2],
            ]),
            indexByKey: new Map([
                ["item-1", 1],
                ["item-4", 4],
                ["item-6", 6],
            ]),
            props: {
                data,
                keyExtractor: (item: { id: string }) => item.id,
            },
            sizesKnown: new Map([["item-4", 100]]),
        });

        expect(checkAllSizesKnown(state, 3, 5)).toBe(true);
    });

    it("returns false when any mounted index in range is unmeasured", () => {
        const data = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` }));
        const state = createMockState({
            containerItemKeys: new Map([
                ["item-3", 0],
                ["item-4", 1],
            ]),
            indexByKey: new Map([
                ["item-3", 3],
                ["item-4", 4],
            ]),
            props: {
                data,
                keyExtractor: (item: { id: string }) => item.id,
            },
            sizesKnown: new Map([["item-3", 100]]),
        });

        expect(checkAllSizesKnown(state, 3, 4)).toBe(false);
    });

    it("returns true when all mounted indices in range have measured sizes", () => {
        const data = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` }));
        const state = createMockState({
            containerItemKeys: new Map([
                ["item-3", 0],
                ["item-4", 1],
            ]),
            indexByKey: new Map([
                ["item-3", 3],
                ["item-4", 4],
            ]),
            props: {
                data,
                keyExtractor: (item: { id: string }) => item.id,
            },
            sizesKnown: new Map([
                ["item-3", 100],
                ["item-4", 100],
            ]),
        });

        expect(checkAllSizesKnown(state, 3, 4)).toBe(true);
    });
});
