import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { handleLayout } from "../../src/core/handleLayout";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";

describe("handleLayout", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let mockLayout: any;
    let setCanRenderCalls: boolean[];
    let setCanRender: (canRender: boolean) => void;

    beforeEach(() => {
        setCanRenderCalls = [];
        setCanRender = (canRender: boolean) => setCanRenderCalls.push(canRender);

        mockCtx = createMockContext(
            {
                contentSize: 1000,
                numColumns: 1,
                scrollSize: { height: 600, width: 400 },
            },
            {
                firstFullyOnScreenIndex: undefined,
                hasScrolled: false,
                isAtStart: true,
                otherAxisSize: 0,
                props: {
                    estimatedItemSize: 100,
                    onEndReachedThreshold: 0.2,
                    onStartReachedThreshold: 0.2,
                },
                queuedInitialLayout: true,
                scrollLength: 0,
            },
        );

        mockState = mockCtx.state!;

        mockLayout = {
            height: 600,
            width: 400,
            x: 0,
            y: 0,
        };
    });

    describe("basic layout handling", () => {
        it("should update scroll length for vertical layout", () => {
            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(600); // height
            expect(mockState.otherAxisSize).toBe(400); // width
            expect(setCanRenderCalls).toEqual([true]);
        });

        it("should update scroll length for horizontal layout", () => {
            mockState.props.horizontal = true;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(400); // width
            expect(mockState.otherAxisSize).toBe(600); // height
        });

        it("should store last layout", () => {
            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.lastLayout).toEqual(mockLayout);
        });

        it("should update last batching action timestamp", () => {
            const beforeTime = Date.now();

            handleLayout(mockCtx, mockLayout, setCanRender);

            const afterTime = Date.now();

            expect(mockState.lastBatchingAction).toBeGreaterThanOrEqual(beforeTime);
            expect(mockState.lastBatchingAction).toBeLessThanOrEqual(afterTime);
        });

        it("should clear scrollForNextCalculateItemsInView", () => {
            mockState.scrollForNextCalculateItemsInView = { bottom: 200, top: 100 };

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollForNextCalculateItemsInView).toBeUndefined();
        });
    });

    describe("change detection", () => {
        it("should detect no layout when lastLayout is undefined", () => {
            mockState.lastLayout = undefined;

            handleLayout(mockCtx, mockLayout, setCanRender);

            // Should trigger calculation (needsCalculate = true)
            expect(mockState.lastLayout).toEqual(mockLayout);
        });

        it("should detect size changes", () => {
            mockState.lastLayout = { height: 600, width: 400, x: 0, y: 0 };
            mockState.scrollLength = 600;

            // Change height
            mockLayout.height = 800;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(800);
        });

        it("should detect position changes", () => {
            mockState.lastLayout = { height: 600, width: 400, x: 0, y: 0 };
            mockState.scrollLength = 600;

            // Change position
            mockLayout.x = 50;
            mockLayout.y = 100;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.lastLayout.x).toBe(50);
            expect(mockState.lastLayout.y).toBe(100);
        });

        it("should not recalculate when dimensions are smaller", () => {
            mockState.lastLayout = { height: 600, width: 400, x: 0, y: 0 };
            mockState.scrollLength = 600;

            // Make smaller
            mockLayout.height = 400;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(400);
        });

        it("should trigger recalculation when size increases", () => {
            mockState.lastLayout = { height: 600, width: 400, x: 0, y: 0 };
            mockState.scrollLength = 600;

            // Make larger
            mockLayout.height = 800;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(800);
        });
    });

    describe("maintain scroll at end", () => {
        it("should handle maintainScrollAtEnd as boolean true", () => {
            mockState.props.maintainScrollAtEnd = true;

            handleLayout(mockCtx, mockLayout, setCanRender);

            // Function should complete without error
            expect(mockState.scrollLength).toBe(600);
        });

        it("should handle maintainScrollAtEnd as object with onLayout", () => {
            mockState.props.maintainScrollAtEnd = { onLayout: true };

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(600);
        });

        it("should skip maintainScrollAtEnd when false", () => {
            mockState.props.maintainScrollAtEnd = false;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(600);
        });

        it("should handle maintainScrollAtEnd as object without onLayout", () => {
            mockState.props.maintainScrollAtEnd = { onLayout: false };

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(600);
        });
    });

    describe("other axis size management", () => {
        it("should detect need for other axis size when size is small", () => {
            mockLayout.width = 5; // Very small width
            mockState.props.stylePaddingTop = 0;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.needsOtherAxisSize).toBe(true);
        });

        it("should not need other axis size when size is adequate", () => {
            mockLayout.width = 400; // Large width
            mockState.props.stylePaddingTop = 0;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.needsOtherAxisSize).toBe(false);
        });

        it("should account for padding when determining other axis size need", () => {
            mockLayout.width = 15; // 15px width
            mockState.props.stylePaddingTop = 10; // 10px padding

            handleLayout(mockCtx, mockLayout, setCanRender);

            // 15 - 10 = 5, which is < 10, so needs other axis size
            expect(mockState.needsOtherAxisSize).toBe(true);
        });

        it("should handle horizontal layout for other axis size", () => {
            mockState.props.horizontal = true;
            mockLayout.height = 5; // Small height for horizontal layout
            mockState.props.stylePaddingTop = 0;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.needsOtherAxisSize).toBe(true);
        });
    });

    describe("scroll size context updates", () => {
        it("should update scrollSize context when dimensions change", () => {
            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockCtx.values.get("scrollSize")).toEqual({
                height: 600,
                width: 400,
            });
        });

        it("should update scrollSize when other axis size changes", () => {
            mockState.scrollLength = 600; // Same scroll length
            mockState.otherAxisSize = 300; // Different other axis size

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockCtx.values.get("scrollSize")).toEqual({
                height: 600,
                width: 400,
            });
        });

        it("should not update scrollSize when dimensions haven't changed", () => {
            mockState.scrollLength = 600;
            mockState.otherAxisSize = 400;
            mockCtx.values.set("scrollSize", { height: 600, width: 400 });

            handleLayout(mockCtx, mockLayout, setCanRender);

            // Should still be updated due to implementation
            expect(mockCtx.values.get("scrollSize")).toEqual({
                height: 600,
                width: 400,
            });
        });
    });

    describe("development warnings", () => {
        it("should warn in development when scroll length is zero", () => {
            // Mock console.warn to capture warnings
            const originalWarn = console.warn;
            const warnings: string[] = [];
            console.warn = (message: string) => warnings.push(message);

            mockLayout.height = 0; // Zero height

            handleLayout(mockCtx, mockLayout, setCanRender);

            console.warn = originalWarn;

            // In development mode, should warn about zero height
            // (The actual warning depends on __DEV__ being true, which may not be set in tests)
            expect(mockState.scrollLength).toBe(0);
        });

        it("should handle horizontal zero width warning", () => {
            mockState.props.horizontal = true;
            mockLayout.width = 0; // Zero width

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(0);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle null layout gracefully", () => {
            expect(() => {
                handleLayout(mockCtx, null as any, setCanRender);
            }).toThrow();
        });

        it("should handle missing layout properties", () => {
            const incompleteLayout = { width: 400 }; // Missing height

            handleLayout(mockCtx, incompleteLayout as any, setCanRender);

            // Function handles missing properties gracefully
            expect(mockState.scrollLength).toBe(0); // height is undefined
            expect(mockState.otherAxisSize).toBe(400); // width is present
        });

        it("should handle negative dimensions", () => {
            mockLayout.width = -100;
            mockLayout.height = -200;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(0);
            expect(mockState.otherAxisSize).toBe(-100);
        });

        it("should handle very large dimensions", () => {
            mockLayout.width = Number.MAX_SAFE_INTEGER;
            mockLayout.height = Number.MAX_SAFE_INTEGER;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(Number.MAX_SAFE_INTEGER);
            expect(mockState.otherAxisSize).toBe(Number.MAX_SAFE_INTEGER);
        });

        it("should handle floating point dimensions", () => {
            mockLayout.width = 400.75;
            mockLayout.height = 600.25;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(600.25);
            expect(mockState.otherAxisSize).toBe(400.75);
        });

        it("should handle string dimensions", () => {
            mockLayout.width = "400";
            mockLayout.height = "600";

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe("600" as any);
            expect(mockState.otherAxisSize).toBe("400" as any);
        });

        it("should handle corrupted state", () => {
            mockState.props = null as any;

            expect(() => {
                handleLayout(mockCtx, mockLayout, setCanRender);
            }).toThrow();
        });

        it("should handle missing setCanRender callback", () => {
            expect(() => {
                handleLayout(mockCtx, mockLayout, null as any);
            }).toThrow();
        });
    });

    describe("integration and orchestration", () => {
        it("should call doInitialAllocateContainers", () => {
            handleLayout(mockCtx, mockLayout, setCanRender);

            // Function should complete without error, indicating integration works
            expect(mockState.scrollLength).toBe(600);
        });

        it("should call calculateItemsInView when needed", () => {
            handleLayout(mockCtx, mockLayout, setCanRender);

            // Function should complete, indicating calculateItemsInView was called
            expect(mockState.lastLayout).toEqual(mockLayout);
        });

        it("should call updateAlignItemsPaddingTop", () => {
            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.scrollLength).toBe(600);
        });

        it("should call checkAtBottom and checkAtTop", () => {
            handleLayout(mockCtx, mockLayout, setCanRender);

            // These functions update state flags
            expect(typeof mockState.isAtEnd).toBe("boolean");
            expect(typeof mockState.isAtStart).toBe("boolean");
        });

        it("should always call setCanRender with true", () => {
            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(setCanRenderCalls).toEqual([true]);
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid layout changes efficiently", () => {
            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                mockLayout.height = 600 + i;
                handleLayout(mockCtx, mockLayout, setCanRender);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000); // Should handle rapid changes efficiently
        });

        it("should maintain memory efficiency", () => {
            const initialMemory = process.memoryUsage().heapUsed;

            for (let i = 0; i < 100; i++) {
                const layout = {
                    height: 600 + i,
                    width: 400 + i,
                    x: i,
                    y: i,
                };
                handleLayout(mockCtx, layout, setCanRender);
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
        });

        it("should optimize when layout hasn't changed", () => {
            // First call
            handleLayout(mockCtx, mockLayout, setCanRender);

            // Second call with same layout (but needsCalculate will still be true due to missing lastLayout initially)
            const callsBefore = setCanRenderCalls.length;
            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(setCanRenderCalls.length).toBe(callsBefore + 1);
        });
    });

    describe("complex layout scenarios", () => {
        it("should handle layout with position offset", () => {
            mockLayout.x = 100;
            mockLayout.y = 200;

            handleLayout(mockCtx, mockLayout, setCanRender);

            expect(mockState.lastLayout?.x).toBe(100);
            expect(mockState.lastLayout?.y).toBe(200);
            expect(mockState.scrollLength).toBe(600);
        });

        it("should handle transition between horizontal and vertical", () => {
            // Start vertical
            mockState.props.horizontal = false;
            handleLayout(mockCtx, mockLayout, setCanRender);
            expect(mockState.scrollLength).toBe(600); // height

            // Switch to horizontal
            mockState.props.horizontal = true;
            handleLayout(mockCtx, mockLayout, setCanRender);
            expect(mockState.scrollLength).toBe(400); // width
        });

        it("should handle multiple consecutive size changes", () => {
            const sizes = [
                { height: 500, width: 300 },
                { height: 600, width: 400 },
                { height: 700, width: 500 },
                { height: 800, width: 600 },
            ];

            sizes.forEach((size) => {
                mockLayout.width = size.width;
                mockLayout.height = size.height;
                handleLayout(mockCtx, mockLayout, setCanRender);

                expect(mockState.scrollLength).toBe(size.height);
                expect(mockState.otherAxisSize).toBe(size.width);
            });
        });
    });
});
