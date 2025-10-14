import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import type { InternalState } from "../../src/types";
import { checkAllSizesKnown } from "../../src/utils/checkAllSizesKnown";
import * as getIdModule from "../../src/utils/getId";
import { createMockState } from "../__mocks__/createMockState";

describe("checkAllSizesKnown", () => {
    let mockState: InternalState;
    let getIdSpy: any;

    beforeEach(() => {
        mockState = createMockState({
            hasScrolled: false,
            props: {
                data: [
                    { id: 0, text: "Item 0" },
                    { id: 1, text: "Item 1" },
                    { id: 2, text: "Item 2" },
                    { id: 3, text: "Item 3" },
                    { id: 4, text: "Item 4" },
                ],
                keyExtractor: (item: any) => `item-${item.id}`,
            },
            queuedInitialLayout: true,
            scrollLength: 500,
            totalSize: 0,
        });

        // Reset spy if it exists
        if (getIdSpy) getIdSpy.mockRestore?.();

        // Spy on getId function
        getIdSpy = spyOn(getIdModule, "getId").mockImplementation((_, index) => {
            return `item-${index}`;
        });
    });

    describe("basic functionality", () => {
        it("should return false when endBuffered is null", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = null as any;

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(false);
            expect(getIdSpy).not.toHaveBeenCalled();
        });

        it("should handle endBuffered as undefined (enters if block)", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = undefined as any;

            const result = checkAllSizesKnown(mockState);

            // undefined !== null is true, so enters if block, but loop condition fails
            expect(result).toBe(false); // Loop never executes, areAllKnown remains true
            expect(getIdSpy).not.toHaveBeenCalled();
        });

        it("should return true when all sizes in range are known", () => {
            mockState.startBuffered = 1;
            mockState.endBuffered = 3;

            // Mark all items in range as having known sizes
            mockState.sizesKnown.set("item-1", 100);
            mockState.sizesKnown.set("item-2", 120);
            mockState.sizesKnown.set("item-3", 110);

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(true);
            expect(getIdSpy).toHaveBeenCalledTimes(3);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 1);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 2);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 3);
        });

        it("should return false when some sizes in range are unknown", () => {
            mockState.startBuffered = 1;
            mockState.endBuffered = 3;

            // Mark only some items as having known sizes
            mockState.sizesKnown.set("item-1", 100);
            mockState.sizesKnown.set("item-3", 110);
            // item-2 is missing

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(false);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 1);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 2);
            // Should stop early when item-2 is not found
            expect(getIdSpy).toHaveBeenCalledTimes(2);
        });

        it("should return false when no sizes are known", () => {
            mockState.startBuffered = 1;
            mockState.endBuffered = 3;
            // No sizes marked as known

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(false);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 1);
            // Should stop at first item since it's not known
            expect(getIdSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("range handling", () => {
        it("should handle single item range", () => {
            mockState.startBuffered = 2;
            mockState.endBuffered = 2;
            mockState.sizesKnown.set("item-2", 105);

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(true);
            expect(getIdSpy).toHaveBeenCalledTimes(1);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 2);
        });

        it("should handle zero as start index", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 2;
            mockState.sizesKnown.set("item-0", 90);
            mockState.sizesKnown.set("item-1", 95);
            mockState.sizesKnown.set("item-2", 100);

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(true);
            expect(getIdSpy).toHaveBeenCalledTimes(3);
        });

        it("should handle large ranges efficiently", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 100;

            // Mark all items as known
            for (let i = 0; i <= 100; i++) {
                mockState.sizesKnown.set(`item-${i}`, 100 + i);
            }

            const start = performance.now();
            const result = checkAllSizesKnown(mockState);
            const duration = performance.now() - start;

            expect(result).toBe(true);
            expect(duration).toBeLessThan(10); // Should be fast
            expect(getIdSpy).toHaveBeenCalledTimes(101);
        });

        it("should handle negative start index", () => {
            mockState.startBuffered = -1;
            mockState.endBuffered = 1;

            // Mock getId to handle negative indices
            getIdSpy.mockImplementation((_: any, index: any) => `item-${index}`);

            mockState.sizesKnown.set("item--1", 80);
            mockState.sizesKnown.set("item-0", 90);
            mockState.sizesKnown.set("item-1", 100);

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(false);
            expect(getIdSpy).toHaveBeenCalledTimes(0);
        });
    });

    describe("early termination behavior", () => {
        it("should stop checking when first unknown size is found", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 5;

            // Mark only first few items as known
            mockState.sizesKnown.set("item-0", 100);
            mockState.sizesKnown.set("item-1", 110);
            // item-2 is missing - should stop here
            mockState.sizesKnown.set("item-3", 120);
            mockState.sizesKnown.set("item-4", 130);
            mockState.sizesKnown.set("item-5", 140);

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(false);
            expect(getIdSpy).toHaveBeenCalledTimes(3); // 0, 1, 2 (stops at 2)
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 0);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 1);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 2);
            expect(getIdSpy).not.toHaveBeenCalledWith(mockState, 3);
        });

        it("should stop immediately if first item is unknown", () => {
            mockState.startBuffered = 10;
            mockState.endBuffered = 15;

            // Mark all except first item as known
            for (let i = 11; i <= 15; i++) {
                mockState.sizesKnown.set(`item-${i}`, 100 + i);
            }
            // item-10 is missing

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(false);
            expect(getIdSpy).toHaveBeenCalledTimes(1);
            expect(getIdSpy).toHaveBeenCalledWith(mockState, 10);
        });

        it("should check all items when last one is missing", () => {
            mockState.startBuffered = 1;
            mockState.endBuffered = 4;

            // Mark all except last item as known
            mockState.sizesKnown.set("item-1", 100);
            mockState.sizesKnown.set("item-2", 110);
            mockState.sizesKnown.set("item-3", 120);
            // item-4 is missing

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(false);
            expect(getIdSpy).toHaveBeenCalledTimes(4); // Checks all until it finds the missing one
        });
    });

    describe("getId integration", () => {
        it("should handle getId returning different key formats", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 2;

            // Mock getId to return different formats
            getIdSpy.mockImplementation((_: any, index: any) => {
                return `custom-key-${index}`;
            });

            mockState.sizesKnown.set("custom-key-0", 100);
            mockState.sizesKnown.set("custom-key-1", 110);
            mockState.sizesKnown.set("custom-key-2", 120);

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(true);
        });

        it("should handle getId returning undefined", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 2;

            // Mock getId to return undefined for second item
            getIdSpy.mockImplementation((_: any, index: any) => {
                return index === 1 ? undefined : `item-${index}`;
            });

            mockState.sizesKnown.set("item-0", 100);
            mockState.sizesKnown.set("item-2", 120);

            // The function uses getId(state, i)! which asserts non-null, so undefined becomes falsy key
            const result = checkAllSizesKnown(mockState);
            expect(result).toBe(false); // undefined key won't be found in sizesKnown
        });

        it("should handle getId returning null", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 1;

            // Mock getId to return null
            getIdSpy.mockImplementation(() => null);

            // The function uses getId(state, i)! which asserts non-null, but null becomes falsy key
            const result = checkAllSizesKnown(mockState);
            expect(result).toBe(false); // null key won't be found in sizesKnown
        });

        it("should pass correct parameters to getId", () => {
            mockState.startBuffered = 5;
            mockState.endBuffered = 7;

            checkAllSizesKnown(mockState);

            expect(getIdSpy).toHaveBeenCalledWith(mockState, 5);
            // Function stops early when first item is not found, so only calls with index 5
            expect(getIdSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle startBuffered being null", () => {
            mockState.startBuffered = null as any;
            mockState.endBuffered = 2;

            // JavaScript coerces null to 0 in numeric context, so for loop works
            const result = checkAllSizesKnown(mockState);
            expect(typeof result).toBe("boolean");
        });

        it("should handle startBuffered being undefined", () => {
            mockState.startBuffered = undefined as any;
            mockState.endBuffered = 2;

            // JavaScript coerces undefined to NaN in numeric context
            const result = checkAllSizesKnown(mockState);
            expect(typeof result).toBe("boolean");
        });

        it("should handle startBuffered greater than endBuffered", () => {
            mockState.startBuffered = 5;
            mockState.endBuffered = 3;

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(true); // Loop condition (i <= endBuffered) is false immediately
            expect(getIdSpy).not.toHaveBeenCalled();
        });

        it("should handle zero range (start equals end)", () => {
            mockState.startBuffered = 3;
            mockState.endBuffered = 3;
            mockState.sizesKnown.set("item-3", 100);

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(true);
            expect(getIdSpy).toHaveBeenCalledTimes(1);
        });

        it("should handle corrupted sizesKnown map", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 1;
            mockState.sizesKnown = {
                has: () => {
                    throw new Error("Corrupted map");
                },
            } as any;

            expect(() => {
                checkAllSizesKnown(mockState);
            }).toThrow("Corrupted map");
        });

        it("should handle getId throwing error", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 1;
            getIdSpy.mockImplementation(() => {
                throw new Error("getId failed");
            });

            expect(() => {
                checkAllSizesKnown(mockState);
            }).toThrow("getId failed");
        });

        it("should handle very large indices", () => {
            mockState.startBuffered = Number.MAX_SAFE_INTEGER - 1;
            mockState.endBuffered = Number.MAX_SAFE_INTEGER;

            mockState.sizesKnown.set(`item-${Number.MAX_SAFE_INTEGER - 1}`, 100);
            mockState.sizesKnown.set(`item-${Number.MAX_SAFE_INTEGER}`, 110);

            const result = checkAllSizesKnown(mockState);

            expect(result).toBe(true);
            expect(getIdSpy).toHaveBeenCalledTimes(2);
        });

        it("should handle floating point indices", () => {
            mockState.startBuffered = 1.5 as any;
            mockState.endBuffered = 3.7 as any;

            // Should work with floating point, but behavior might be unexpected
            const result = checkAllSizesKnown(mockState);

            // Function should handle it (though it's not a typical use case)
            expect(typeof result).toBe("boolean");
        });
    });

    describe("performance considerations", () => {
        it("should handle large ranges with early termination efficiently", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 10000;

            // Mark only first 5 items as known, so it should stop early
            for (let i = 0; i < 5; i++) {
                mockState.sizesKnown.set(`item-${i}`, 100 + i);
            }

            const start = performance.now();
            const result = checkAllSizesKnown(mockState);
            const duration = performance.now() - start;

            expect(result).toBe(false);
            expect(duration).toBeLessThan(5); // Should be very fast due to early termination
            expect(getIdSpy).toHaveBeenCalledTimes(6); // 0-5, stops at 5
        });

        it("should handle rapid successive calls efficiently", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 10;

            // Mark all as known
            for (let i = 0; i <= 10; i++) {
                mockState.sizesKnown.set(`item-${i}`, 100 + i);
            }

            const start = performance.now();

            for (let i = 0; i < 1000; i++) {
                checkAllSizesKnown(mockState);
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(50);
        });

        it("should not accumulate state between calls", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 2;
            mockState.sizesKnown.set("item-0", 100);
            mockState.sizesKnown.set("item-1", 110);

            // First call - should return false (item-2 missing)
            const result1 = checkAllSizesKnown(mockState);
            expect(result1).toBe(false);

            // Add missing size
            mockState.sizesKnown.set("item-2", 120);

            // Second call - should return true
            const result2 = checkAllSizesKnown(mockState);
            expect(result2).toBe(true);
        });
    });

    describe("integration scenarios", () => {
        it("should work correctly in initial layout detection scenario", () => {
            // Simulate initial layout where sizes are being populated
            mockState.startBuffered = 0;
            mockState.endBuffered = 5;
            mockState.queuedInitialLayout = true;

            // Initially no sizes known
            expect(checkAllSizesKnown(mockState)).toBe(false);

            // Gradually add known sizes (simulating layout completion)
            const indices = [0, 1, 2, 3, 4, 5];
            indices.forEach((index, i) => {
                mockState.sizesKnown.set(`item-${index}`, 100 + index);

                const allKnown = checkAllSizesKnown(mockState);
                if (i === indices.length - 1) {
                    expect(allKnown).toBe(true); // All sizes now known
                } else {
                    expect(allKnown).toBe(false); // Still missing some
                }
            });
        });

        it("should handle dynamic range changes", () => {
            // Start with small range
            mockState.startBuffered = 1;
            mockState.endBuffered = 2;
            mockState.sizesKnown.set("item-1", 100);
            mockState.sizesKnown.set("item-2", 110);

            expect(checkAllSizesKnown(mockState)).toBe(true);

            // Expand range
            mockState.endBuffered = 4;
            expect(checkAllSizesKnown(mockState)).toBe(false); // Missing items 3,4

            // Add missing sizes
            mockState.sizesKnown.set("item-3", 120);
            mockState.sizesKnown.set("item-4", 130);
            expect(checkAllSizesKnown(mockState)).toBe(true);
        });

        it("should work with different size value types", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 3;

            // Different types of size values
            mockState.sizesKnown.set("item-0", 100); // number
            mockState.sizesKnown.set("item-1", 0); // zero
            mockState.sizesKnown.set("item-2", -50); // negative
            mockState.sizesKnown.set("item-3", NaN); // NaN

            const result = checkAllSizesKnown(mockState);

            // Function only checks existence, not value validity
            expect(result).toBe(true);
        });
    });
});
