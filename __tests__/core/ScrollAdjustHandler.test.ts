import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("ScrollAdjustHandler", () => {
    let mockCtx: StateContext;
    let handler: ScrollAdjustHandler;

    beforeEach(() => {
        mockCtx = createMockContext({
            scrollAdjust: 0,
        });

        handler = new ScrollAdjustHandler(mockCtx);
    });

    describe("constructor", () => {
        it("should initialize with provided context", () => {
            expect(handler).toBeInstanceOf(ScrollAdjustHandler);
            expect((handler as any).context).toBe(mockCtx);
        });

        it("should initialize with default state", () => {
            expect((handler as any).appliedAdjust).toBe(0);
            expect((handler as any).mounted).toBe(false);
        });
    });

    describe("requestAdjust", () => {
        it("should calculate adjustment from context scrollAdjust", () => {
            handler.requestAdjust(10);
            expect((handler as any).appliedAdjust).toBe(10); // 10 + 0 (initial context value)

            // Simulate the context being updated (as would happen when set is called)
            mockCtx.values.set("scrollAdjust", 10);

            handler.requestAdjust(5);
            expect((handler as any).appliedAdjust).toBe(15); // 5 + 10 (context value)

            // Update context again
            mockCtx.values.set("scrollAdjust", 15);

            handler.requestAdjust(-3);
            expect((handler as any).appliedAdjust).toBe(12); // -3 + 15 (context value)
        });

        it("should set immediately regardless of mounted state", () => {
            handler.requestAdjust(10);
            expect(mockCtx.values.get("scrollAdjust")).toBe(10);

            handler.setMounted();
            handler.requestAdjust(5);
            expect(mockCtx.values.get("scrollAdjust")).toBe(15);
        });

        it("should accumulate adjustments across calls", () => {
            handler.requestAdjust(5);
            handler.requestAdjust(10);
            expect((handler as any).appliedAdjust).toBe(15);
            expect(mockCtx.values.get("scrollAdjust")).toBe(15);
        });

        it("should handle zero adjustments", () => {
            handler.requestAdjust(0);
            expect((handler as any).appliedAdjust).toBe(0);
            expect(mockCtx.values.get("scrollAdjust")).toBe(0);
        });

        it("should handle negative adjustments", () => {
            handler.requestAdjust(-25);
            expect((handler as any).appliedAdjust).toBe(-25);
            expect(mockCtx.values.get("scrollAdjust")).toBe(-25);
        });

        it("should handle multiple rapid adjustments", () => {
            handler.requestAdjust(5);
            handler.requestAdjust(3);
            handler.requestAdjust(2);

            expect((handler as any).appliedAdjust).toBe(10);
            expect(mockCtx.values.get("scrollAdjust")).toBe(10);
        });
    });

    describe("setMounted", () => {
        it("should change mounted state", () => {
            expect((handler as any).mounted).toBe(false);

            handler.setMounted();
            expect((handler as any).mounted).toBe(true);
        });

        it("should be idempotent", () => {
            handler.setMounted();
            handler.setMounted();
            handler.setMounted();

            expect((handler as any).mounted).toBe(true);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle undefined scrollAdjust in context", () => {
            mockCtx.values.delete("scrollAdjust");

            handler.requestAdjust(10);
            expect((handler as any).appliedAdjust).toBe(10);
            expect(mockCtx.values.get("scrollAdjust")).toBe(10);
        });

        it("should handle null scrollAdjust in context", () => {
            mockCtx.values.set("scrollAdjust", null);

            handler.requestAdjust(10);
            expect((handler as any).appliedAdjust).toBe(10);
            expect(mockCtx.values.get("scrollAdjust")).toBe(10);
        });

        it("should handle very large adjustment values", () => {
            const largeValue = Number.MAX_SAFE_INTEGER;

            handler.requestAdjust(largeValue);
            expect((handler as any).appliedAdjust).toBe(largeValue);
            expect(mockCtx.values.get("scrollAdjust")).toBe(largeValue);
        });

        it("should handle very small adjustment values", () => {
            const smallValue = Number.MIN_SAFE_INTEGER;

            handler.requestAdjust(smallValue);
            expect((handler as any).appliedAdjust).toBe(smallValue);
            expect(mockCtx.values.get("scrollAdjust")).toBe(smallValue);
        });

        it("should handle NaN adjustment values", () => {
            handler.requestAdjust(NaN);
            expect(Number.isNaN((handler as any).appliedAdjust)).toBe(true);
            expect(Number.isNaN(mockCtx.values.get("scrollAdjust"))).toBe(true);
        });

        it("should handle Infinity adjustment values", () => {
            handler.requestAdjust(Infinity);
            expect((handler as any).appliedAdjust).toBe(Infinity);
            expect(mockCtx.values.get("scrollAdjust")).toBe(Infinity);

            handler.requestAdjust(-Infinity);
            expect((handler as any).appliedAdjust).toBe(NaN); // Infinity + (-Infinity) = NaN
            expect(Number.isNaN(mockCtx.values.get("scrollAdjust"))).toBe(true);
        });

        it("should handle floating point precision", () => {
            handler.requestAdjust(0.1);
            expect((handler as any).appliedAdjust).toBe(0.1);

            // Update context to simulate the set
            mockCtx.values.set("scrollAdjust", 0.1);

            handler.requestAdjust(0.2);

            // Check that the result is approximately correct
            const result = (handler as any).appliedAdjust;
            expect(Math.abs(result - 0.3)).toBeLessThan(Number.EPSILON);
        });
    });

    describe("integration scenarios", () => {
        it("should handle state transitions from unmounted to mounted", () => {
            handler.requestAdjust(5);
            expect(mockCtx.values.get("scrollAdjust")).toBe(5);

            handler.setMounted();
            handler.requestAdjust(3);
            expect(mockCtx.values.get("scrollAdjust")).toBe(8);
        });

        it("should handle complex adjustment sequences", () => {
            // Mixed positive and negative adjustments - simulate proper sequence with context updates
            const adjustments = [10, -5, 15, -8, 3, -2];

            let contextValue = 0;
            for (const adjustment of adjustments) {
                handler.requestAdjust(adjustment);
                const expectedApplied = adjustment + contextValue;
                expect((handler as any).appliedAdjust).toBe(expectedApplied);

                // Simulate the context being updated
                contextValue = expectedApplied;
                mockCtx.values.set("scrollAdjust", contextValue);
            }

            // Final context value should be the sum of all adjustments
            const expectedTotal = adjustments.reduce((sum, val) => sum + val, 0);
            expect(mockCtx.values.get("scrollAdjust")).toBe(expectedTotal);
        });

        it("should maintain correct state across multiple handlers", () => {
            const handler2 = new ScrollAdjustHandler(mockCtx);

            handler.requestAdjust(10);
            handler2.requestAdjust(5);

            // Both should see the same context but maintain separate applied adjust values
            expect((handler as any).appliedAdjust).toBe(10);
            expect((handler2 as any).appliedAdjust).toBe(5);
            expect(mockCtx.values.get("scrollAdjust")).toBe(5);
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid adjustments efficiently", () => {
            const iterations = 1000;

            for (let i = 0; i < iterations; i++) {
                handler.requestAdjust(1);
            }

            expect((handler as any).appliedAdjust).toBe(iterations);
            expect(mockCtx.values.get("scrollAdjust")).toBe(iterations);
        });

        it("should not create memory leaks with many adjustments", () => {
            // Test that the handler doesn't accumulate internal state inappropriately
            for (let i = 0; i < 10000; i++) {
                handler.requestAdjust(0.1);
            }

            const expectedTotal = 0.1 * 10000;
            expect((handler as any).appliedAdjust).toBeCloseTo(expectedTotal, 5);
            expect(mockCtx.values.get("scrollAdjust")).toBeCloseTo(expectedTotal, 5);
        });
    });

    describe("boundary conditions", () => {
        it("should handle adjustment with pre-existing context state", () => {
            handler.requestAdjust(100);

            handler.requestAdjust(25);
            expect((handler as any).appliedAdjust).toBe(125);

            expect(mockCtx.values.get("scrollAdjust")).toBe(125);
        });

        it("should handle zero pre-existing state", () => {
            handler.requestAdjust(25);
            expect((handler as any).appliedAdjust).toBe(25);

            expect(mockCtx.values.get("scrollAdjust")).toBe(25);
        });

        it("should handle negative pre-existing state", () => {
            handler.requestAdjust(-50);

            handler.requestAdjust(25);
            expect((handler as any).appliedAdjust).toBe(-25);

            expect(mockCtx.values.get("scrollAdjust")).toBe(-25);
        });
    });

    describe("real-world usage patterns", () => {
        it("should handle typical MVCP adjustment pattern", () => {
            // Typical pattern: unmounted initialization, then mounting, then adjustments
            handler.requestAdjust(50);
            expect(mockCtx.values.get("scrollAdjust")).toBe(50);

            // Runtime adjustments (immediate)
            handler.requestAdjust(10);
            expect(mockCtx.values.get("scrollAdjust")).toBe(60);

            handler.requestAdjust(-5);
            expect(mockCtx.values.get("scrollAdjust")).toBe(55);
        });

        it("should handle chat interface scroll adjustment pattern", () => {
            handler.setMounted(); // Chat interfaces are typically mounted immediately

            // Simulate new messages causing adjustments
            const messageAdjustments = [15, 20, 8, 12, 25];
            let expectedTotal = 0;

            for (const adjustment of messageAdjustments) {
                expectedTotal += adjustment;
                handler.requestAdjust(adjustment);
                expect(mockCtx.values.get("scrollAdjust")).toBe(expectedTotal);
            }
        });
    });
});
