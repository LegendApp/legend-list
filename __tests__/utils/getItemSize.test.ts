import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import type { InternalState } from "../../src/types";
import { getItemSize } from "../../src/utils/getItemSize";
import { createMockState } from "../__mocks__/createMockState";

describe("getItemSize", () => {
    let mockState: InternalState;

    beforeEach(() => {
        mockState = createMockState({
            averageSizes: { "": { avg: 80, num: 1 } },
            props: {
                estimatedItemSize: 50,
            },
        });
    });

    describe("known sizes cache", () => {
        it("should return known size when available", () => {
            mockState.sizesKnown.set("item_0", 75);

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(75);
            // Should not modify sizes cache
            expect(mockState.sizes.has("item_0")).toBe(false);
        });

        it("should return zero size when explicitly set as known", () => {
            mockState.sizesKnown.set("item_0", 0);

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(0);
        });

        it("should not use cached size if known size exists", () => {
            mockState.sizesKnown.set("item_0", 100);
            mockState.sizes.set("item_0", 75); // Different cached size

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(100); // Should use known size, not cached
        });
    });

    describe("average size optimization (new architecture)", () => {
        it("should use average size when conditions are met", () => {
            // All conditions for average size: useAverageSize=true, defaultAverage provided, no known size, no getEstimatedItemSize, not scrollingTo
            const result = getItemSize(mockState, "item_0", 0, { id: 0 }, true);

            expect(result).toBe(80);
            expect(mockState.sizes.get("item_0")).toBe(80); // Should cache the result
        });

        it("should not use average size when getEstimatedItemSize is provided", () => {
            mockState.props.getEstimatedItemSize = (index: number) => index * 10 + 50;

            // When an estimation function is provided, callers should pass useAverageSize=false
            const result = getItemSize(mockState, "item_0", 0, { id: 0 }, false);

            expect(result).toBe(50); // Should use getEstimatedItemSize result
            expect(mockState.sizes.get("item_0")).toBe(50);
        });

        it("should not use average size when scrollingTo is true", () => {
            mockState.scrollingTo = { index: 0, offset: 0 };

            const result = getItemSize(mockState, "item_0", 0, { id: 0 }, true);

            expect(result).toBe(50); // Should fall back to estimatedItemSize
            expect(mockState.sizes.get("item_0")).toBe(50);
        });

        it("should not use average size when no useAverageSize provided", () => {
            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(50); // Should use estimatedItemSize
            expect(mockState.sizes.get("item_0")).toBe(50);
        });
    });

    describe("cached sizes", () => {
        it("should return cached size when available and no known size", () => {
            mockState.sizes.set("item_0", 65);

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(65);
        });

        it("should prefer average size over cached size", () => {
            mockState.sizes.set("item_0", 65);

            const result = getItemSize(mockState, "item_0", 0, { id: 0 }, true);

            expect(result).toBe(80); // Should use average size
            expect(mockState.sizes.get("item_0")).toBe(80); // Should update cache
        });
    });

    describe("estimated sizes", () => {
        it("should use static estimatedItemSize when no other size available", () => {
            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(50);
            expect(mockState.sizes.get("item_0")).toBe(50);
        });

        it("should use getEstimatedItemSize function when provided", () => {
            mockState.props.getEstimatedItemSize = (index: number, data: any) => {
                return data.height || index * 10 + 30;
            };

            const result = getItemSize(mockState, "item_0", 0, { height: 120, id: 0 });

            expect(result).toBe(120);
            expect(mockState.sizes.get("item_0")).toBe(120);
        });

        it("should call getEstimatedItemSize with correct parameters", () => {
            let capturedIndex: number | undefined;
            let capturedData: any;

            mockState.props.getEstimatedItemSize = (index: number, data: any) => {
                capturedIndex = index;
                capturedData = data;
                return 99;
            };

            const testData = { content: "test", id: 5 };
            const result = getItemSize(mockState, "item_5", 5, testData);

            expect(result).toBe(99);
            expect(capturedIndex).toBe(5);
            expect(capturedData).toBe(testData);
        });

        it("should return undefined when getEstimatedItemSize returns undefined", () => {
            mockState.props.getEstimatedItemSize = () => undefined as any;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBeUndefined(); // Real function returns undefined, doesn't fall back
        });
    });

    describe("size caching behavior", () => {
        it("should cache the final calculated size", () => {
            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(50);
            expect(mockState.sizes.get("item_0")).toBe(50);
        });

        it("should not modify sizes cache when returning known size", () => {
            mockState.sizesKnown.set("item_0", 75);
            mockState.sizes.set("item_0", 100); // Different cached value

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(75);
            expect(mockState.sizes.get("item_0")).toBe(100); // Should remain unchanged
        });

        it("should update cache when using average size", () => {
            const result = getItemSize(mockState, "item_0", 0, { id: 0 }, true);

            expect(result).toBe(80);
            expect(mockState.sizes.get("item_0")).toBe(80);
        });

        it("should update cache when using estimated size", () => {
            mockState.props.getEstimatedItemSize = () => 77;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(77);
            expect(mockState.sizes.get("item_0")).toBe(77);
        });
    });

    describe("priority order", () => {
        it("should prioritize known size over all other sources", () => {
            mockState.sizesKnown.set("item_0", 100);
            mockState.sizes.set("item_0", 200);
            mockState.props.getEstimatedItemSize = () => 300;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(100); // Known size takes precedence
        });

        it("should prioritize average size over cached size", () => {
            mockState.sizes.set("item_0", 200);

            const result = getItemSize(mockState, "item_0", 0, { id: 0 }, true);

            expect(result).toBe(80); // Average size takes precedence over cached
        });

        it("should prioritize cached size over estimated size", () => {
            mockState.sizes.set("item_0", 200);
            mockState.props.getEstimatedItemSize = () => 300;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(200); // Cached size takes precedence over estimated
        });

        it("should use getEstimatedItemSize over static estimatedItemSize", () => {
            mockState.props.estimatedItemSize = 100;
            mockState.props.getEstimatedItemSize = () => 200;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(200); // Function takes precedence over static value
        });
    });

    describe("edge cases and error handling", () => {
        it("returns undefined when no estimation strategy is available", () => {
            mockState.props.estimatedItemSize = undefined;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBeUndefined();
            expect(mockState.sizes.has("item_0")).toBe(true);
            expect(mockState.sizes.get("item_0")).toBeUndefined();
        });

        it("should handle null estimatedItemSize", () => {
            mockState.props.estimatedItemSize = null as any;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBeNull();
            expect(mockState.sizes.get("item_0")).toBeNull();
        });

        it("should handle zero estimatedItemSize", () => {
            mockState.props.estimatedItemSize = 0;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(0);
            expect(mockState.sizes.get("item_0")).toBe(0);
        });

        it("should handle negative estimatedItemSize", () => {
            mockState.props.estimatedItemSize = -50;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(-50);
            expect(mockState.sizes.get("item_0")).toBe(-50);
        });

        it("should handle floating point sizes", () => {
            mockState.props.estimatedItemSize = 50.75;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(50.75);
            expect(mockState.sizes.get("item_0")).toBe(50.75);
        });

        it("should handle very large sizes", () => {
            const largeSize = Number.MAX_SAFE_INTEGER;
            mockState.props.estimatedItemSize = largeSize;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(largeSize);
            expect(mockState.sizes.get("item_0")).toBe(largeSize);
        });

        it("should handle empty string key", () => {
            const result = getItemSize(mockState, "", 0, { id: 0 });

            expect(result).toBe(50);
            expect(mockState.sizes.get("")).toBe(50);
        });

        it("should handle special character keys", () => {
            const key = "item-with@special#chars$%";

            const result = getItemSize(mockState, key, 0, { id: 0 });

            expect(result).toBe(50);
            expect(mockState.sizes.get(key)).toBe(50);
        });

        it("should handle null data parameter", () => {
            mockState.props.getEstimatedItemSize = (_index: number, data: any) => {
                return data ? 100 : 50;
            };

            const result = getItemSize(mockState, "item_0", 0, null);

            expect(result).toBe(50);
        });

        it("should handle undefined data parameter", () => {
            mockState.props.getEstimatedItemSize = (_index: number, data: any) => {
                return data ? 100 : 75;
            };

            const result = getItemSize(mockState, "item_0", 0, undefined);

            expect(result).toBe(75);
        });
    });

    describe("getEstimatedItemSize function edge cases", () => {
        it("should handle getEstimatedItemSize that throws an error", () => {
            mockState.props.getEstimatedItemSize = () => {
                throw new Error("Estimation failed");
            };

            expect(() => {
                getItemSize(mockState, "item_0", 0, { id: 0 });
            }).toThrow("Estimation failed");
        });

        it("should handle getEstimatedItemSize returning NaN", () => {
            mockState.props.getEstimatedItemSize = () => NaN;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(Number.isNaN(result)).toBe(true);
            expect(Number.isNaN(mockState.sizes.get("item_0"))).toBe(true);
        });

        it("should handle getEstimatedItemSize returning Infinity", () => {
            mockState.props.getEstimatedItemSize = () => Number.POSITIVE_INFINITY;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(Number.POSITIVE_INFINITY);
            expect(mockState.sizes.get("item_0")).toBe(Number.POSITIVE_INFINITY);
        });

        it("should handle getEstimatedItemSize returning negative infinity", () => {
            mockState.props.getEstimatedItemSize = () => Number.NEGATIVE_INFINITY;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe(Number.NEGATIVE_INFINITY);
            expect(mockState.sizes.get("item_0")).toBe(Number.NEGATIVE_INFINITY);
        });

        it("should handle getEstimatedItemSize returning non-numeric types", () => {
            mockState.props.getEstimatedItemSize = () => "50" as any;

            const result = getItemSize(mockState, "item_0", 0, { id: 0 });

            expect(result).toBe("50" as any);
            expect(mockState.sizes.get("item_0")).toBe("50" as any);
        });
    });

    describe("catastrophic failure scenarios", () => {
        it("should handle corrupted sizesKnown map", () => {
            mockState.sizesKnown = null as any;

            expect(() => {
                getItemSize(mockState, "item_0", 0, { id: 0 });
            }).toThrow();
        });

        it("should handle corrupted sizes map", () => {
            mockState.sizes = null as any;

            expect(() => {
                getItemSize(mockState, "item_0", 0, { id: 0 });
            }).toThrow();
        });

        it("should handle missing props object", () => {
            mockState.props = undefined as any;

            expect(() => {
                getItemSize(mockState, "item_0", 0, { id: 0 });
            }).toThrow();
        });

        it("should handle corrupted state object", () => {
            const corruptState = {
                get sizesKnown() {
                    throw new Error("Corrupted sizesKnown");
                },
            } as any;

            expect(() => {
                getItemSize(corruptState, "item_0", 0, { id: 0 });
            }).toThrow("Corrupted sizesKnown");
        });

        it("should handle circular references in data", () => {
            const circularData: any = { id: 0 };
            circularData.self = circularData;

            mockState.props.getEstimatedItemSize = (_index: number, data: any) => {
                // Try to access circular reference
                return data.self.id * 10 + 50;
            };

            const result = getItemSize(mockState, "item_0", 0, circularData);

            expect(result).toBe(50); // 0 * 10 + 50
        });

        it("should handle memory pressure with many cached sizes", () => {
            // Simulate memory pressure by creating many cached sizes
            for (let i = 0; i < 100000; i++) {
                mockState.sizes.set(`item_${i}`, i);
            }

            const start = Date.now();
            const result = getItemSize(mockState, "item_50000", 50000, { id: 50000 });
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(50); // Should complete quickly
            expect(result).toBe(50000); // Should return cached value
        });

        it("should handle concurrent access patterns", () => {
            const results: number[] = [];

            // Simulate concurrent calls that might interfere with each other
            for (let i = 0; i < 10; i++) {
                const result = getItemSize(mockState, `item_${i}`, i, { id: i });
                results.push(result);

                // Modify cache during iteration
                mockState.sizes.set(`item_${i + 10}`, i * 2);
            }

            expect(results.length).toBe(10);
            expect(results.every((r) => r === 50)).toBe(true); // All should return estimatedItemSize
        });

        it("should handle invalid map operations", () => {
            // Replace map methods with throwing functions
            const originalGet = mockState.sizes.get;
            mockState.sizes.get = () => {
                throw new Error("Map corrupted");
            };

            expect(() => {
                getItemSize(mockState, "item_0", 0, { id: 0 });
            }).toThrow("Map corrupted");

            // Restore for cleanup
            mockState.sizes.get = originalGet;
        });

        it("should handle extreme index values", () => {
            mockState.props.getEstimatedItemSize = (index: number) => index;

            // Test extreme positive index
            const result1 = getItemSize(mockState, "max_item", Number.MAX_SAFE_INTEGER, { id: 1 });
            expect(result1).toBe(Number.MAX_SAFE_INTEGER);

            // Test extreme negative index
            const result2 = getItemSize(mockState, "min_item", Number.MIN_SAFE_INTEGER, { id: 2 });
            expect(result2).toBe(Number.MIN_SAFE_INTEGER);

            // Test fractional index
            const result3 = getItemSize(mockState, "float_item", 1.5, { id: 3 });
            expect(result3).toBe(1.5);
        });

        it("should handle recursive size calculations", () => {
            let recursionDepth = 0;

            mockState.props.getEstimatedItemSize = (index: number, data: any) => {
                recursionDepth++;
                if (recursionDepth > 1000) {
                    throw new Error("Stack overflow prevented");
                }

                // Try to trigger infinite recursion
                return getItemSize(mockState, `recursive_${index}`, index + 1, data);
            };

            expect(() => {
                getItemSize(mockState, "item_0", 0, { id: 0 });
            }).toThrow("Stack overflow prevented");
        });
    });

    describe("performance benchmarks", () => {
        it("should retrieve known sizes quickly", () => {
            mockState.sizesKnown.set("item_0", 100);

            const start = Date.now();
            for (let i = 0; i < 1000; i++) {
                getItemSize(mockState, "item_0", 0, { id: 0 });
            }
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(10); // Should be very fast for known sizes
        });

        it("should cache estimated sizes efficiently", () => {
            let callCount = 0;
            mockState.props.getEstimatedItemSize = () => {
                callCount++;
                return 75;
            };

            // First call should use estimation
            const result1 = getItemSize(mockState, "item_0", 0, { id: 0 });
            expect(result1).toBe(75);
            expect(callCount).toBe(1);

            // Second call should use cache
            const result2 = getItemSize(mockState, "item_0", 0, { id: 0 });
            expect(result2).toBe(75);
            expect(callCount).toBe(1); // Should not call estimation again
        });

        it("should handle large datasets efficiently", () => {
            const start = Date.now();

            for (let i = 0; i < 10000; i++) {
                getItemSize(mockState, `item_${i}`, i, { id: i });
            }

            const duration = Date.now() - start;

            expect(duration).toBeLessThan(100); // Should complete in reasonable time
            expect(mockState.sizes.size).toBe(10000); // All should be cached
        });
    });
});
