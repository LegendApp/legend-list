import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import type { StateContext } from "../../src/state/state";
import * as stateModule from "../../src/state/state";
import type { InternalState } from "../../src/types";
import * as setPaddingTopModule from "../../src/utils/setPaddingTop";
import { updateAlignItemsPaddingTop } from "../../src/utils/updateAlignItemsPaddingTop";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateAlignItemsPaddingTop", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let setPaddingTopSpy: ReturnType<typeof mock>;
    let getContentSizeSpy: ReturnType<typeof mock>;

    beforeEach(() => {
        setPaddingTopSpy = mock();
        getContentSizeSpy = mock(() => 300); // Default content size

        // Mock setPaddingTop using spyOn
        spyOn(setPaddingTopModule, "setPaddingTop").mockImplementation(setPaddingTopSpy);

        // Mock getContentSize using spyOn
        spyOn(stateModule, "getContentSize").mockImplementation(getContentSizeSpy);

        // Create mock context
        mockCtx = createMockContext();

        // Create mock state
        mockState = {
            props: {
                alignItemsAtEnd: true,
                data: [
                    { id: "item1", name: "First" },
                    { id: "item2", name: "Second" },
                    { id: "item3", name: "Third" },
                ],
            },
            scrollLength: 400, // Viewport height
        } as any;
        mockCtx.state = mockState;
    });

    describe("basic functionality", () => {
        it("should calculate and set alignItemsPaddingTop when alignItemsAtEnd is true", () => {
            getContentSizeSpy.mockReturnValue(250); // Content smaller than viewport

            updateAlignItemsPaddingTop(mockCtx);

            expect(getContentSizeSpy).toHaveBeenCalledWith(mockCtx);
            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 150, // Math.floor(400 - 250)
            });
        });

        it("should set alignItemsPaddingTop to 0 when content is larger than viewport", () => {
            getContentSizeSpy.mockReturnValue(500); // Content larger than viewport

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0, // Math.max(0, Math.floor(400 - 500))
            });
        });

        it("should handle exact viewport size content", () => {
            getContentSizeSpy.mockReturnValue(400); // Exact viewport size

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0, // Math.floor(400 - 400)
            });
        });

        it("should floor the calculated padding value", () => {
            getContentSizeSpy.mockReturnValue(250.7); // Fractional content size

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 149, // Math.floor(400 - 250.7)
            });
        });
    });

    describe("alignItemsAtEnd condition", () => {
        it("should not call setPaddingTop when alignItemsAtEnd is false", () => {
            mockState.props.alignItemsAtEnd = false;

            updateAlignItemsPaddingTop(mockCtx);

            expect(getContentSizeSpy).not.toHaveBeenCalled();
            expect(setPaddingTopSpy).not.toHaveBeenCalled();
        });

        it("should not call setPaddingTop when alignItemsAtEnd is undefined", () => {
            mockState.props.alignItemsAtEnd = undefined as any;

            updateAlignItemsPaddingTop(mockCtx);

            expect(getContentSizeSpy).not.toHaveBeenCalled();
            expect(setPaddingTopSpy).not.toHaveBeenCalled();
        });

        it("should handle alignItemsAtEnd as truthy values", () => {
            const truthyValues = [true, 1, "yes", {}, []];

            truthyValues.forEach((value) => {
                setPaddingTopSpy.mockClear();
                getContentSizeSpy.mockClear();

                mockState.props.alignItemsAtEnd = value as any;
                getContentSizeSpy.mockReturnValue(200);

                updateAlignItemsPaddingTop(mockCtx);

                expect(getContentSizeSpy).toHaveBeenCalledTimes(1);
                expect(setPaddingTopSpy).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("data handling", () => {
        it("should set alignItemsPaddingTop to 0 when data is empty", () => {
            mockState.props.data = [];

            updateAlignItemsPaddingTop(mockCtx);

            expect(getContentSizeSpy).not.toHaveBeenCalled();
            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0,
            });
        });

        it("should set alignItemsPaddingTop to 0 when data is null", () => {
            mockState.props.data = null as any;

            updateAlignItemsPaddingTop(mockCtx);

            expect(getContentSizeSpy).not.toHaveBeenCalled();
            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0,
            });
        });

        it("should set alignItemsPaddingTop to 0 when data is undefined", () => {
            mockState.props.data = undefined as any;

            updateAlignItemsPaddingTop(mockCtx);

            expect(getContentSizeSpy).not.toHaveBeenCalled();
            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0,
            });
        });

        it("should process data with single item", () => {
            mockState.props.data = [{ id: "only" }];
            getContentSizeSpy.mockReturnValue(80);

            updateAlignItemsPaddingTop(mockCtx);

            expect(getContentSizeSpy).toHaveBeenCalledWith(mockCtx);
            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 320, // Math.floor(400 - 80)
            });
        });

        it("should handle large datasets", () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
            mockState.props.data = largeData;
            getContentSizeSpy.mockReturnValue(100000); // Very large content

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0, // Math.max(0, negative value)
            });
        });
    });

    describe("scrollLength variations", () => {
        it("should handle zero scrollLength", () => {
            mockState.scrollLength = 0;
            getContentSizeSpy.mockReturnValue(100);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0, // Math.max(0, Math.floor(0 - 100))
            });
        });

        it("should handle negative scrollLength", () => {
            mockState.scrollLength = -100;
            getContentSizeSpy.mockReturnValue(50);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0, // Math.max(0, Math.floor(-100 - 50))
            });
        });

        it("should handle very large scrollLength", () => {
            mockState.scrollLength = 10000;
            getContentSizeSpy.mockReturnValue(200);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 9800, // Math.floor(10000 - 200)
            });
        });

        it("should handle floating point scrollLength", () => {
            mockState.scrollLength = 456.789;
            getContentSizeSpy.mockReturnValue(123.456);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 333, // Math.floor(456.789 - 123.456)
            });
        });
    });

    describe("getContentSize integration", () => {
        it("should pass context to getContentSize", () => {
            updateAlignItemsPaddingTop(mockCtx);

            expect(getContentSizeSpy).toHaveBeenCalledWith(mockCtx);
        });

        it("should handle getContentSize returning zero", () => {
            getContentSizeSpy.mockReturnValue(0);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 400, // Full viewport height
            });
        });

        it("should handle getContentSize returning negative value", () => {
            getContentSizeSpy.mockReturnValue(-50);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 450, // Math.floor(400 - (-50))
            });
        });

        it("should handle getContentSize throwing error", () => {
            getContentSizeSpy.mockImplementation(() => {
                throw new Error("Content size calculation failed");
            });

            expect(() => {
                updateAlignItemsPaddingTop(mockCtx);
            }).toThrow("Content size calculation failed");
        });

        it("should handle getContentSize returning NaN", () => {
            getContentSizeSpy.mockReturnValue(NaN);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: NaN, // Math.max(0, Math.floor(400 - NaN)) = Math.max(0, NaN) = NaN
            });
        });

        it("should handle getContentSize returning Infinity", () => {
            getContentSizeSpy.mockReturnValue(Infinity);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0, // Math.max(0, Math.floor(400 - Infinity))
            });
        });
    });

    describe("setPaddingTop integration", () => {
        it("should call setPaddingTop with correct parameters", () => {
            getContentSizeSpy.mockReturnValue(150);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 250,
            });
            expect(setPaddingTopSpy).toHaveBeenCalledTimes(1);
        });

        it("should handle setPaddingTop throwing error", () => {
            setPaddingTopSpy.mockImplementation(() => {
                throw new Error("setPaddingTop failed");
            });

            expect(() => {
                updateAlignItemsPaddingTop(mockCtx);
            }).toThrow("setPaddingTop failed");
        });

        it("should call setPaddingTop even when calculated padding is 0", () => {
            getContentSizeSpy.mockReturnValue(500); // Larger than viewport

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0,
            });
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle null state", () => {
            mockCtx.state = null as any;
            expect(() => {
                updateAlignItemsPaddingTop(mockCtx);
            }).toThrow();
        });

        it("should handle null context", () => {
            // Function handles null context gracefully - getContentSize or setPaddingTop may handle null
            expect(() => {
                updateAlignItemsPaddingTop(null as any);
            }).toThrow();
        });

        it("should handle corrupted state props", () => {
            mockState.props = null as any;

            expect(() => {
                updateAlignItemsPaddingTop(mockCtx);
            }).toThrow();
        });

        it("should handle missing scrollLength", () => {
            mockState.scrollLength = undefined as any;

            expect(() => {
                updateAlignItemsPaddingTop(mockCtx);
            }).not.toThrow();
        });

        it("should handle corrupted state structure", () => {
            mockState = {} as any; // Empty state
            mockCtx.state = mockState;

            expect(() => {
                updateAlignItemsPaddingTop(mockCtx);
            }).toThrow();
        });
    });

    describe("performance", () => {
        it("should handle rapid consecutive calls efficiently", () => {
            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                setPaddingTopSpy.mockClear();
                getContentSizeSpy.mockClear();
                getContentSizeSpy.mockReturnValue(200 + (i % 100));

                updateAlignItemsPaddingTop(mockCtx);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100); // Should be very fast
        });

        it("should not cause memory issues with large data", () => {
            // Test with very large dataset
            mockState.props.data = Array.from({ length: 100000 }, (_, i) => ({ id: i }));

            const start = Date.now();
            updateAlignItemsPaddingTop(mockCtx);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(50);
            expect(getContentSizeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("real world scenarios", () => {
        it("should handle chat interface with few messages", () => {
            // Chat with only 2 messages, should align to bottom with padding
            mockState.props.data = [
                { id: "msg1", text: "Hello" },
                { id: "msg2", text: "Hi there!" },
            ];
            mockState.scrollLength = 600; // Phone screen height
            getContentSizeSpy.mockReturnValue(120); // Total message height

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 480, // 600 - 120
            });
        });

        it("should handle chat interface with many messages", () => {
            // Chat with many messages, content larger than viewport
            mockState.props.data = Array.from({ length: 50 }, (_, i) => ({
                id: `msg${i}`,
                text: `Message ${i}`,
            }));
            mockState.scrollLength = 600;
            getContentSizeSpy.mockReturnValue(2000); // Large content

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 0, // No padding needed
            });
        });

        it("should handle notification panel with few items", () => {
            mockState.props.data = [
                { id: "notif1", type: "message" },
                { id: "notif2", type: "like" },
            ];
            mockState.scrollLength = 300; // Panel height
            getContentSizeSpy.mockReturnValue(80); // Small notification height

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 220, // 300 - 80
            });
        });

        it("should handle modal list with dynamic content", () => {
            // Modal where content size can vary dramatically
            mockState.scrollLength = 400;

            // Small content scenario
            getContentSizeSpy.mockReturnValue(50);
            updateAlignItemsPaddingTop(mockCtx);
            expect(setPaddingTopSpy).toHaveBeenLastCalledWith(mockCtx, {
                alignItemsPaddingTop: 350,
            });

            // Large content scenario
            setPaddingTopSpy.mockClear();
            getContentSizeSpy.mockReturnValue(800);
            updateAlignItemsPaddingTop(mockCtx);
            expect(setPaddingTopSpy).toHaveBeenLastCalledWith(mockCtx, {
                alignItemsPaddingTop: 0,
            });
        });

        it("should handle tablet landscape orientation change", () => {
            // Portrait to landscape orientation change
            const scenarios = [
                { contentSize: 200, expected: 600, scrollLength: 800 }, // Portrait
                { contentSize: 200, expected: 1000, scrollLength: 1200 }, // Landscape
            ];

            scenarios.forEach(({ scrollLength, contentSize, expected }) => {
                setPaddingTopSpy.mockClear();
                mockState.scrollLength = scrollLength;
                getContentSizeSpy.mockReturnValue(contentSize);

                updateAlignItemsPaddingTop(mockCtx);

                expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                    alignItemsPaddingTop: expected,
                });
            });
        });
    });

    describe("integration with other systems", () => {
        it("should work correctly when called during layout updates", () => {
            // Simulate being called during layout recalculation
            mockState.scrollLength = 500;
            getContentSizeSpy.mockReturnValue(150);

            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 350,
            });
        });

        it("should handle being called multiple times with same data", () => {
            // Should be idempotent
            getContentSizeSpy.mockReturnValue(200);

            updateAlignItemsPaddingTop(mockCtx);
            updateAlignItemsPaddingTop(mockCtx);
            updateAlignItemsPaddingTop(mockCtx);

            expect(setPaddingTopSpy).toHaveBeenCalledTimes(3);
            expect(setPaddingTopSpy).toHaveBeenCalledWith(mockCtx, {
                alignItemsPaddingTop: 200,
            });
        });

        it("should handle data updates correctly", () => {
            // Initial state with small data
            getContentSizeSpy.mockReturnValue(100);
            updateAlignItemsPaddingTop(mockCtx);
            expect(setPaddingTopSpy).toHaveBeenLastCalledWith(mockCtx, {
                alignItemsPaddingTop: 300,
            });

            // Data grows, content size increases
            setPaddingTopSpy.mockClear();
            getContentSizeSpy.mockReturnValue(450);
            updateAlignItemsPaddingTop(mockCtx);
            expect(setPaddingTopSpy).toHaveBeenLastCalledWith(mockCtx, {
                alignItemsPaddingTop: 0,
            });
        });
    });
});
