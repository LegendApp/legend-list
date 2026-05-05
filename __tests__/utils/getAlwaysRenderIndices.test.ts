import { describe, expect, it } from "bun:test";
import { getAlwaysRenderIndices } from "../../src/utils/getAlwaysRenderIndices";

const data = Array.from({ length: 5 }, (_, id) => ({ id: `item_${id}` }));
const keyExtractor = (item: { id: string }) => item.id;

describe("getAlwaysRenderIndices", () => {
    it("includes the anchored end space tail without explicit alwaysRender config", () => {
        expect(getAlwaysRenderIndices(undefined, data, keyExtractor, 3)).toEqual([3, 4]);
    });

    it("dedupes and sorts explicit alwaysRender indices with the anchored end space tail", () => {
        const alwaysRender = {
            bottom: 1,
            indices: [0, 3],
            keys: ["item_2"],
        };

        expect(getAlwaysRenderIndices(alwaysRender, data, keyExtractor, 3)).toEqual([0, 2, 3, 4]);
    });

    it("ignores out-of-range anchored end space indices", () => {
        expect(getAlwaysRenderIndices(undefined, data, keyExtractor, 99)).toEqual([]);
        expect(getAlwaysRenderIndices(undefined, data, keyExtractor, -1)).toEqual([]);
    });
});
