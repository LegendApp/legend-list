import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { getItemSize } from "../../src/utils/getItemSize";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("getItemSize", () => {
    let mockState: InternalState;
    let mockCtx: StateContext;
    const callGetItemSize = (
        key: string,
        index: number,
        data: any,
        useAverageSize?: boolean,
        preferCachedSize?: boolean,
    ) => getItemSize(mockCtx, mockState, key, index, data, useAverageSize, preferCachedSize);
    const setScrollingTo = (value: any) => mockCtx.values.set("scrollingTo", value);

    beforeEach(() => {
        mockCtx = createMockContext({ scrollingTo: undefined });
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

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(75);
            // Should not modify sizes cache
            expect(mockState.sizes.has("item_0")).toBe(false);
        });

        it("should return zero size when explicitly set as known", () => {
            mockState.sizesKnown.set("item_0", 0);

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(0);
        });

        it("should not use cached size if known size exists", () => {
            mockState.sizesKnown.set("item_0", 100);
            mockState.sizes.set("item_0", 75); // Different cached size

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(100); // Should use known size, not cached
        });
    });

    describe("average size optimization (new architecture)", () => {
        it("should use average size when conditions are met", () => {
            // All conditions for average size: useAverageSize=true, defaultAverage provided, no known size, no getEstimatedItemSize, not scrollingTo
            const result = callGetItemSize("item_0", 0, { id: 0 }, true);

            expect(result).toBe(80);
            expect(mockState.sizes.get("item_0")).toBe(80); // Should cache the result
        });

        it("should not use average size when getEstimatedItemSize is provided", () => {
            mockState.props.getEstimatedItemSize = (index: number) => index * 10 + 50;

            // When an estimation function is provided, callers should pass useAverageSize=false
            const result = callGetItemSize("item_0", 0, { id: 0 }, false);

            expect(result).toBe(50); // Should use getEstimatedItemSize result
            expect(mockState.sizes.get("item_0")).toBe(50);
        });

        it("should not use average size when scrollingTo is true", () => {
            setScrollingTo({ index: 0, offset: 0 });

            const result = callGetItemSize("item_0", 0, { id: 0 }, true);

            expect(result).toBe(50); // Should fall back to estimatedItemSize
            expect(mockState.sizes.get("item_0")).toBe(50);
        });

        it("should not use average size when no useAverageSize provided", () => {
            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(50); // Should use estimatedItemSize
            expect(mockState.sizes.get("item_0")).toBe(50);
        });
    });

    describe("cached sizes", () => {
        it("should return cached size when available and no known size", () => {
            mockState.sizes.set("item_0", 65);

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(65);
        });

        it("should reuse cached size even when average is available when preferred", () => {
            mockState.sizes.set("item_0", 65);

            const result = callGetItemSize("item_0", 0, { id: 0 }, true, true);

            expect(result).toBe(65);
        });

        describe("early return with preferCachedSize", () => {
            it("should immediately return cached size when preferCachedSize is true", () => {
                mockState.sizes.set("item_0", 90);
                mockState.props.getEstimatedItemSize = () => 100;

                const result = callGetItemSize("item_0", 0, { id: 0 }, false, true);

                expect(result).toBe(90);
            });

            it("should skip average size check when preferCachedSize returns early", () => {
                mockState.sizes.set("item_0", 90);

                const result = callGetItemSize("item_0", 0, { id: 0 }, true, true);

                // Should return cached size, not average (80)
                expect(result).toBe(90);
            });

            it("should skip getFixedItemSize when preferCachedSize returns early", () => {
                mockState.sizes.set("item_0", 90);
                let fixedSizeCalled = false;
                mockState.props.getFixedItemSize = () => {
                    fixedSizeCalled = true;
                    return 150;
                };

                const result = callGetItemSize("item_0", 0, { id: 0 }, false, true);

                expect(result).toBe(90);
                expect(fixedSizeCalled).toBe(false); // Should not be called due to early return
            });

            it("should fall through when preferCachedSize is true but no cache exists", () => {
                mockState.props.getEstimatedItemSize = () => 100;

                const result = callGetItemSize("item_0", 0, { id: 0 }, false, true);

                expect(result).toBe(100); // Should use estimation since cache is empty
            });
        });

        describe("cache priority with getFixedItemSize", () => {
            it("should use getFixedItemSize over cached size by default", () => {
                mockState.sizes.set("item_0", 90);
                mockState.props.getFixedItemSize = () => 150;

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(150);
                // Should also set it as known size
                expect(mockState.sizesKnown.get("item_0")).toBe(150);
            });

            it("should use cached size over getFixedItemSize when preferCachedSize is true", () => {
                mockState.sizes.set("item_0", 90);
                mockState.props.getFixedItemSize = () => 150;

                const result = callGetItemSize("item_0", 0, { id: 0 }, false, true);

                expect(result).toBe(90);
                // Should NOT set known size since we took cached path
                expect(mockState.sizesKnown.has("item_0")).toBe(false);
            });

            it("should update sizesKnown when getFixedItemSize is used", () => {
                mockState.props.getFixedItemSize = () => 150;

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(150);
                expect(mockState.sizesKnown.get("item_0")).toBe(150);
            });

            it("should not update cache when getFixedItemSize returns undefined and cache exists", () => {
                mockState.sizes.set("item_0", 90);
                mockState.props.getFixedItemSize = () => undefined;

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(90); // Should use cached size
            });
        });

        describe("cache interaction with average size", () => {
            it("should use average size over cached size when useAverageSize is true", () => {
                mockState.sizes.set("item_0", 90);

                const result = callGetItemSize("item_0", 0, { id: 0 }, true, false);

                expect(result).toBe(80); // Average size
            });

            it("should use cached size when average is unavailable", () => {
                mockState.sizes.set("item_0", 90);
                mockState.averageSizes = {}; // No average available

                const result = callGetItemSize("item_0", 0, { id: 0 }, true, false);

                expect(result).toBe(90); // Should fall back to cached
            });

            it("should use cached size when scrollingTo prevents average", () => {
                mockState.sizes.set("item_0", 90);
                setScrollingTo({ index: 0, offset: 0 });

                const result = callGetItemSize("item_0", 0, { id: 0 }, true, false);

                expect(result).toBe(90); // Average disabled, should use cache
            });

            it("should update cache when average size is used", () => {
                // No cache initially
                const result = callGetItemSize("item_0", 0, { id: 0 }, true, false);

                expect(result).toBe(80);
                expect(mockState.sizes.get("item_0")).toBe(80); // Should cache the average
            });
        });

        describe("cache interaction with getEstimatedItemSize", () => {
            it("should use cached size over getEstimatedItemSize", () => {
                mockState.sizes.set("item_0", 90);
                mockState.props.getEstimatedItemSize = () => 100;

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(90); // Cached takes precedence
            });

            it("should not call getEstimatedItemSize when cache is available", () => {
                mockState.sizes.set("item_0", 90);
                let estimateCalled = false;
                mockState.props.getEstimatedItemSize = () => {
                    estimateCalled = true;
                    return 100;
                };

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(90);
                expect(estimateCalled).toBe(false); // Should not be called
            });

            it("should use getEstimatedItemSize when no cache exists", () => {
                mockState.props.getEstimatedItemSize = () => 100;

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(100);
                expect(mockState.sizes.get("item_0")).toBe(100); // Should cache it
            });
        });

        describe("cache with item types", () => {
            beforeEach(() => {
                mockState.props.getItemType = (data: any) => data.type || "";
                mockState.averageSizes = {
                    "": { avg: 80, num: 1 },
                    large: { avg: 120, num: 1 },
                    small: { avg: 40, num: 1 },
                };
            });

            it("should use cached size regardless of item type when not using average", () => {
                mockState.sizes.set("item_0", 90);

                const result = callGetItemSize("item_0", 0, { id: 0, type: "large" }, false);

                // Should use cached 90, not large average of 120
                expect(result).toBe(90);
            });

            it("should prefer type-specific average over cached size when useAverageSize is true", () => {
                mockState.sizes.set("item_0", 90);

                const result = callGetItemSize("item_0", 0, { id: 0, type: "large" }, true);

                // Average takes precedence over cache when explicitly requested
                expect(result).toBe(120);
            });

            it("should use type-specific average when no cache exists", () => {
                const result = callGetItemSize("item_0", 0, { id: 0, type: "large" }, true);

                expect(result).toBe(120); // Large type average
                expect(mockState.sizes.get("item_0")).toBe(120);
            });

            it("should use default type average when type is undefined", () => {
                const result = callGetItemSize("item_0", 0, { id: 0 }, true);

                expect(result).toBe(80); // Default type average
            });

            it("should cache and reuse size for items with same key but different types when preferCachedSize is true", () => {
                // First call with type "large"
                const result1 = callGetItemSize("item_0", 0, { id: 0, type: "large" }, true, true);
                expect(result1).toBe(120);

                // Second call with type "small" - should use cached value from first call
                const result2 = callGetItemSize("item_0", 0, { id: 0, type: "small" }, true, true);
                expect(result2).toBe(120); // Uses cache, ignores new type
            });

            it("should recalculate with new type average when cache is not preferred", () => {
                // First call with type "large"
                const result1 = callGetItemSize("item_0", 0, { id: 0, type: "large" }, true);
                expect(result1).toBe(120);

                // Second call with type "small" - calculates new average despite cache
                const result2 = callGetItemSize("item_0", 0, { id: 0, type: "small" }, true);
                expect(result2).toBe(40); // Recalculates based on new type
            });
        });

        describe("cached size edge cases", () => {
            it("should return cached zero size", () => {
                mockState.sizes.set("item_0", 0);

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(0);
            });

            it("should return cached negative size", () => {
                mockState.sizes.set("item_0", -50);

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(-50);
            });

            it("should return cached NaN size", () => {
                mockState.sizes.set("item_0", NaN);

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(Number.isNaN(result)).toBe(true);
            });

            it("should return cached floating point size", () => {
                mockState.sizes.set("item_0", 65.75);

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(65.75);
            });

            it("should return cached infinity", () => {
                mockState.sizes.set("item_0", Number.POSITIVE_INFINITY);

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(Number.POSITIVE_INFINITY);
            });

            it("should treat undefined cache value same as missing cache entry", () => {
                // Explicitly set undefined in cache
                mockState.sizes.set("item_0", undefined as any);

                const result = callGetItemSize("item_0", 0, { id: 0 });

                // When cache value is undefined, it's treated as no cache and falls back to estimatedItemSize
                expect(result).toBe(50);
            });

            it("should fall through to estimation when cache is undefined", () => {
                mockState.sizes.set("item_0", undefined as any);
                mockState.props.getEstimatedItemSize = () => 100;

                const result = callGetItemSize("item_0", 0, { id: 0 });

                // When cache value is undefined, should fall through to estimation
                expect(result).toBe(100);
            });
        });

        describe("cache updates and persistence", () => {
            it("should update cache when estimated size is calculated", () => {
                mockState.props.getEstimatedItemSize = () => 100;

                callGetItemSize("item_0", 0, { id: 0 });

                expect(mockState.sizes.get("item_0")).toBe(100);
            });

            it("should update cache when average size is used", () => {
                callGetItemSize("item_0", 0, { id: 0 }, true);

                expect(mockState.sizes.get("item_0")).toBe(80);
            });

            it("should not update cache when returning known size", () => {
                mockState.sizesKnown.set("item_0", 150);
                mockState.sizes.set("item_0", 90);

                callGetItemSize("item_0", 0, { id: 0 });

                // Cache should remain unchanged
                expect(mockState.sizes.get("item_0")).toBe(90);
            });

            it("should not update cache when preferCachedSize returns early", () => {
                mockState.sizes.set("item_0", 90);

                callGetItemSize("item_0", 0, { id: 0 }, false, true);

                // Cache should remain exactly the same
                expect(mockState.sizes.get("item_0")).toBe(90);
            });

            it("should overwrite cache when recalculated with different estimation", () => {
                // First call caches 100
                mockState.props.getEstimatedItemSize = () => 100;
                callGetItemSize("item_0", 0, { id: 0 });
                expect(mockState.sizes.get("item_0")).toBe(100);

                // Clear cache and use different estimation
                mockState.sizes.delete("item_0");
                mockState.props.getEstimatedItemSize = () => 200;
                callGetItemSize("item_0", 0, { id: 0 });

                expect(mockState.sizes.get("item_0")).toBe(200);
            });
        });

        describe("cache performance characteristics", () => {
            it("should prefer cache over expensive estimation function", () => {
                mockState.sizes.set("item_0", 90);
                let estimateCalled = false;

                mockState.props.getEstimatedItemSize = () => {
                    estimateCalled = true;
                    // Simulate expensive calculation
                    let sum = 0;
                    for (let i = 0; i < 1000; i++) {
                        sum += i;
                    }
                    return sum > 0 ? 100 : 50;
                };

                const result = callGetItemSize("item_0", 0, { id: 0 });

                expect(result).toBe(90);
                expect(estimateCalled).toBe(false); // Should skip expensive call
            });

            it("should handle large cache sizes efficiently", () => {
                // Fill cache with many items
                for (let i = 0; i < 10000; i++) {
                    mockState.sizes.set(`item_${i}`, i + 50);
                }

                const start = Date.now();
                const result = callGetItemSize("item_5000", 5000, { id: 5000 });
                const duration = Date.now() - start;

                expect(result).toBe(5050); // Should retrieve from cache
                expect(duration).toBeLessThan(10); // Should be fast
            });
        });
    });

    describe("estimated sizes", () => {
        it("should use static estimatedItemSize when no other size available", () => {
            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(50);
            expect(mockState.sizes.get("item_0")).toBe(50);
        });

        it("should use getEstimatedItemSize function when provided", () => {
            mockState.props.getEstimatedItemSize = (index: number, data: any) => {
                return data.height || index * 10 + 30;
            };

            const result = callGetItemSize("item_0", 0, { height: 120, id: 0 });

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
            const result = callGetItemSize("item_5", 5, testData);

            expect(result).toBe(99);
            expect(capturedIndex).toBe(5);
            expect(capturedData).toBe(testData);
        });

        it("should return undefined when getEstimatedItemSize returns undefined", () => {
            mockState.props.getEstimatedItemSize = () => undefined as any;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBeUndefined(); // Real function returns undefined, doesn't fall back
        });
    });

    describe("size caching behavior", () => {
        it("should cache the final calculated size", () => {
            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(50);
            expect(mockState.sizes.get("item_0")).toBe(50);
        });

        it("should not modify sizes cache when returning known size", () => {
            mockState.sizesKnown.set("item_0", 75);
            mockState.sizes.set("item_0", 100); // Different cached value

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(75);
            expect(mockState.sizes.get("item_0")).toBe(100); // Should remain unchanged
        });

        it("should update cache when using average size", () => {
            const result = callGetItemSize("item_0", 0, { id: 0 }, true);

            expect(result).toBe(80);
            expect(mockState.sizes.get("item_0")).toBe(80);
        });

        it("should update cache when using estimated size", () => {
            mockState.props.getEstimatedItemSize = () => 77;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(77);
            expect(mockState.sizes.get("item_0")).toBe(77);
        });
    });

    describe("priority order", () => {
        it("should prioritize known size over all other sources", () => {
            mockState.sizesKnown.set("item_0", 100);
            mockState.sizes.set("item_0", 200);
            mockState.props.getEstimatedItemSize = () => 300;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(100); // Known size takes precedence
        });

        it("should prioritize average size over cached size by default", () => {
            mockState.sizes.set("item_0", 200);

            const result = callGetItemSize("item_0", 0, { id: 0 }, true);

            expect(result).toBe(80);
        });

        it("should allow preferring cached size over average size", () => {
            mockState.sizes.set("item_0", 200);

            const result = callGetItemSize("item_0", 0, { id: 0 }, true, true);

            expect(result).toBe(200);
        });

        it("should prioritize cached size over estimated size", () => {
            mockState.sizes.set("item_0", 200);
            mockState.props.getEstimatedItemSize = () => 300;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(200); // Cached size takes precedence over estimated
        });

        it("should use getEstimatedItemSize over static estimatedItemSize", () => {
            mockState.props.estimatedItemSize = 100;
            mockState.props.getEstimatedItemSize = () => 200;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(200); // Function takes precedence over static value
        });
    });

    describe("edge cases and error handling", () => {
        it("returns undefined when no estimation strategy is available", () => {
            mockState.props.estimatedItemSize = undefined;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBeUndefined();
            expect(mockState.sizes.has("item_0")).toBe(true);
            expect(mockState.sizes.get("item_0")).toBeUndefined();
        });

        it("should handle null estimatedItemSize", () => {
            mockState.props.estimatedItemSize = null as any;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBeNull();
            expect(mockState.sizes.get("item_0")).toBeNull();
        });

        it("should handle zero estimatedItemSize", () => {
            mockState.props.estimatedItemSize = 0;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(0);
            expect(mockState.sizes.get("item_0")).toBe(0);
        });

        it("should handle negative estimatedItemSize", () => {
            mockState.props.estimatedItemSize = -50;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(-50);
            expect(mockState.sizes.get("item_0")).toBe(-50);
        });

        it("should handle floating point sizes", () => {
            mockState.props.estimatedItemSize = 50.75;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(50.75);
            expect(mockState.sizes.get("item_0")).toBe(50.75);
        });

        it("should handle very large sizes", () => {
            const largeSize = Number.MAX_SAFE_INTEGER;
            mockState.props.estimatedItemSize = largeSize;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(largeSize);
            expect(mockState.sizes.get("item_0")).toBe(largeSize);
        });

        it("should handle empty string key", () => {
            const result = callGetItemSize("", 0, { id: 0 });

            expect(result).toBe(50);
            expect(mockState.sizes.get("")).toBe(50);
        });

        it("should handle special character keys", () => {
            const key = "item-with@special#chars$%";

            const result = callGetItemSize(key, 0, { id: 0 });

            expect(result).toBe(50);
            expect(mockState.sizes.get(key)).toBe(50);
        });

        it("should handle null data parameter", () => {
            mockState.props.getEstimatedItemSize = (_index: number, data: any) => {
                return data ? 100 : 50;
            };

            const result = callGetItemSize("item_0", 0, null);

            expect(result).toBe(50);
        });

        it("should handle undefined data parameter", () => {
            mockState.props.getEstimatedItemSize = (_index: number, data: any) => {
                return data ? 100 : 75;
            };

            const result = callGetItemSize("item_0", 0, undefined);

            expect(result).toBe(75);
        });
    });

    describe("getEstimatedItemSize function edge cases", () => {
        it("should handle getEstimatedItemSize that throws an error", () => {
            mockState.props.getEstimatedItemSize = () => {
                throw new Error("Estimation failed");
            };

            expect(() => {
                callGetItemSize("item_0", 0, { id: 0 });
            }).toThrow("Estimation failed");
        });

        it("should handle getEstimatedItemSize returning NaN", () => {
            mockState.props.getEstimatedItemSize = () => NaN;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(Number.isNaN(result)).toBe(true);
            expect(Number.isNaN(mockState.sizes.get("item_0"))).toBe(true);
        });

        it("should handle getEstimatedItemSize returning Infinity", () => {
            mockState.props.getEstimatedItemSize = () => Number.POSITIVE_INFINITY;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(Number.POSITIVE_INFINITY);
            expect(mockState.sizes.get("item_0")).toBe(Number.POSITIVE_INFINITY);
        });

        it("should handle getEstimatedItemSize returning negative infinity", () => {
            mockState.props.getEstimatedItemSize = () => Number.NEGATIVE_INFINITY;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe(Number.NEGATIVE_INFINITY);
            expect(mockState.sizes.get("item_0")).toBe(Number.NEGATIVE_INFINITY);
        });

        it("should handle getEstimatedItemSize returning non-numeric types", () => {
            mockState.props.getEstimatedItemSize = () => "50" as any;

            const result = callGetItemSize("item_0", 0, { id: 0 });

            expect(result).toBe("50" as any);
            expect(mockState.sizes.get("item_0")).toBe("50" as any);
        });
    });

    describe("catastrophic failure scenarios", () => {
        it("should handle corrupted sizesKnown map", () => {
            mockState.sizesKnown = null as any;

            expect(() => {
                callGetItemSize("item_0", 0, { id: 0 });
            }).toThrow();
        });

        it("should handle corrupted sizes map", () => {
            mockState.sizes = null as any;

            expect(() => {
                callGetItemSize("item_0", 0, { id: 0 });
            }).toThrow();
        });

        it("should handle missing props object", () => {
            mockState.props = undefined as any;

            expect(() => {
                callGetItemSize("item_0", 0, { id: 0 });
            }).toThrow();
        });

        it("should handle corrupted state object", () => {
            const corruptState = {
                get sizesKnown() {
                    throw new Error("Corrupted sizesKnown");
                },
            } as any;

            expect(() => {
                getItemSize(mockCtx, corruptState, "item_0", 0, { id: 0 });
            }).toThrow("Corrupted sizesKnown");
        });

        it("should handle circular references in data", () => {
            const circularData: any = { id: 0 };
            circularData.self = circularData;

            mockState.props.getEstimatedItemSize = (_index: number, data: any) => {
                // Try to access circular reference
                return data.self.id * 10 + 50;
            };

            const result = callGetItemSize("item_0", 0, circularData);

            expect(result).toBe(50); // 0 * 10 + 50
        });

        it("should handle memory pressure with many cached sizes", () => {
            // Simulate memory pressure by creating many cached sizes
            for (let i = 0; i < 100000; i++) {
                mockState.sizes.set(`item_${i}`, i);
            }

            const start = Date.now();
            const result = callGetItemSize("item_50000", 50000, { id: 50000 });
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(50); // Should complete quickly
            expect(result).toBe(50000); // Should return cached value
        });

        it("should handle concurrent access patterns", () => {
            const results: number[] = [];

            // Simulate concurrent calls that might interfere with each other
            for (let i = 0; i < 10; i++) {
                const result = callGetItemSize(`item_${i}`, i, { id: i });
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
                callGetItemSize("item_0", 0, { id: 0 });
            }).toThrow("Map corrupted");

            // Restore for cleanup
            mockState.sizes.get = originalGet;
        });

        it("should handle extreme index values", () => {
            mockState.props.getEstimatedItemSize = (index: number) => index;

            // Test extreme positive index
            const result1 = callGetItemSize("max_item", Number.MAX_SAFE_INTEGER, { id: 1 });
            expect(result1).toBe(Number.MAX_SAFE_INTEGER);

            // Test extreme negative index
            const result2 = callGetItemSize("min_item", Number.MIN_SAFE_INTEGER, { id: 2 });
            expect(result2).toBe(Number.MIN_SAFE_INTEGER);

            // Test fractional index
            const result3 = callGetItemSize("float_item", 1.5, { id: 3 });
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
                return callGetItemSize(`recursive_${index}`, index + 1, data);
            };

            expect(() => {
                callGetItemSize("item_0", 0, { id: 0 });
            }).toThrow("Stack overflow prevented");
        });
    });

    describe("performance benchmarks", () => {
        it("should retrieve known sizes quickly", () => {
            mockState.sizesKnown.set("item_0", 100);

            const start = Date.now();
            for (let i = 0; i < 1000; i++) {
                callGetItemSize("item_0", 0, { id: 0 });
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
            const result1 = callGetItemSize("item_0", 0, { id: 0 });
            expect(result1).toBe(75);
            expect(callCount).toBe(1);

            // Second call should use cache
            const result2 = callGetItemSize("item_0", 0, { id: 0 });
            expect(result2).toBe(75);
            expect(callCount).toBe(1); // Should not call estimation again
        });

        it("should handle large datasets efficiently", () => {
            const start = Date.now();

            for (let i = 0; i < 10000; i++) {
                callGetItemSize(`item_${i}`, i, { id: i });
            }

            const duration = Date.now() - start;

            expect(duration).toBeLessThan(100); // Should complete in reasonable time
            expect(mockState.sizes.size).toBe(10000); // All should be cached
        });
    });
});
