import { describe, expect, it } from "bun:test";
import "../setup";

import { updateAveragesOnDataChange } from "@/utils/updateAveragesOnDataChange";
import { createMockState } from "../__mocks__/createMockState";

describe("updateAveragesOnDataChange", () => {
    it("clears cached averages when item equality is unavailable", () => {
        const state = createMockState({
            averageSizes: {
                "": { avg: 24, num: 2 },
                image: { avg: 80, num: 1 },
            },
        });

        updateAveragesOnDataChange(state, [{ id: "a" }], [{ id: "a" }]);

        expect(state.averageSizes).toEqual({});
    });

    it("preserves only equal measured items and rebuilds averages by item type", () => {
        const oldData = [
            { id: "a", revision: 1, type: "text" },
            { id: "b", revision: 1, type: "text" },
            { id: "c", revision: 1, type: "image" },
        ];
        const newData = [
            { id: "b", revision: 1, type: "text" },
            { id: "c", revision: 2, type: "image" },
            { id: "a", revision: 1, type: "text" },
            { id: "d", revision: 1, type: "image" },
        ];
        const state = createMockState({
            averageSizes: {
                stale: { avg: 999, num: 1 },
            },
            indexByKey: new Map([
                ["a", 0],
                ["b", 1],
                ["c", 2],
            ]),
            props: {
                getItemType: (item: (typeof newData)[number]) => item.type,
                itemsAreEqual: (oldItem: (typeof oldData)[number], newItem: (typeof newData)[number]) =>
                    oldItem.revision === newItem.revision,
                keyExtractor: (item: (typeof newData)[number]) => item.id,
            },
            sizesKnown: new Map([
                ["a", 20],
                ["b", 40],
                ["c", 60],
            ]),
        });

        updateAveragesOnDataChange(state, oldData, newData);

        expect(state.averageSizes).toEqual({
            text: { avg: 30, num: 2 },
        });
    });

    it("stores preserved averages under the default type key when no item type getter is provided", () => {
        const oldData = [
            { id: "a", revision: 1 },
            { id: "b", revision: 1 },
        ];
        const newData = [
            { id: "b", revision: 1 },
            { id: "a", revision: 1 },
        ];
        const state = createMockState({
            indexByKey: new Map([
                ["a", 0],
                ["b", 1],
            ]),
            props: {
                itemsAreEqual: (oldItem: (typeof oldData)[number], newItem: (typeof newData)[number]) =>
                    oldItem.revision === newItem.revision,
                keyExtractor: (item: (typeof newData)[number]) => item.id,
            },
            sizesKnown: new Map([
                ["a", 10],
                ["b", 30],
            ]),
        });

        updateAveragesOnDataChange(state, oldData, newData);

        expect(state.averageSizes).toEqual({
            "": { avg: 20, num: 2 },
        });
    });

    it("ignores stale indices and items without measured sizes when rebuilding averages", () => {
        const oldData = [
            { id: "a", revision: 1 },
            { id: "b", revision: 1 },
        ];
        const newData = [
            { id: "a", revision: 1 },
            { id: "ghost", revision: 1 },
        ];
        const state = createMockState({
            averageSizes: {
                stale: { avg: 50, num: 1 },
            },
            indexByKey: new Map([
                ["a", 0],
                ["ghost", 5],
            ]),
            props: {
                itemsAreEqual: (oldItem: (typeof oldData)[number], newItem: (typeof newData)[number]) =>
                    oldItem.revision === newItem.revision,
                keyExtractor: (item: (typeof newData)[number]) => item.id,
            },
            sizesKnown: new Map(),
        });

        updateAveragesOnDataChange(state, oldData, newData);

        expect(state.averageSizes).toEqual({});
    });
});
