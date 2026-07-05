import { describe, expect, it } from "bun:test";
import "../setup";

import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import type { CreateLayoutReaderHarness } from "../helpers/layoutReaderContract";
import { runLayoutReaderContract } from "../helpers/layoutReaderContract";

const createPrefixLayoutHarness: CreateLayoutReaderHarness = ({ estimatedItemSize = 100, sizes }) => {
    const store = new PrefixLayoutStore(sizes.length, estimatedItemSize);

    sizes.forEach((size, index) => {
        if (size !== undefined) {
            store.setMeasuredSize(index, `item-${index}`, size);
        }
    });

    return {
        reader: store,
        setMeasuredSize(index, size) {
            store.setMeasuredSize(index, `item-${index}`, size);
        },
        updateFrom() {},
    };
};

runLayoutReaderContract("PrefixLayoutStore", createPrefixLayoutHarness);

describe("PrefixLayoutStore", () => {
    it("uses aggregate estimates for initially unmeasured items", () => {
        const store = new PrefixLayoutStore(5, 80);

        expect(store.getOffset(0)).toBe(0);
        expect(store.getOffset(3)).toBe(240);
        expect(store.getSize(4)).toBe(80);
        expect(store.getTotalSize()).toBe(400);
    });

    it("updates the estimated size without rebasing measured rows", () => {
        const store = new PrefixLayoutStore(5, 100);

        store.setMeasuredSize(1, "item-1", 50);
        store.setMeasuredSize(3, "item-3", 150);
        store.flushEstimatedSize(80);

        expect(store.getOffset(0)).toBe(0);
        expect(store.getOffset(1)).toBe(80);
        expect(store.getOffset(2)).toBe(130);
        expect(store.getOffset(3)).toBe(210);
        expect(store.getOffset(4)).toBe(360);
        expect(store.getTotalSize()).toBe(440);
    });

    it("materializes only the requested range", () => {
        const store = new PrefixLayoutStore(5, 100);

        store.setMeasuredSize(1, "item-1", 50);
        store.setMeasuredSize(3, "item-3", 150);

        expect(store.materializeRange(1, 3)).toEqual([
            { end: 150, index: 1, offset: 100, size: 50 },
            { end: 250, index: 2, offset: 150, size: 100 },
            { end: 400, index: 3, offset: 250, size: 150 },
        ]);
    });

    it("preserves measured rows while resizing", () => {
        const store = new PrefixLayoutStore(3, 100);

        store.setMeasuredSize(0, "item-0", 50);
        store.setMeasuredSize(2, "item-2", 75);
        store.resize(5);

        expect(store.getSize(0)).toBe(50);
        expect(store.getSize(2)).toBe(75);
        expect(store.getSize(4)).toBe(100);
        expect(store.getTotalSize()).toBe(425);

        store.resize(2);
        expect(store.getSize(0)).toBe(50);
        expect(store.getSize(1)).toBe(100);
        expect(store.getTotalSize()).toBe(150);
    });

    it("throws for invalid sizes and indexes", () => {
        const store = new PrefixLayoutStore(1, 100);

        expect(() => new PrefixLayoutStore(-1, 100)).toThrow(RangeError);
        expect(() => new PrefixLayoutStore(1, Number.NaN)).toThrow(RangeError);
        expect(() => store.getOffset(1)).toThrow(RangeError);
        expect(() => store.setMeasuredSize(0, "item-0", -1)).toThrow(RangeError);
    });
});
