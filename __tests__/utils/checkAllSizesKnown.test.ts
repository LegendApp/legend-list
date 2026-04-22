import { describe, expect, it } from "bun:test";
import "../setup";

import {
    checkAllSizesKnown,
    getMountedBufferedIndices,
    getMountedNoBufferIndices,
} from "../../src/utils/checkAllSizesKnown";
import { createMockState } from "../__mocks__/createMockState";

describe("checkAllSizesKnown", () => {
    it("returns mounted buffered indices sorted by index", () => {
        const state = createMockState({
            containerItemKeys: new Map([
                ["item_7", 0],
                ["item_2", 1],
                ["item_5", 2],
                ["item_99", 3],
            ]),
            endBuffered: 7,
            indexByKey: new Map([
                ["item_2", 2],
                ["item_5", 5],
                ["item_7", 7],
                ["item_99", 99],
            ]),
            startBuffered: 2,
        });

        expect(getMountedBufferedIndices(state)).toEqual([2, 5, 7]);
    });

    it("ignores mounted items outside the buffered window", () => {
        const data = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` }));
        const state = createMockState({
            containerItemKeys: new Map([
                ["item_1", 0],
                ["item_4", 1],
                ["item_6", 2],
            ]),
            endBuffered: 5,
            indexByKey: new Map([
                ["item_1", 1],
                ["item_4", 4],
                ["item_6", 6],
            ]),
            props: {
                data,
            },
            startBuffered: 3,
        });

        expect(getMountedBufferedIndices(state)).toEqual([4]);
    });

    it("returns mounted no-buffer indices sorted by index", () => {
        const state = createMockState({
            containerItemKeys: new Map([
                ["item_1", 0],
                ["item_3", 1],
                ["item_6", 2],
            ]),
            endNoBuffer: 5,
            indexByKey: new Map([
                ["item_1", 1],
                ["item_3", 3],
                ["item_6", 6],
            ]),
            startNoBuffer: 1,
        });

        expect(getMountedNoBufferIndices(state)).toEqual([1, 3]);
    });

    it("returns false when no mounted buffered indices are present", () => {
        const state = createMockState({
            endBuffered: 5,
            startBuffered: 3,
        });

        expect(getMountedBufferedIndices(state)).toEqual([]);
        expect(checkAllSizesKnown(state)).toBe(false);
    });

    it("returns false when any mounted buffered index is still unmeasured", () => {
        const data = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` }));
        const state = createMockState({
            containerItemKeys: new Map([
                ["item-3", 0],
                ["item-4", 1],
            ]),
            endBuffered: 4,
            indexByKey: new Map([
                ["item-3", 3],
                ["item-4", 4],
            ]),
            props: {
                data,
                keyExtractor: (item: { id: string }) => item.id,
            },
            sizesKnown: new Map([["item-3", 100]]),
            startBuffered: 3,
        });

        expect(checkAllSizesKnown(state)).toBe(false);
    });

    it("returns true when all mounted buffered indices have measured sizes", () => {
        const data = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` }));
        const state = createMockState({
            containerItemKeys: new Map([
                ["item-3", 0],
                ["item-4", 1],
            ]),
            endBuffered: 4,
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
            startBuffered: 3,
        });

        expect(checkAllSizesKnown(state)).toBe(true);
    });

    it("accepts an explicit index list when callers already resolved the mounted window", () => {
        const data = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` }));
        const state = createMockState({
            props: {
                data,
                keyExtractor: (item: { id: string }) => item.id,
            },
            sizesKnown: new Map([
                ["item-1", 100],
                ["item-5", 100],
            ]),
        });

        expect(checkAllSizesKnown(state, [1, 5])).toBe(true);
        expect(checkAllSizesKnown(state, [1, 5, 6])).toBe(false);
    });
});
