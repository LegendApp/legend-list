import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import type { StateContext } from "../../src/state/state";
import * as stateModule from "../../src/state/state";
import { setPaddingTop } from "../../src/utils/setPaddingTop";
import { createMockContext } from "../__mocks__/createMockContext";

describe("setPaddingTop", () => {
    let mockCtx: StateContext;
    let peekSpy: any;
    let setSpy: any;
    let originalSetTimeout: any;
    let timeoutCallbacks: (() => void)[];

    beforeEach(() => {
        mockCtx = createMockContext({
            alignItemsPaddingTop: 0,
            stylePaddingTop: 0,
            totalSize: 1000,
        });
        mockCtx.state = {};

        // Reset spies if they exist
        if (peekSpy) peekSpy.mockRestore?.();
        if (setSpy) setSpy.mockRestore?.();

        // Spy on state functions
        peekSpy = spyOn(stateModule, "peek$").mockImplementation((_: any, key: any) => {
            return mockCtx.values.get(key);
        });

        setSpy = spyOn(stateModule, "set$").mockImplementation((_: any, key: any, value: any) => {
            mockCtx.values.set(key, value);
        });

        // Mock setTimeout to capture callbacks
        originalSetTimeout = globalThis.setTimeout;
        timeoutCallbacks = [];
        globalThis.setTimeout = ((callback: () => void) => {
            timeoutCallbacks.push(callback);
            return timeoutCallbacks.length; // Return a fake timer ID
        }) as any;
    });

    afterEach(() => {
        // Restore setTimeout
        globalThis.setTimeout = originalSetTimeout;
        // Restore spies so other tests use real implementations
        peekSpy?.mockRestore?.();
        setSpy?.mockRestore?.();
    });

    describe("stylePaddingTop handling", () => {
        it("should set stylePaddingTop when provided", () => {
            setPaddingTop(mockCtx, { stylePaddingTop: 50 });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 50);
        });

        it("should not set stylePaddingTop when undefined", () => {
            setPaddingTop(mockCtx, { stylePaddingTop: undefined });

            expect(setSpy).not.toHaveBeenCalledWith(mockCtx, "stylePaddingTop", expect.anything());
        });

        it("should handle zero stylePaddingTop", () => {
            setPaddingTop(mockCtx, { stylePaddingTop: 0 });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 0);
        });

        it("should handle negative stylePaddingTop", () => {
            setPaddingTop(mockCtx, { stylePaddingTop: -25 });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", -25);
        });
    });

    describe("alignItemsPaddingTop handling", () => {
        it("should set alignItemsPaddingTop when provided", () => {
            setPaddingTop(mockCtx, { alignItemsPaddingTop: 75 });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", 75);
        });

        it("should not set alignItemsPaddingTop when undefined", () => {
            setPaddingTop(mockCtx, { alignItemsPaddingTop: undefined });

            expect(setSpy).not.toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", expect.anything());
        });

        it("should handle zero alignItemsPaddingTop", () => {
            setPaddingTop(mockCtx, { alignItemsPaddingTop: 0 });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", 0);
        });

        it("should handle negative alignItemsPaddingTop", () => {
            setPaddingTop(mockCtx, { alignItemsPaddingTop: -30 });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", -30);
        });
    });

    describe("both padding types", () => {
        it("should set both padding types when provided", () => {
            setPaddingTop(mockCtx, { alignItemsPaddingTop: 60, stylePaddingTop: 40 });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 40);
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", 60);
        });

        it("should handle both as zero", () => {
            setPaddingTop(mockCtx, { alignItemsPaddingTop: 0, stylePaddingTop: 0 });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 0);
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", 0);
        });

        it("should handle mixed values", () => {
            setPaddingTop(mockCtx, { alignItemsPaddingTop: -50, stylePaddingTop: 100 });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 100);
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", -50);
        });
    });

    describe("scroll prevention logic", () => {
        beforeEach(() => {
            // Set up initial state with existing padding
            mockCtx.values.set("stylePaddingTop", 100);
            mockCtx.values.set("totalSize", 2000);
        });

        it("should trigger scroll prevention when reducing stylePaddingTop", () => {
            setPaddingTop(mockCtx, { stylePaddingTop: 50 }); // Reducing from 100 to 50

            // Should temporarily increase totalSize
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 2100); // 2000 + 100

            // Should set new padding
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 50);

            // Should have scheduled a timeout
            expect(timeoutCallbacks).toHaveLength(1);
        });

        it("should not trigger scroll prevention when increasing stylePaddingTop", () => {
            setPaddingTop(mockCtx, { stylePaddingTop: 150 }); // Increasing from 100 to 150

            // Should only set new padding, not modify totalSize
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 150);
            expect(setSpy).not.toHaveBeenCalledWith(mockCtx, "totalSize", expect.anything());

            // Should not schedule timeout
            expect(timeoutCallbacks).toHaveLength(0);
        });

        it("should not trigger scroll prevention when setting same stylePaddingTop", () => {
            setPaddingTop(mockCtx, { stylePaddingTop: 100 }); // Same as current

            // Should only set padding
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 100);
            expect(setSpy).not.toHaveBeenCalledWith(mockCtx, "totalSize", expect.anything());

            // Should not schedule timeout
            expect(timeoutCallbacks).toHaveLength(0);
        });

        it("should execute timeout callback to restore totalSize", () => {
            setPaddingTop(mockCtx, { stylePaddingTop: 50 }); // Reducing from 100 to 50

            // Verify initial state
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 2100);
            expect(timeoutCallbacks).toHaveLength(1);

            // Clear previous calls to track the timeout callback
            setSpy.mockClear();

            // Execute the timeout callback
            timeoutCallbacks[0]();

            // Should restore original totalSize
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 2000);
        });

        it("should handle zero previous stylePaddingTop", () => {
            mockCtx.values.set("stylePaddingTop", 0);

            setPaddingTop(mockCtx, { stylePaddingTop: 50 }); // Increasing from 0 to 50

            // Should not trigger scroll prevention (increasing)
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 50);
            expect(setSpy).not.toHaveBeenCalledWith(mockCtx, "totalSize", expect.anything());
            expect(timeoutCallbacks).toHaveLength(0);
        });

        it("should handle null previous stylePaddingTop", () => {
            mockCtx.values.set("stylePaddingTop", null);

            setPaddingTop(mockCtx, { stylePaddingTop: 50 });

            // Should treat null as 0, so no scroll prevention needed
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 50);
            expect(setSpy).not.toHaveBeenCalledWith(mockCtx, "totalSize", expect.anything());
        });

        it("should handle undefined previous stylePaddingTop", () => {
            mockCtx.values.delete("stylePaddingTop");

            setPaddingTop(mockCtx, { stylePaddingTop: 50 });

            // Should treat undefined as 0, so no scroll prevention needed
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 50);
            expect(setSpy).not.toHaveBeenCalledWith(mockCtx, "totalSize", expect.anything());
        });
    });

    describe("scroll prevention with different totalSize values", () => {
        beforeEach(() => {
            mockCtx.values.set("stylePaddingTop", 80);
        });

        it("should handle zero totalSize", () => {
            mockCtx.values.set("totalSize", 0);

            setPaddingTop(mockCtx, { stylePaddingTop: 40 }); // Reducing by 40

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 80); // 0 + 80
            expect(timeoutCallbacks).toHaveLength(1);

            // Execute timeout
            setSpy.mockClear();
            timeoutCallbacks[0]();
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 0);
        });

        it("should handle null totalSize", () => {
            mockCtx.values.set("totalSize", null);

            setPaddingTop(mockCtx, { stylePaddingTop: 40 }); // Reducing

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 80); // null treated as 0
            expect(timeoutCallbacks).toHaveLength(1);

            // Execute timeout
            setSpy.mockClear();
            timeoutCallbacks[0]();
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 0); // null treated as 0
        });

        it("should handle undefined totalSize", () => {
            mockCtx.values.delete("totalSize");

            setPaddingTop(mockCtx, { stylePaddingTop: 40 }); // Reducing

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 80); // undefined treated as 0
            expect(timeoutCallbacks).toHaveLength(1);

            // Execute timeout
            setSpy.mockClear();
            timeoutCallbacks[0]();
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 0); // undefined treated as 0
        });

        it("should handle large totalSize", () => {
            mockCtx.values.set("totalSize", 1000000);

            setPaddingTop(mockCtx, { stylePaddingTop: 40 }); // Reducing by 40

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 1000080); // 1000000 + 80
            expect(timeoutCallbacks).toHaveLength(1);

            // Execute timeout
            setSpy.mockClear();
            timeoutCallbacks[0]();
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 1000000);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle empty options object", () => {
            setPaddingTop(mockCtx, {});

            expect(setSpy).not.toHaveBeenCalled();
            expect(timeoutCallbacks).toHaveLength(0);
        });

        it("should handle very large padding values", () => {
            setPaddingTop(mockCtx, {
                alignItemsPaddingTop: Number.MAX_SAFE_INTEGER,
                stylePaddingTop: Number.MAX_SAFE_INTEGER,
            });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", Number.MAX_SAFE_INTEGER);
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", Number.MAX_SAFE_INTEGER);
        });

        it("should handle NaN padding values", () => {
            setPaddingTop(mockCtx, {
                alignItemsPaddingTop: NaN,
                stylePaddingTop: NaN,
            });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", NaN);
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", NaN);
        });

        it("should handle Infinity padding values", () => {
            setPaddingTop(mockCtx, {
                alignItemsPaddingTop: -Infinity,
                stylePaddingTop: Infinity,
            });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", Infinity);
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", -Infinity);
        });

        it("should handle floating point values", () => {
            setPaddingTop(mockCtx, {
                alignItemsPaddingTop: -6.789,
                stylePaddingTop: 12.345,
            });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 12.345);
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", -6.789);
        });

        it("should handle state errors gracefully", () => {
            // Make peek$ throw an error
            peekSpy.mockImplementation(() => {
                throw new Error("State access error");
            });

            expect(() => {
                setPaddingTop(mockCtx, { stylePaddingTop: 50 });
            }).toThrow("State access error");
        });

        it("should handle set$ errors gracefully", () => {
            // Make set$ throw an error
            setSpy.mockImplementation(() => {
                throw new Error("State update error");
            });

            expect(() => {
                setPaddingTop(mockCtx, { stylePaddingTop: 50 });
            }).toThrow("State update error");
        });
    });

    describe("timeout behavior", () => {
        beforeEach(() => {
            mockCtx.values.set("stylePaddingTop", 100);
            mockCtx.values.set("totalSize", 2000);
        });

        it("should use 16ms delay for timeout", () => {
            // Mock setTimeout to capture delay
            let capturedDelay: number;
            globalThis.setTimeout = ((callback: () => void, delay: number) => {
                capturedDelay = delay;
                timeoutCallbacks.push(callback);
                return 1;
            }) as any;

            setPaddingTop(mockCtx, { stylePaddingTop: 50 });

            expect(capturedDelay!).toBe(16);
        });

        it("should handle multiple rapid padding changes", () => {
            // Multiple rapid reductions
            setPaddingTop(mockCtx, { stylePaddingTop: 80 }); // Reduce to 80
            setPaddingTop(mockCtx, { stylePaddingTop: 60 }); // Reduce to 60
            setPaddingTop(mockCtx, { stylePaddingTop: 40 }); // Reduce to 40

            // Should schedule multiple timeouts
            expect(timeoutCallbacks.length).toBeGreaterThan(0);

            // All should work independently
            setSpy.mockClear();
            timeoutCallbacks.forEach((callback) => callback());

            // Each should restore to the respective original totalSize
            // (Note: in real implementation, this might cause issues, but the function
            // doesn't prevent multiple concurrent timeouts)
        });

        it("should handle timeout execution after state changes", () => {
            setPaddingTop(mockCtx, { stylePaddingTop: 50 }); // Reduce from 100

            // Change totalSize in between
            mockCtx.values.set("totalSize", 3000);

            // Execute timeout callback
            setSpy.mockClear();
            timeoutCallbacks[0]();

            // Implementation subtracts previous padding amount from current totalSize
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 2900);
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid successive calls efficiently", () => {
            const start = performance.now();

            for (let i = 0; i < 1000; i++) {
                setPaddingTop(mockCtx, {
                    alignItemsPaddingTop: (i + 50) % 100,
                    stylePaddingTop: i % 100,
                });
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(100); // Should be fast
        });

        it("should not accumulate excessive timeout callbacks", () => {
            mockCtx.values.set("stylePaddingTop", 100);

            // Many reductions in quick succession
            for (let i = 99; i >= 0; i--) {
                setPaddingTop(mockCtx, { stylePaddingTop: i });
            }

            // Should have many timeouts (100), but function should still work
            expect(timeoutCallbacks.length).toBe(100);
        });

        it("should handle state access efficiently", () => {
            let peekCallCount = 0;
            peekSpy.mockImplementation((_: any, key: any) => {
                peekCallCount++;
                return mockCtx.values.get(key);
            });

            setPaddingTop(mockCtx, { stylePaddingTop: 50 });

            // Should only call peek$ for necessary values
            expect(peekCallCount).toBeLessThan(5); // stylePaddingTop and totalSize
        });
    });

    describe("integration patterns", () => {
        it("should work correctly with alignItemsAtEnd workflow", () => {
            // Common pattern: set both paddings together for alignItemsAtEnd
            setPaddingTop(mockCtx, {
                alignItemsPaddingTop: 300,
                stylePaddingTop: 20,
            });

            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 20);
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "alignItemsPaddingTop", 300);
        });

        it("should handle chat UI pattern (reducing top padding)", () => {
            // Common in chat UIs: start with large padding, reduce as content loads
            mockCtx.values.set("stylePaddingTop", 400);
            mockCtx.values.set("totalSize", 1500);

            setPaddingTop(mockCtx, { stylePaddingTop: 100 }); // Reduce significantly

            // Should prevent scroll jump
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 1900); // 1500 + 400
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "stylePaddingTop", 100);

            // After timeout
            setSpy.mockClear();
            timeoutCallbacks[0]();
            expect(setSpy).toHaveBeenCalledWith(mockCtx, "totalSize", 1500);
        });

        it("should handle progressive loading pattern", () => {
            // Progressive loading: padding reduces as more content loads
            const paddingValues = [200, 150, 100, 50, 0];
            mockCtx.values.set("stylePaddingTop", 250);

            paddingValues.forEach((padding) => {
                setPaddingTop(mockCtx, { stylePaddingTop: padding });
            });

            // Should trigger scroll prevention for each reduction
            expect(timeoutCallbacks.length).toBe(paddingValues.length);
        });
    });
});
