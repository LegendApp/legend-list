import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import type { InternalState } from "../../src/types";
import { getId } from "../../src/utils/getId";

describe("getId", () => {
    let mockState: InternalState;

    beforeEach(() => {
        mockState = {
            idCache: new Map(),
            props: {
                data: [
                    { id: "item1", name: "First" },
                    { id: "item2", name: "Second" },
                    { id: "item3", name: "Third" },
                ],
                keyExtractor: (item: any, index: number) => item.id,
            },
        } as InternalState;
    });

    describe("basic functionality", () => {
        it("should generate ID using keyExtractor when provided", () => {
            const result = getId(mockState, 0);

            expect(result).toBe("item1");
            expect(mockState.idCache.get(0)).toBe("item1");
        });

        it("should cache generated IDs", () => {
            getId(mockState, 1);
            getId(mockState, 1); // Second call

            expect(mockState.idCache.get(1)).toBe("item2");
            expect(mockState.idCache.size).toBe(1); // Only one entry should be cached
        });

        it("should use index as ID when keyExtractor is not provided", () => {
            mockState.props.keyExtractor = undefined;

            const result = getId(mockState, 2);

            expect(result).toBe(2);
            expect(mockState.idCache.get(2)).toBe(2);
        });

        it("should handle different item types with keyExtractor", () => {
            mockState.props.data = ["apple", "banana", "cherry"];
            mockState.props.keyExtractor = (item: string, index: number) => `fruit_${item}`;

            const result = getId(mockState, 1);

            expect(result).toBe("fruit_banana");
            expect(mockState.idCache.get(1)).toBe("fruit_banana");
        });
    });

    describe("edge cases", () => {
        it("should return empty string when data is null", () => {
            mockState.props.data = null as any;

            const result = getId(mockState, 0);

            expect(result).toBe("");
            expect(mockState.idCache.has(0)).toBe(false);
        });

        it("should return empty string when data is undefined", () => {
            mockState.props.data = undefined as any;

            const result = getId(mockState, 0);

            expect(result).toBe("");
            expect(mockState.idCache.has(0)).toBe(false);
        });

        it("should handle empty data array", () => {
            mockState.props.data = [];

            const result = getId(mockState, 0);

            expect(result).toBe(null);
            expect(mockState.idCache.get(0)).toBe(null);
        });

        it("should handle index beyond data length", () => {
            const result = getId(mockState, 10); // Beyond data length

            expect(result).toBe(null);
            expect(mockState.idCache.get(10)).toBe(null);
        });

        it("should handle negative index", () => {
            // For negative index, index < data.length is still true for -1 < 3
            // So it will try to access data[-1] which is undefined, then call keyExtractor(undefined, -1)
            expect(() => getId(mockState, -1)).toThrow();
        });

        it("should handle index 0 correctly", () => {
            const result = getId(mockState, 0);

            expect(result).toBe("item1");
            expect(mockState.idCache.get(0)).toBe("item1");
        });

        it("should handle floating point index", () => {
            // For floating point index 1.5, it's < data.length (3), so it tries data[1.5] which is undefined
            expect(() => getId(mockState, 1.5)).toThrow();
        });
    });

    describe("keyExtractor behavior", () => {
        it("should handle keyExtractor returning number", () => {
            mockState.props.keyExtractor = (item: any, index: number) => index * 100;

            const result = getId(mockState, 1);

            expect(result).toBe(100);
            expect(mockState.idCache.get(1)).toBe(100);
        });

        it("should handle keyExtractor returning null", () => {
            mockState.props.keyExtractor = (item: any, index: number) => null;

            const result = getId(mockState, 0);

            expect(result).toBe(null);
            expect(mockState.idCache.get(0)).toBe(null);
        });

        it("should handle keyExtractor returning undefined", () => {
            mockState.props.keyExtractor = (item: any, index: number) => undefined;

            const result = getId(mockState, 0);

            expect(result).toBe(undefined);
            expect(mockState.idCache.get(0)).toBe(undefined);
        });

        it("should handle keyExtractor returning empty string", () => {
            mockState.props.keyExtractor = (item: any, index: number) => "";

            const result = getId(mockState, 0);

            expect(result).toBe("");
            expect(mockState.idCache.get(0)).toBe("");
        });

        it("should handle keyExtractor throwing error", () => {
            mockState.props.keyExtractor = (item: any, index: number) => {
                throw new Error("keyExtractor error");
            };

            expect(() => getId(mockState, 0)).toThrow("keyExtractor error");
        });

        it("should handle complex keyExtractor logic", () => {
            mockState.props.data = [
                { id: 1, name: "John", type: "user" },
                { id: 2, title: "Hello", type: "post" },
                { id: 3, name: "Jane", type: "user" },
            ];
            mockState.props.keyExtractor = (item: any, index: number) => `${item.type}_${item.id}`;

            expect(getId(mockState, 0)).toBe("user_1");
            expect(getId(mockState, 1)).toBe("post_2");
            expect(getId(mockState, 2)).toBe("user_3");
        });
    });

    describe("caching behavior", () => {
        it("should maintain separate cache entries for different indices", () => {
            getId(mockState, 0);
            getId(mockState, 1);
            getId(mockState, 2);

            expect(mockState.idCache.size).toBe(3);
            expect(mockState.idCache.get(0)).toBe("item1");
            expect(mockState.idCache.get(1)).toBe("item2");
            expect(mockState.idCache.get(2)).toBe("item3");
        });

        it("should handle cache with pre-existing entries", () => {
            mockState.idCache.set(5, "pre-existing");

            getId(mockState, 0);

            expect(mockState.idCache.size).toBe(2);
            expect(mockState.idCache.get(0)).toBe("item1");
            expect(mockState.idCache.get(5)).toBe("pre-existing");
        });

        it("should overwrite cache if called again for same index", () => {
            getId(mockState, 0);

            // Change the data and keyExtractor
            mockState.props.data[0] = { id: "changed", name: "Changed" };
            getId(mockState, 0);

            expect(mockState.idCache.get(0)).toBe("changed");
        });
    });

    describe("type handling", () => {
        it("should handle various data types in array", () => {
            mockState.props.data = [null, undefined, "", 0, false, {}, []];
            mockState.props.keyExtractor = (item: any, index: number) => `type_${typeof item}_${index}`;

            expect(getId(mockState, 0)).toBe("type_object_0"); // null is typeof object
            expect(getId(mockState, 1)).toBe("type_undefined_1");
            expect(getId(mockState, 2)).toBe("type_string_2");
            expect(getId(mockState, 3)).toBe("type_number_3");
            expect(getId(mockState, 4)).toBe("type_boolean_4");
            expect(getId(mockState, 5)).toBe("type_object_5");
            expect(getId(mockState, 6)).toBe("type_object_6");
        });

        it("should handle string coercion when no keyExtractor", () => {
            mockState.props.data = [42, true, {}, []];
            mockState.props.keyExtractor = undefined;

            expect(getId(mockState, 0)).toBe(0);
            expect(getId(mockState, 1)).toBe(1);
            expect(getId(mockState, 2)).toBe(2);
            expect(getId(mockState, 3)).toBe(3);
        });
    });

    describe("performance and stress testing", () => {
        it("should handle large datasets efficiently", () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: `item_${i}` }));
            mockState.props.data = largeData;
            mockState.props.keyExtractor = (item: any) => item.id;

            const start = Date.now();

            // Generate IDs for various indices
            for (let i = 0; i < 100; i++) {
                getId(mockState, i * 100);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50); // Should be very fast
            expect(mockState.idCache.size).toBe(100);
        });

        it("should handle rapid consecutive calls", () => {
            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                getId(mockState, i % mockState.props.data.length);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100); // Should be very fast
        });

        it("should maintain memory efficiency with cache", () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Generate many IDs
            for (let i = 0; i < 1000; i++) {
                getId(mockState, i % 10); // Cycle through 10 items
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Should not have significant memory increase (cache should be bounded)
            expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB
            expect(mockState.idCache.size).toBe(10); // Only 10 unique entries
        });
    });

    describe("error handling and recovery", () => {
        it("should handle corrupted idCache gracefully", () => {
            mockState.idCache = null as any;

            expect(() => getId(mockState, 0)).toThrow();
        });

        it("should handle missing props", () => {
            mockState.props = null as any;

            expect(() => getId(mockState, 0)).toThrow();
        });

        it("should handle corrupted data structure", () => {
            mockState.props.data = { length: 5 } as any; // Object with length property but not array

            // This will try to call keyExtractor with data[0] which is undefined on this object
            expect(() => getId(mockState, 0)).toThrow();
        });

        it("should handle very large indices", () => {
            const result = getId(mockState, Number.MAX_SAFE_INTEGER);

            expect(result).toBe(null);
            expect(mockState.idCache.get(Number.MAX_SAFE_INTEGER)).toBe(null);
        });

        it("should handle NaN index", () => {
            const result = getId(mockState, NaN);

            // NaN < data.length is false, so should return null
            expect(result).toBe(null);
            expect(mockState.idCache.get(NaN)).toBe(null);
        });

        it("should handle Infinity index", () => {
            const result = getId(mockState, Number.POSITIVE_INFINITY);

            expect(result).toBe(null);
            expect(mockState.idCache.get(Number.POSITIVE_INFINITY)).toBe(null);
        });
    });
});
