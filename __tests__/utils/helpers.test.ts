import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import {
    byIndex,
    comparatorDefault,
    extractPadding,
    isArray,
    isFunction,
    isNullOrUndefined,
    roundSize,
    warnDevOnce,
} from "../../src/utils/helpers";

describe("helpers", () => {
    describe("isFunction", () => {
        it("should return true for functions", () => {
            expect(isFunction(() => {})).toBe(true);
            expect(isFunction(() => {})).toBe(true);
            expect(isFunction(async () => {})).toBe(true);
            expect(isFunction(function* () {})).toBe(true);
            expect(isFunction(Math.max)).toBe(true);
            expect(isFunction(Array.from)).toBe(true);
        });

        it("should return false for non-functions", () => {
            expect(isFunction(null)).toBe(false);
            expect(isFunction(undefined)).toBe(false);
            expect(isFunction(42)).toBe(false);
            expect(isFunction("hello")).toBe(false);
            expect(isFunction([])).toBe(false);
            expect(isFunction({})).toBe(false);
            expect(isFunction(true)).toBe(false);
            expect(isFunction(Symbol())).toBe(false);
        });

        it("should handle edge cases", () => {
            expect(isFunction(NaN)).toBe(false);
            expect(isFunction(Infinity)).toBe(false);
            expect(isFunction(/regex/)).toBe(false);
            expect(isFunction(new Date())).toBe(false);
        });
    });

    describe("isArray", () => {
        it("should return true for arrays", () => {
            expect(isArray([])).toBe(true);
            expect(isArray([1, 2, 3])).toBe(true);
            expect(isArray(new Array(5))).toBe(true);
            expect(isArray(Array.from({ length: 3 }))).toBe(true);
        });

        it("should return false for non-arrays", () => {
            expect(isArray(null)).toBe(false);
            expect(isArray(undefined)).toBe(false);
            expect(isArray({})).toBe(false);
            expect(isArray("hello")).toBe(false);
            expect(isArray(42)).toBe(false);
            expect(isArray(true)).toBe(false);
            expect(isArray(() => {})).toBe(false);
        });

        it("should handle array-like objects", () => {
            expect(isArray({ 0: "a", 1: "b", 2: "c", length: 3 })).toBe(false);
            // Skip arguments test in Bun environment
            // expect(isArray(arguments)).toBe(false);
        });
    });

    describe("warnDevOnce", () => {
        let originalConsoleWarn: any;
        let originalDev: any;
        let consoleWarnSpy: any;

        beforeEach(() => {
            // Mock console.warn
            originalConsoleWarn = console.warn;
            consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});

            // Mock __DEV__ to be true
            originalDev = (globalThis as any).__DEV__;
            (globalThis as any).__DEV__ = true;
        });

        afterEach(() => {
            // Restore original functions
            if (originalConsoleWarn) {
                console.warn = originalConsoleWarn;
            }
            if (originalDev !== undefined) {
                (globalThis as any).__DEV__ = originalDev;
            }
        });

        it("should warn once for unique ids", () => {
            warnDevOnce("test-id", "Test warning message");

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith("[legend-list] Test warning message");
        });

        it("should not warn twice for same id", () => {
            warnDevOnce("duplicate-id", "First message");
            warnDevOnce("duplicate-id", "Second message");

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith("[legend-list] First message");
        });

        it("should warn for different ids", () => {
            warnDevOnce("id-1", "Message 1");
            warnDevOnce("id-2", "Message 2");

            expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
            expect(consoleWarnSpy).toHaveBeenNthCalledWith(1, "[legend-list] Message 1");
            expect(consoleWarnSpy).toHaveBeenNthCalledWith(2, "[legend-list] Message 2");
        });

        it("should not warn when __DEV__ is false", () => {
            (globalThis as any).__DEV__ = false;

            warnDevOnce("prod-id", "Production warning");

            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should handle empty strings", () => {
            warnDevOnce("", "Empty id warning");
            warnDevOnce("", "Another empty id warning");

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith("[legend-list] Empty id warning");
        });

        it("should handle special characters in messages", () => {
            warnDevOnce("special-chars", "Warning with 🚨 emoji and \n newline");

            expect(consoleWarnSpy).toHaveBeenCalledWith("[legend-list] Warning with 🚨 emoji and \n newline");
        });
    });

    describe("roundSize", () => {
        it("should round to nearest eighth pixel", () => {
            expect(roundSize(10.1)).toBe(10);
            expect(roundSize(10.125)).toBe(10.125); // Exactly 1/8
            expect(roundSize(10.2)).toBe(10.125);
            expect(roundSize(10.25)).toBe(10.25); // Exactly 2/8
            expect(roundSize(10.3)).toBe(10.25);
        });

        it("should handle zero and negative numbers", () => {
            expect(roundSize(0)).toBe(0);
            expect(roundSize(-5.3)).toBe(-5.375); // Rounds down for negatives
            expect(roundSize(-10.125)).toBe(-10.125);
        });

        it("should handle large numbers", () => {
            expect(roundSize(1000.1)).toBe(1000);
            expect(roundSize(1000.125)).toBe(1000.125);
            expect(roundSize(999999.9)).toBe(999999.875);
        });

        it("should handle floating point precision", () => {
            expect(roundSize(0.1 + 0.2)).toBe(0.25); // 0.1 + 0.2 = 0.30000000000000004
            expect(roundSize(10.125000000001)).toBe(10.125);
        });

        it("should handle edge cases", () => {
            expect(roundSize(NaN)).toBeNaN();
            expect(roundSize(Infinity)).toBe(Infinity);
            expect(roundSize(-Infinity)).toBe(-Infinity);
        });

        it("should prevent accumulating rounding errors", () => {
            // Simulate multiple operations that could accumulate errors
            let value = 0;
            for (let i = 0; i < 8; i++) {
                // Use 8 since it rounds to 1/8 pixels
                value += 0.125; // Use 1/8 since that's what the function rounds to
                value = roundSize(value);
            }

            // Should be exactly 1, not accumulating floating point errors
            expect(value).toBe(1);
        });
    });

    describe("isNullOrUndefined", () => {
        it("should return true for null and undefined", () => {
            expect(isNullOrUndefined(null)).toBe(true);
            expect(isNullOrUndefined(undefined)).toBe(true);
        });

        it("should return false for other falsy values", () => {
            expect(isNullOrUndefined(false)).toBe(false);
            expect(isNullOrUndefined(0)).toBe(false);
            expect(isNullOrUndefined("")).toBe(false);
            expect(isNullOrUndefined(NaN)).toBe(false);
        });

        it("should return false for truthy values", () => {
            expect(isNullOrUndefined(true)).toBe(false);
            expect(isNullOrUndefined(1)).toBe(false);
            expect(isNullOrUndefined("hello")).toBe(false);
            expect(isNullOrUndefined([])).toBe(false);
            expect(isNullOrUndefined({})).toBe(false);
            expect(isNullOrUndefined(() => {})).toBe(false);
        });
    });

    describe("comparatorDefault", () => {
        it("should return correct comparison for numbers", () => {
            expect(comparatorDefault(1, 2)).toBe(-1); // 1 - 2 = -1
            expect(comparatorDefault(2, 1)).toBe(1); // 2 - 1 = 1
            expect(comparatorDefault(5, 5)).toBe(0); // 5 - 5 = 0
        });

        it("should handle negative numbers", () => {
            expect(comparatorDefault(-1, -2)).toBe(1); // -1 - (-2) = 1
            expect(comparatorDefault(-2, -1)).toBe(-1); // -2 - (-1) = -1
            expect(comparatorDefault(-5, 0)).toBe(-5); // -5 - 0 = -5
        });

        it("should handle zero", () => {
            expect(comparatorDefault(0, 0)).toBe(0);
            expect(comparatorDefault(0, 5)).toBe(-5);
            expect(comparatorDefault(5, 0)).toBe(5);
        });

        it("should handle floating point numbers", () => {
            expect(comparatorDefault(1.5, 2.3)).toBeCloseTo(-0.8, 10);
            expect(comparatorDefault(3.14, 3.14)).toBe(0);
        });

        it("should handle large numbers", () => {
            expect(comparatorDefault(1000000, 999999)).toBe(1);
            expect(comparatorDefault(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(0);
        });

        it("should handle special numeric values", () => {
            expect(comparatorDefault(Infinity, 100)).toBe(Infinity);
            expect(comparatorDefault(100, Infinity)).toBe(-Infinity);
            expect(comparatorDefault(Infinity, Infinity)).toBeNaN(); // Infinity - Infinity = NaN
            expect(isNaN(comparatorDefault(NaN, 5))).toBe(true);
            expect(isNaN(comparatorDefault(5, NaN))).toBe(true);
        });

        it("should work with Array.sort", () => {
            const numbers = [3, 1, 4, 1, 5, 9, 2, 6];
            const sorted = numbers.sort(comparatorDefault);

            expect(sorted).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
        });
    });

    describe("byIndex", () => {
        it("should extract index property", () => {
            expect(byIndex({ index: 0 })).toBe(0);
            expect(byIndex({ index: 5 })).toBe(5);
            expect(byIndex({ index: -1 })).toBe(-1);
        });

        it("should handle objects with additional properties", () => {
            const obj = { data: { foo: "bar" }, index: 42, name: "test" };
            expect(byIndex(obj)).toBe(42);
        });

        it("should handle floating point indices", () => {
            expect(byIndex({ index: 3.14 })).toBe(3.14);
        });

        it("should work with Array.map", () => {
            const objects = [
                { index: 10, value: "a" },
                { index: 5, value: "b" },
                { index: 15, value: "c" },
            ];

            const indices = objects.map(byIndex);
            expect(indices).toEqual([10, 5, 15]);
        });

        it("should work for sorting by index", () => {
            const objects = [
                { index: 3, value: "c" },
                { index: 1, value: "a" },
                { index: 2, value: "b" },
            ];

            const sorted = objects.sort((a, b) => comparatorDefault(byIndex(a), byIndex(b)));
            expect(sorted.map(byIndex)).toEqual([1, 2, 3]);
        });
    });

    describe("extractPadding", () => {
        it("should extract padding from both styles", () => {
            const style = { paddingTop: 10 };
            const contentContainerStyle = { paddingTop: 5 };

            expect(extractPadding(style, contentContainerStyle, "Top")).toBe(15);
        });

        it("should handle missing padding properties", () => {
            const style = {};
            const contentContainerStyle = {};

            expect(extractPadding(style, contentContainerStyle, "Top")).toBe(0);
        });

        it("should use paddingVertical fallback", () => {
            const style = { paddingVertical: 8 };
            const contentContainerStyle = { paddingVertical: 4 };

            expect(extractPadding(style, contentContainerStyle, "Top")).toBe(12);
            expect(extractPadding(style, contentContainerStyle, "Bottom")).toBe(12);
        });

        it("should use padding fallback", () => {
            const style = { padding: 6 };
            const contentContainerStyle = { padding: 2 };

            expect(extractPadding(style, contentContainerStyle, "Top")).toBe(8);
            expect(extractPadding(style, contentContainerStyle, "Bottom")).toBe(8);
        });

        it("should prioritize specific over general padding", () => {
            const style = { padding: 5, paddingTop: 20, paddingVertical: 10 };
            const contentContainerStyle = { padding: 3, paddingTop: 15, paddingVertical: 8 };

            expect(extractPadding(style, contentContainerStyle, "Top")).toBe(35); // 20 + 15
        });

        it("should mix different padding types", () => {
            const style = { paddingTop: 12 }; // Specific top
            const contentContainerStyle = { paddingVertical: 6 }; // Vertical fallback

            expect(extractPadding(style, contentContainerStyle, "Top")).toBe(18); // 12 + 6
        });

        it("should handle Bottom padding", () => {
            const style = { paddingBottom: 14 };
            const contentContainerStyle = { paddingBottom: 7 };

            expect(extractPadding(style, contentContainerStyle, "Bottom")).toBe(21);
        });

        it("should handle zero values", () => {
            const style = { paddingTop: 0 };
            const contentContainerStyle = { paddingTop: 0 };

            expect(extractPadding(style, contentContainerStyle, "Top")).toBe(0);
        });

        it("should handle negative values", () => {
            const style = { paddingTop: -5 };
            const contentContainerStyle = { paddingTop: 10 };

            expect(extractPadding(style, contentContainerStyle, "Top")).toBe(5); // -5 + 10
        });

        it("should handle floating point values", () => {
            const style = { paddingTop: 5.5 };
            const contentContainerStyle = { paddingTop: 2.3 };

            expect(extractPadding(style, contentContainerStyle, "Top")).toBeCloseTo(7.8, 1);
        });

        it("should handle undefined style objects", () => {
            expect(() => {
                extractPadding(undefined as any, {}, "Top");
            }).toThrow();
        });

        it("should work with complex style hierarchies", () => {
            const style = {
                padding: 10, // Should be ignored
                paddingBottom: 25,
                paddingTop: 20,
                paddingVertical: 15, // Should be ignored because specific values exist
            };

            const contentContainerStyle = {
                paddingVertical: 8, // Should be used for both top and bottom
            };

            expect(extractPadding(style, contentContainerStyle, "Top")).toBe(28); // 20 + 8
            expect(extractPadding(style, contentContainerStyle, "Bottom")).toBe(33); // 25 + 8
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle extreme values", () => {
            expect(roundSize(1000000)).toBeGreaterThan(999999);
            expect(roundSize(Number.MIN_VALUE)).toBe(0); // Very small number rounds to 0
            expect(comparatorDefault(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)).toBe(
                Number.MAX_SAFE_INTEGER - Number.MIN_SAFE_INTEGER,
            );
        });

        it("should handle type coercion edge cases", () => {
            // These test what happens if wrong types are passed
            expect(isFunction({})).toBe(false);
            expect(isArray(null)).toBe(false);
            expect(isNullOrUndefined("")).toBe(false);
        });

        it("should handle concurrent warning calls", () => {
            const originalConsoleWarn = console.warn;
            const consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});
            (globalThis as any).__DEV__ = true;

            // Simulate concurrent calls
            const promises = Array.from({ length: 100 }, (_, i) =>
                Promise.resolve().then(() => warnDevOnce("concurrent-test", `Message ${i}`)),
            );

            return Promise.all(promises).then(() => {
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
                console.warn = originalConsoleWarn;
            });
        });

        it("should handle memory pressure with many warnings", () => {
            const originalConsoleWarn = console.warn;
            const consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});
            (globalThis as any).__DEV__ = true;

            // Create many unique warning IDs
            for (let i = 0; i < 10000; i++) {
                warnDevOnce(`warning-${i}`, `Warning ${i}`);
            }

            expect(consoleWarnSpy).toHaveBeenCalledTimes(10000);
            console.warn = originalConsoleWarn;
        });

        it("should handle various object types for byIndex", () => {
            class TestClass {
                index = 99;
                constructor() {}
            }

            const instance = new TestClass();
            expect(byIndex(instance)).toBe(99);

            const inherited = Object.create({ index: 88 });
            expect(byIndex(inherited)).toBe(88);
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid function type checks", () => {
            const items = Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? () => i : i));

            const start = performance.now();
            const functions = items.filter(isFunction);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(10);
            expect(functions.length).toBe(500);
        });

        it("should handle rapid array type checks", () => {
            const items = Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? [i] : i));

            const start = performance.now();
            const arrays = items.filter(isArray);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(10);
            expect(arrays.length).toBe(500);
        });

        it("should handle rapid size rounding", () => {
            const start = performance.now();

            for (let i = 0; i < 10000; i++) {
                roundSize(i + Math.random());
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(50);
        });

        it("should handle rapid comparisons", () => {
            const numbers = Array.from({ length: 1000 }, () => Math.random() * 1000);

            const start = performance.now();
            numbers.sort(comparatorDefault);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(10);
        });
    });
});
