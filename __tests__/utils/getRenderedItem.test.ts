import React from "react";

import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { getRenderedItem } from "../../src/utils/getRenderedItem";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

// Mock renderItem components for testing
const MockRenderItem = ({ item, index }: { item: any; index: number }) => {
    const label = item && typeof item === "object" && "name" in item ? (item as any).name : String(item);
    return React.createElement("div", { key: index }, `Item ${label} at ${index}`);
};

const ThrowingRenderItem = ({ item, index }: { item: any; index: number }) => {
    throw new Error("Render error");
};

describe("getRenderedItem", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        mockCtx = createMockContext({
            extraData: null,
        });

        mockState = createMockState({
            indexByKey: new Map([
                ["item_0", 0],
                ["item_1", 1],
                ["item_2", 2],
            ]),
            props: {
                data: [
                    { id: "item1", name: "First" },
                    { id: "item2", name: "Second" },
                    { id: "item3", name: "Third" },
                ],
                renderItem: MockRenderItem,
            },
        });
    });

    describe("basic functionality", () => {
        it("should return rendered item with correct structure", () => {
            const result = getRenderedItem(mockCtx, mockState, "item_1");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(1);
            expect(result!.item).toEqual({ id: "item2", name: "Second" });
            expect(result!.renderedItem).toBeDefined();
            expect(React.isValidElement(result!.renderedItem)).toBe(true);
        });

        it("should pass correct props to renderItem", () => {
            const result = getRenderedItem(mockCtx, mockState, "item_0");

            expect(result).not.toBeNull();
            // The renderedItem should be a React element created with the component
            expect(React.isValidElement(result!.renderedItem)).toBe(true);

            // We can check the element's props to verify correct data was passed
            const element = result!.renderedItem as React.ReactElement;
            // Our MockRenderItem renders children and React adds a key prop; props differ from LegendList's renderItem signature
            expect(element.props.children).toBe("Item First at 0");
        });

        it("should include extraData from context", () => {
            const extraData = { theme: "dark", version: "1.0" };
            mockCtx.values.set("extraData", extraData);

            const result = getRenderedItem(mockCtx, mockState, "item_1");

            expect(result).not.toBeNull();
            const element = result!.renderedItem as React.ReactElement;
            expect(element.props.children).toBe("Item Second at 1");
        });

        it("should handle different item types", () => {
            mockState.props.data = ["apple", "banana", "cherry"];
            mockState.indexByKey = new Map([
                ["fruit_0", 0],
                ["fruit_1", 1],
                ["fruit_2", 2],
            ]);

            const result = getRenderedItem(mockCtx, mockState, "fruit_1");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(1);
            expect(result!.item).toBe("banana");
        });
    });

    describe("edge cases", () => {
        it("should return null when state is null", () => {
            const result = getRenderedItem(mockCtx, null as any, "item_0");

            expect(result).toBeNull();
        });

        it("should return null when state is undefined", () => {
            const result = getRenderedItem(mockCtx, undefined as any, "item_0");

            expect(result).toBeNull();
        });

        it("should return null when key is not found in indexByKey", () => {
            const result = getRenderedItem(mockCtx, mockState, "non_existent_key");

            expect(result).toBeNull();
        });

        it("should return null when index is undefined in indexByKey", () => {
            mockState.indexByKey.set("undefined_index", undefined as any);

            const result = getRenderedItem(mockCtx, mockState, "undefined_index");

            expect(result).toBeNull();
        });

        it("should handle empty indexByKey map", () => {
            mockState.indexByKey = new Map();

            const result = getRenderedItem(mockCtx, mockState, "item_0");

            expect(result).toBeNull();
        });

        it("should handle null renderItem", () => {
            (mockState.props as any).renderItem = null;

            const result = getRenderedItem(mockCtx, mockState, "item_0");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(0);
            expect(result!.item).toEqual({ id: "item1", name: "First" });
            expect(result!.renderedItem).toBeNull();
        });

        it("should handle undefined renderItem", () => {
            mockState.props.renderItem = undefined;

            const result = getRenderedItem(mockCtx, mockState, "item_0");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(0);
            expect(result!.item).toEqual({ id: "item1", name: "First" });
            expect(result!.renderedItem).toBeNull();
        });

        it("should handle index out of bounds", () => {
            mockState.indexByKey.set("out_of_bounds", 10);

            const result = getRenderedItem(mockCtx, mockState, "out_of_bounds");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(10);
            expect(result!.item).toBeUndefined(); // data[10] doesn't exist
            expect(result!.renderedItem).toBeDefined(); // renderItem still gets called
        });

        it("should handle negative index", () => {
            mockState.indexByKey.set("negative", -1);

            const result = getRenderedItem(mockCtx, mockState, "negative");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(-1);
            expect(result!.item).toBeUndefined(); // data[-1] doesn't exist
        });
    });

    describe("renderItem behavior", () => {
        it("should handle renderItem throwing an error", () => {
            mockState.props.renderItem = ThrowingRenderItem;

            // Creating the element may throw if the function executes immediately; assert it throws
            expect(() => getRenderedItem(mockCtx, mockState, "item_0")).toThrow("Render error");
        });

        it("should handle renderItem returning null", () => {
            mockState.props.renderItem = () => null;

            const result = getRenderedItem(mockCtx, mockState, "item_0");

            expect(result).not.toBeNull();
            // renderItem returns null; getRenderedItem returns that value directly
            expect(result!.renderedItem).toBeNull();
        });

        it("should handle renderItem returning undefined", () => {
            mockState.props.renderItem = () => undefined;

            const result = getRenderedItem(mockCtx, mockState, "item_0");

            expect(result).not.toBeNull();
            // undefined is a valid return; pass through
            expect(result!.renderedItem).toBeUndefined();
        });

        it("should handle renderItem returning non-React element", () => {
            mockState.props.renderItem = () => "plain string";

            const result = getRenderedItem(mockCtx, mockState, "item_0");

            expect(result).not.toBeNull();
            // Non-React element returned; pass through
            expect(result!.renderedItem).toBe("plain string");
        });

        it("should handle complex renderItem with multiple props", () => {
            const ComplexRenderItem = ({ item, index, extraData }: any) =>
                React.createElement(
                    "div",
                    {
                        "data-id": item.id,
                        "data-index": index,
                        "data-theme": extraData?.theme,
                    },
                    item.name,
                );

            mockState.props.renderItem = ComplexRenderItem;
            mockCtx.values.set("extraData", { theme: "dark" });

            const result = getRenderedItem(mockCtx, mockState, "item_1");

            expect(result).not.toBeNull();
            expect(React.isValidElement(result!.renderedItem)).toBe(true);
        });
    });

    describe("context interaction", () => {
        it("should handle missing extraData in context", () => {
            mockCtx.values.delete("extraData");

            const result = getRenderedItem(mockCtx, mockState, "item_0");

            expect(result).not.toBeNull();
            const element = result!.renderedItem as React.ReactElement;
            expect(element.props.children).toBe("Item First at 0");
        });

        it("should handle corrupted context", () => {
            mockCtx.values = null as any;

            expect(() => {
                getRenderedItem(mockCtx, mockState, "item_0");
            }).not.toThrow(); // peek$ handles null values gracefully
        });

        it("should handle different extraData types", () => {
            const testCases = [null, undefined, "", 0, false, [], {}, { complex: { nested: "data" } }];

            testCases.forEach((extraData, idx) => {
                mockCtx.values.set("extraData", extraData);

                const result = getRenderedItem(mockCtx, mockState, "item_0");

                expect(result).not.toBeNull();
                const element = result!.renderedItem as React.ReactElement;
                expect(element.props.children).toBe("Item First at 0");
            });
        });
    });

    describe("data handling", () => {
        it("should handle empty data array", () => {
            mockState.props.data = [];
            mockState.indexByKey.set("empty", 0);

            const result = getRenderedItem(mockCtx, mockState, "empty");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(0);
            expect(result!.item).toBeUndefined();
        });

        it("should handle null data array", () => {
            mockState.props.data = null as any;

            // This will throw because data[index] tries to access null[index]
            expect(() => {
                getRenderedItem(mockCtx, mockState, "item_0");
            }).toThrow();
        });

        it("should handle different data types", () => {
            mockState.props.data = [null, undefined, "", 0, false, { complex: "object" }, [1, 2, 3]];

            mockState.indexByKey = new Map([
                ["null_item", 0],
                ["undefined_item", 1],
                ["empty_string", 2],
                ["zero", 3],
                ["false_item", 4],
                ["object", 5],
                ["array", 6],
            ]);

            const testKeys = ["null_item", "undefined_item", "empty_string", "zero", "false_item", "object", "array"];

            testKeys.forEach((key, idx) => {
                const result = getRenderedItem(mockCtx, mockState, key);

                expect(result).not.toBeNull();
                expect(result!.index).toBe(idx);
                expect(result!.item).toBe(mockState.props.data[idx]);
            });
        });

        it("should render items when data value is 0", () => {
            mockState.props.data = [0, 1];
            mockState.indexByKey = new Map([
                ["zero", 0],
                ["one", 1],
            ]);

            mockState.props.renderItem = ({ item }: any) => React.createElement("div", null, `Value: ${item}`);

            const result = getRenderedItem(mockCtx, mockState, "zero");

            expect(result).not.toBeNull();
            expect(result!.item).toBe(0);
            expect(result!.renderedItem).not.toBeNull();
            expect(React.isValidElement(result!.renderedItem)).toBe(true);
            expect((result!.renderedItem as React.ReactElement).props.children).toBe("Value: 0");
        });
    });

    describe("performance and stress testing", () => {
        it("should handle large datasets efficiently", () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: `item${i}`, name: `Item ${i}` }));
            mockState.props.data = largeData;

            // Create a large indexByKey map
            const largeIndexMap = new Map();
            for (let i = 0; i < 10000; i++) {
                largeIndexMap.set(`large_item_${i}`, i);
            }
            mockState.indexByKey = largeIndexMap;

            const start = Date.now();

            // Test multiple calls
            for (let i = 0; i < 100; i++) {
                const key = `large_item_${i * 100}`;
                const result = getRenderedItem(mockCtx, mockState, key);
                expect(result).not.toBeNull();
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100); // Should be very fast
        });

        it("should handle rapid consecutive calls", () => {
            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                const key = `item_${i % 3}`;
                getRenderedItem(mockCtx, mockState, key);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100); // Should be very fast
        });

        it("should maintain memory efficiency", () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Generate many rendered items
            for (let i = 0; i < 1000; i++) {
                getRenderedItem(mockCtx, mockState, `item_${i % 3}`);
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Should not have significant memory increase
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
        });
    });

    describe("error handling and recovery", () => {
        it("should handle corrupted indexByKey", () => {
            mockState.indexByKey = null as any;

            expect(() => {
                getRenderedItem(mockCtx, mockState, "item_0");
            }).toThrow();
        });

        it("should handle corrupted props", () => {
            mockState.props = null as any;

            expect(() => {
                getRenderedItem(mockCtx, mockState, "item_0");
            }).toThrow();
        });

        it("should handle string keys", () => {
            mockState.indexByKey.set("string_key", 1);

            const result = getRenderedItem(mockCtx, mockState, "string_key");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(1);
        });

        it("should handle numeric string keys", () => {
            mockState.indexByKey.set("123", 2);

            const result = getRenderedItem(mockCtx, mockState, "123");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(2);
        });

        it("should handle empty string key", () => {
            mockState.indexByKey.set("", 0);

            const result = getRenderedItem(mockCtx, mockState, "");

            expect(result).not.toBeNull();
            expect(result!.index).toBe(0);
        });

        it("should handle special character keys", () => {
            const specialKeys = ["@#$%", "key with spaces", "key\nwith\nnewlines", "🚀💫"];

            specialKeys.forEach((key, idx) => {
                mockState.indexByKey.set(key, idx);

                const result = getRenderedItem(mockCtx, mockState, key);

                expect(result).not.toBeNull();
                expect(result!.index).toBe(idx);
            });
        });
    });
});
