import { describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import type { ViewStyle } from "react-native";

import { createColumnWrapperStyle } from "../../src/utils/createColumnWrapperStyle";

describe("createColumnWrapperStyle", () => {
    describe("basic functionality", () => {
        it("should return undefined when no gap properties are present", () => {
            const style: ViewStyle = {
                backgroundColor: "red",
                padding: 10,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toBeUndefined();
            // Original style should be unchanged
            expect(style.backgroundColor).toBe("red");
            expect(style.padding).toBe(10);
        });

        it("should extract gap and remove it from contentContainerStyle", () => {
            const style: ViewStyle = {
                backgroundColor: "blue",
                gap: 15,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: undefined,
                gap: 15,
                rowGap: undefined,
            });
            expect(style.gap).toBeUndefined();
            expect(style.backgroundColor).toBe("blue"); // Other properties preserved
        });

        it("should extract columnGap and remove it from contentContainerStyle", () => {
            const style: ViewStyle = {
                columnGap: 20,
                margin: 5,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 20,
                gap: undefined,
                rowGap: undefined,
            });
            expect(style.columnGap).toBeUndefined();
            expect(style.margin).toBe(5);
        });

        it("should extract rowGap and remove it from contentContainerStyle", () => {
            const style: ViewStyle = {
                rowGap: 25,
                width: 100,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: undefined,
                gap: undefined,
                rowGap: 25,
            });
            expect(style.rowGap).toBeUndefined();
            expect(style.width).toBe(100);
        });

        it("should extract all gap properties together", () => {
            const style: ViewStyle = {
                columnGap: 15,
                gap: 10,
                padding: 5,
                rowGap: 20,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 15,
                gap: 10,
                rowGap: 20,
            });
            expect(style.gap).toBeUndefined();
            expect(style.columnGap).toBeUndefined();
            expect(style.rowGap).toBeUndefined();
            expect(style.padding).toBe(5); // Other properties preserved
        });
    });

    describe("edge cases and data types", () => {
        it("should handle zero values (falsy, returns undefined)", () => {
            const style: ViewStyle = {
                columnGap: 0,
                gap: 0,
                rowGap: 0,
            };

            const result = createColumnWrapperStyle(style);

            // Zero is falsy, so function returns undefined
            expect(result).toBeUndefined();
            // Style should be unchanged since condition failed
            expect(style.gap).toBe(0);
            expect(style.columnGap).toBe(0);
            expect(style.rowGap).toBe(0);
        });

        it("should handle negative values", () => {
            const style: ViewStyle = {
                columnGap: -10,
                gap: -5,
                rowGap: -15,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: -10,
                gap: -5,
                rowGap: -15,
            });
        });

        it("should handle floating point values", () => {
            const style: ViewStyle = {
                columnGap: 7.25,
                gap: 12.5,
                rowGap: 18.75,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 7.25,
                gap: 12.5,
                rowGap: 18.75,
            });
        });

        it("should handle very large values", () => {
            const style: ViewStyle = {
                columnGap: 999999,
                gap: Number.MAX_SAFE_INTEGER,
                rowGap: 1000000,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 999999,
                gap: Number.MAX_SAFE_INTEGER,
                rowGap: 1000000,
            });
        });

        it("should handle special numeric values", () => {
            const style: ViewStyle = {
                columnGap: Infinity,
                gap: NaN,
                rowGap: -Infinity,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: Infinity,
                gap: NaN,
                rowGap: -Infinity,
            });
        });

        it("should handle non-numeric values (type assertion)", () => {
            const style: ViewStyle = {
                columnGap: "auto" as any,
                gap: "10px" as any,
                rowGap: null as any,
            };

            const result = createColumnWrapperStyle(style);

            // Function uses type assertions, so these will be cast to numbers
            expect(result!).toEqual({
                columnGap: "auto",
                gap: "10px",
                rowGap: null,
            } as any);
        });
    });

    describe("partial gap properties", () => {
        it("should handle only gap property", () => {
            const style: ViewStyle = {
                backgroundColor: "green",
                gap: 12,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: undefined,
                gap: 12,
                rowGap: undefined,
            });
        });

        it("should handle only columnGap property", () => {
            const style: ViewStyle = {
                columnGap: 8,
                margin: 4,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 8,
                gap: undefined,
                rowGap: undefined,
            });
        });

        it("should handle only rowGap property", () => {
            const style: ViewStyle = {
                rowGap: 16,
                width: "100%",
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: undefined,
                gap: undefined,
                rowGap: 16,
            });
        });

        it("should handle gap and columnGap only", () => {
            const style: ViewStyle = {
                columnGap: 5,
                gap: 10,
                padding: 20,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 5,
                gap: 10,
                rowGap: undefined,
            });
        });

        it("should handle gap and rowGap only", () => {
            const style: ViewStyle = {
                gap: 14,
                margin: 3,
                rowGap: 7,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: undefined,
                gap: 14,
                rowGap: 7,
            });
        });

        it("should handle columnGap and rowGap only", () => {
            const style: ViewStyle = {
                columnGap: 18,
                flexDirection: "row",
                rowGap: 22,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 18,
                gap: undefined,
                rowGap: 22,
            });
        });
    });

    describe("style mutation behavior", () => {
        it("should mutate the original style object", () => {
            const style: ViewStyle = {
                backgroundColor: "yellow",
                columnGap: 10,
                gap: 15,
                padding: 5,
                rowGap: 20,
            };

            const originalStyle = { ...style }; // Keep a copy for comparison

            createColumnWrapperStyle(style);

            // Gap properties should be removed
            expect(style.gap).toBeUndefined();
            expect(style.columnGap).toBeUndefined();
            expect(style.rowGap).toBeUndefined();

            // Other properties should remain
            expect(style.backgroundColor).toBe(originalStyle.backgroundColor!);
            expect(style.padding).toBe(originalStyle.padding!);
        });

        it("should not mutate style when no gap properties exist", () => {
            const style: ViewStyle = {
                backgroundColor: "purple",
                margin: 8,
                width: 200,
            };

            const originalStyle = { ...style };

            const result = createColumnWrapperStyle(style);

            expect(result).toBeUndefined();
            expect(style).toEqual(originalStyle); // Should be unchanged
        });

        it("should handle already undefined gap properties", () => {
            const style: ViewStyle = {
                columnGap: 12,
                gap: undefined,
                padding: 6,
                rowGap: undefined,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 12,
                gap: undefined,
                rowGap: undefined,
            });
            expect(style.columnGap).toBeUndefined();
        });
    });

    describe("complex style objects", () => {
        it("should handle style with many properties", () => {
            const style: ViewStyle = {
                alignItems: "stretch",
                backgroundColor: "red",
                borderColor: "blue",
                borderRadius: 5,
                borderWidth: 2,
                columnGap: 12,
                elevation: 4,
                flexDirection: "column",
                gap: 8,
                height: 200,
                justifyContent: "center",
                margin: 10,
                padding: 15,
                rowGap: 6,
                shadowColor: "black",
                shadowOffset: { height: 1, width: 1 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                width: "100%",
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 12,
                gap: 8,
                rowGap: 6,
            });

            // Gap properties should be removed
            expect(style.gap).toBeUndefined();
            expect(style.columnGap).toBeUndefined();
            expect(style.rowGap).toBeUndefined();

            // All other properties should remain
            expect(style.backgroundColor).toBe("red");
            expect(style.margin).toBe(10);
            expect(style.padding).toBe(15);
            expect(style.borderWidth).toBe(2);
            expect(style.flexDirection).toBe("column");
            // ... etc
        });

        it("should handle empty style object", () => {
            const style: ViewStyle = {};

            const result = createColumnWrapperStyle(style);

            expect(result).toBeUndefined();
            expect(style).toEqual({});
        });

        it("should handle style with nested objects", () => {
            const style: ViewStyle = {
                gap: 10,
                shadowOffset: { height: 3, width: 2 },
                transform: [{ translateX: 5 }, { scale: 1.2 }],
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: undefined,
                gap: 10,
                rowGap: undefined,
            });
            expect(style.gap).toBeUndefined();
            expect(style.transform).toEqual([{ translateX: 5 }, { scale: 1.2 }]);
            expect(style.shadowOffset).toEqual({ height: 3, width: 2 });
        });
    });

    describe("integration scenarios", () => {
        it("should work with typical FlatList column layout", () => {
            const style: ViewStyle = {
                backgroundColor: "#f5f5f5",
                columnGap: 8, // Horizontal space between columns
                gap: 12, // Space between items
                paddingHorizontal: 16,
                paddingVertical: 8,
                rowGap: 16, // Vertical space between rows
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 8,
                gap: 12,
                rowGap: 16,
            });

            // Style should still have layout properties but no gap properties
            expect(style.paddingHorizontal).toBe(16);
            expect(style.paddingVertical).toBe(8);
            expect(style.backgroundColor).toBe("#f5f5f5");
            expect(style.gap).toBeUndefined();
            expect(style.columnGap).toBeUndefined();
            expect(style.rowGap).toBeUndefined();
        });

        it("should work with grid-like layouts", () => {
            const style: ViewStyle = {
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 20,
                justifyContent: "space-between",
                padding: 10,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: undefined,
                gap: 20,
                rowGap: undefined,
            });

            expect(style.flexDirection).toBe("row");
            expect(style.flexWrap).toBe("wrap");
            expect(style.justifyContent).toBe("space-between");
            expect(style.gap).toBeUndefined();
        });

        it("should handle responsive design patterns", () => {
            const style: ViewStyle = {
                columnGap: 16,
                marginHorizontal: "auto",
                maxWidth: 600,
                padding: 20,
                rowGap: 24,
                width: "100%",
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 16,
                gap: undefined,
                rowGap: 24,
            });

            expect(style.width).toBe("100%");
            expect(style.maxWidth).toBe(600);
            expect(style.marginHorizontal).toBe("auto");
            expect(style.padding).toBe(20);
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid successive calls efficiently", () => {
            const start = performance.now();

            for (let i = 0; i < 1000; i++) {
                const style: ViewStyle = {
                    columnGap: (i + 5) % 15,
                    gap: i % 20,
                    padding: i % 10,
                    rowGap: (i + 10) % 25,
                };

                createColumnWrapperStyle(style);
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(50); // Should be fast
        });

        it("should not create unnecessary objects when no gaps exist", () => {
            const style: ViewStyle = {
                backgroundColor: "red",
                margin: 5,
                padding: 10,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toBeUndefined(); // No object created
        });

        it("should handle large style objects efficiently", () => {
            // Create a style with many properties
            const style: ViewStyle = {};
            for (let i = 0; i < 100; i++) {
                (style as any)[`property${i}`] = `value${i}`;
            }
            style.gap = 15;

            const start = performance.now();
            const result = createColumnWrapperStyle(style);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(5);
            expect(result?.gap).toBe(15);
            expect(style.gap).toBeUndefined();
        });
    });

    describe("type safety and edge cases", () => {
        it("should handle style with undefined properties", () => {
            const style: ViewStyle = {
                backgroundColor: undefined,
                columnGap: undefined,
                gap: 10,
                rowGap: 15,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: undefined,
                gap: 10,
                rowGap: 15,
            });
        });

        it("should handle style with mixed defined/undefined gap properties", () => {
            const style: ViewStyle = {
                columnGap: 8,
                gap: undefined,
                rowGap: undefined,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                columnGap: 8,
                gap: undefined,
                rowGap: undefined,
            });
        });

        it("should handle readonly style properties", () => {
            const style: ViewStyle = Object.freeze({
                backgroundColor: "blue",
                gap: 12,
            });

            // Function will try to mutate frozen object
            expect(() => {
                createColumnWrapperStyle(style);
            }).toThrow(); // Should throw in strict mode when trying to mutate frozen object
        });
    });
});
