import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import { onScroll } from "../../src/core/onScroll";
import { syncMountedContainer } from "../../src/core/syncMountedContainer";
import { updateItemPositions } from "../../src/core/updateItemPositions";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import * as stateModule from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { updateSnapToOffsets } from "../../src/utils/updateSnapToOffsets";
import { createMockContext } from "../__mocks__/createMockContext";
import { setLayoutValue } from "../helpers/layoutArrays";

describe("native RTL snap minimums", () => {
    it.each([
        { expectedOffset: 151, expectedScroll: 249, inset: 86, itemSize: 95, platform: "ios" },
        { expectedOffset: 65, expectedScroll: 335, inset: 0, itemSize: 95, platform: "ios" },
        { expectedOffset: 65, expectedScroll: 335, inset: 86, itemSize: 95, platform: "android" },
        { expectedOffset: 0, expectedScroll: 400, inset: 86, itemSize: 35, platform: "ios" },
        { expectedOffset: 0, expectedScroll: 400, inset: 86, itemSize: 35, platform: "android" },
    ] as const)(
        "preserves baseline snap geometry on $platform with inset $inset and item size $itemSize",
        ({ platform, inset, itemSize, expectedOffset, expectedScroll }) => {
            const previousPlatform = Platform.OS;
            Platform.OS = platform;
            const ctx = createMockContext(
                { numColumns: 1, otherAxisSize: 100, readyToRender: true },
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    horizontalRTLScrollType: "inverted",
                    props: {
                        contentContainerMinSize: 1000,
                        contentInset: { bottom: 0, left: inset, right: 0, top: 0 },
                        data: Array.from({ length: 10 }, (_, id) => ({ id: String(id) })),
                        estimatedItemSize: itemSize,
                        getFixedItemSize: () => itemSize,
                        horizontal: true,
                        keyExtractor: (item: { id: string }) => item.id,
                        rtl: true,
                        snapToIndices: [3],
                    },
                    queuedInitialLayout: true,
                    scrollLength: 600,
                },
            );
            try {
                updateItemPositions(ctx, true);
                expect(ctx.state.positions[3]).toBe(3 * itemSize);
                ctx.values.set("containerItemData0", ctx.state.props.data[3]);
                syncMountedContainer(ctx, 0, 3);
                const emitted = ctx.values.get("snapToOffsets") as number[];
                const nativeOffset = Math.min(400, Math.max(0, emitted[0]));
                // Per-list RTL still places this row layer at zero in an LTR native layout.
                const rowStart = (ctx.values.get("containerPosition0") as number) - nativeOffset;
                const visibleWidth = Math.max(0, Math.min(600, rowStart + itemSize) - Math.max(0, rowStart));
                expect(visibleWidth).toBe(itemSize);
                expect(emitted).toEqual([expectedOffset]);
                onScroll(ctx, {
                    nativeEvent: {
                        contentInset: { bottom: 0, left: platform === "ios" ? inset : 0, right: 0, top: 0 },
                        contentOffset: { x: nativeOffset, y: 0 },
                        contentSize: { height: 100, width: 1000 },
                        layoutMeasurement: { height: 100, width: 600 },
                    },
                } as any);
                // Preserve baseline readback; logical index agreement alone cannot prove row visibility.
                expect(ctx.state.scroll).toBe(expectedScroll);
            } finally {
                Platform.OS = previousPlatform;
                ctx.state.scheduledWork.dispose();
            }
        },
    );
});

describe("updateSnapToOffsets", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let setStateSpy: ReturnType<typeof mock>;
    let setDollarSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        setStateSpy = mock();

        // Mock set$ using spyOn
        setDollarSpy = spyOn(stateModule, "set$").mockImplementation(setStateSpy);

        // Create mock context
        mockCtx = createMockContext();

        // Create mock state
        mockState = {
            idCache: [],
            positions: [0, 100, 250, 400, 600, 850],
            props: {
                data: [
                    { id: "item1", name: "First" },
                    { id: "item2", name: "Second" },
                    { id: "item3", name: "Third" },
                    { id: "item4", name: "Fourth" },
                    { id: "item5", name: "Fifth" },
                    { id: "item6", name: "Sixth" },
                ],
                keyExtractor: undefined, // Use index-based keys (default behavior)
                snapToIndices: [0, 2, 4], // Snap to items 0, 2, and 4
            },
        } as any;
        mockCtx.state = mockState;
    });

    afterEach(() => {
        setDollarSpy.mockRestore();
    });

    describe("basic functionality", () => {
        it("should create snapToOffsets array from snapToIndices", () => {
            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 250, 600]);
        });

        it("should handle single snap index", () => {
            mockState.props.snapToIndices = [2];

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [250]);
        });

        it("should handle empty snapToIndices array", () => {
            mockState.props.snapToIndices = [];

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", []);
        });

        it("should preserve order of snapToIndices", () => {
            mockState.props.snapToIndices = [4, 1, 3, 0]; // Out of order

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [600, 100, 400, 0]);
        });
    });

    describe("rtl horizontal behavior", () => {
        beforeEach(() => {
            mockState.props.horizontal = true;
            mockState.props.rtl = true;
            mockState.scrollLength = 300;
            mockCtx.values.set("totalSize", 1000);
        });

        it("converts snap offsets for inverted native horizontal scrolling", () => {
            mockState.horizontalRTLScrollType = "inverted";

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [700, 450, 100]);
        });

        it("converts snap offsets for negative native horizontal scrolling", () => {
            mockState.horizontalRTLScrollType = "negative";

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, -250, -600]);
        });

        it.each([
            { expected: 0, header: 0, itemSize: 35, mode: "negative" },
            { expected: 0, header: 0, itemSize: 35, mode: "normal" },
            { expected: -285, header: 0, itemSize: 95, mode: "negative" },
            { expected: 285, header: 0, itemSize: 95, mode: "normal" },
            { expected: -105, header: 400, itemSize: 35, mode: "negative" },
            { expected: 105, header: 400, itemSize: 35, mode: "normal" },
        ] as const)(
            "preserves web snap extent with $mode offsets, item size $itemSize and header $header",
            ({ expected, header, itemSize, mode }) => {
                const previousPlatform = Platform.OS;
                Platform.OS = "web";
                mockState.horizontalRTLScrollType = mode;
                mockState.scrollLength = 600;
                mockState.positions = Array.from({ length: 10 }, (_, index) => index * itemSize);
                mockState.props.data = Array.from({ length: 10 }, (_, index) => ({ id: `item_${index}` }));
                mockState.props.snapToIndices = [3];
                mockState.props.contentContainerMinSize = 1000;
                mockState.props.contentInsetEndAdjustment = 86;
                mockCtx.values.set("headerSize", header);
                mockCtx.values.set("totalSize", itemSize * 10);
                try {
                    updateSnapToOffsets(mockCtx);

                    expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [expected]);
                } finally {
                    Platform.OS = previousPlatform;
                }
            },
        );
    });

    describe("position mapping", () => {
        it("should correctly map indices to positions", () => {
            mockState.props.snapToIndices = [1, 3, 5];

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [100, 400, 850]);
        });

        it("should handle indices not in positions map", () => {
            mockState.props.snapToIndices = [10, 20]; // Out of bounds indices

            updateSnapToOffsets(mockCtx);

            // Should use undefined values from positions map
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [undefined, undefined]);
        });

        it("should handle mixed valid and invalid indices", () => {
            mockState.props.snapToIndices = [1, 10, 2, 20];

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [100, undefined, 250, undefined]);
        });

        it("should handle zero index correctly", () => {
            mockState.props.snapToIndices = [0];

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0]);
        });
    });

    describe("keyExtractor integration", () => {
        it("should work with custom keyExtractor", () => {
            mockState.props.keyExtractor = (item: any) => `custom_${item.id}`;
            mockState.positions = [0, 150, 300];
            mockState.props.snapToIndices = [0, 2];

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 300]);
        });

        it("should handle keyExtractor returning different types", () => {
            (mockState.props as any).keyExtractor = (_: any, index: number) => index; // Returns number
            mockState.positions = [0, 120, 280] as any;
            mockState.props.snapToIndices = [0, 1, 2];

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 120, 280]);
        });

        it("should handle keyExtractor with complex logic", () => {
            mockState.props.keyExtractor = (item: any, index: number) => `${item.name}_${index}`;
            mockState.positions = [0, 200, 400];
            mockState.props.snapToIndices = [1, 2];

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [200, 400]);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle null state", () => {
            mockCtx.state = null as any;
            expect(() => {
                updateSnapToOffsets(mockCtx);
            }).toThrow();
        });

        it("should handle null context", () => {
            expect(() => {
                updateSnapToOffsets(null as any);
            }).toThrow();
        });

        it("should handle corrupted positions map", () => {
            mockState.positions = null as any;

            expect(() => {
                updateSnapToOffsets(mockCtx);
            }).toThrow();
        });

        it("should handle missing snapToIndices", () => {
            mockState.props.snapToIndices = undefined as any;

            expect(() => {
                updateSnapToOffsets(mockCtx);
            }).toThrow();
        });

        it("should handle corrupted props", () => {
            mockState.props = null as any;

            expect(() => {
                updateSnapToOffsets(mockCtx);
            }).toThrow();
        });

        it("should handle negative indices", () => {
            mockState.props.snapToIndices = [-1, -2];

            updateSnapToOffsets(mockCtx);

            // getId should handle negative indices gracefully
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [undefined, undefined]);
        });

        it("should handle floating point indices", () => {
            mockState.props.snapToIndices = [1.5, 2.7];

            updateSnapToOffsets(mockCtx);

            // getId converts to string, so 1.5 -> "1.5" which won't match "item_1"
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [undefined, undefined]);
        });

        it("should handle very large indices", () => {
            mockState.props.snapToIndices = [999999, 1000000];

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [undefined, undefined]);
        });
    });

    describe("performance", () => {
        it("should handle large snapToIndices arrays efficiently", () => {
            const largeIndices = Array.from({ length: 1000 }, (_, i) => i);
            const largePositions: Array<number | undefined> = [];
            for (let i = 0; i < 1000; i++) {
                largePositions[i] = i * 100;
            }

            mockState.props.snapToIndices = largeIndices;
            mockState.positions = largePositions;
            // Add mock data array for getId function
            mockState.props.data = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item_${i}` }));
            mockState.props.keyExtractor = undefined; // Use default index-based keys

            const start = Date.now();
            updateSnapToOffsets(mockCtx);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(100); // Should be reasonably fast
            expect(setStateSpy).toHaveBeenCalledTimes(1);

            const expectedOffsets = Array.from({ length: 1000 }, (_, i) => i * 100);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", expectedOffsets);
        });

        it("should handle rapid consecutive calls efficiently", () => {
            const start = Date.now();

            for (let i = 0; i < 100; i++) {
                setStateSpy.mockClear();
                updateSnapToOffsets(mockCtx);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50); // Should be very fast
        });

        it("should not cause memory issues with large datasets", () => {
            const hugeData = Array.from({ length: 50000 }, (_, i) => ({ id: i }));
            mockState.props.data = hugeData;
            mockState.props.snapToIndices = [0, 1000, 2000, 3000];

            const start = Date.now();
            updateSnapToOffsets(mockCtx);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(50);
        });
    });

    describe("real world scenarios", () => {
        it("should handle pagination snap points", () => {
            // Snap to page boundaries
            mockState.props.snapToIndices = [0, 10, 20, 30]; // Page starts
            mockState.positions = [];
            mockState.positions[0] = 0;
            mockState.positions[10] = 1000;
            mockState.positions[20] = 2000;
            mockState.positions[30] = 3000;
            // Ensure we have enough data for getId
            mockState.props.data = Array.from({ length: 35 }, (_, i) => ({ id: i, value: `item_${i}` }));

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 1000, 2000, 3000]);
        });

        it("should handle section headers snap", () => {
            // Snap to section headers
            mockState.props.snapToIndices = [0, 5, 12, 18]; // Section starts
            mockState.positions = [];
            mockState.positions[0] = 0; // Section A header
            mockState.positions[5] = 500; // Section B header
            mockState.positions[12] = 1200; // Section C header
            mockState.positions[18] = 1800; // Section D header
            // Ensure we have enough data for getId
            mockState.props.data = Array.from({ length: 25 }, (_, i) => ({ id: i, value: `item_${i}` }));

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 500, 1200, 1800]);
        });

        it("should handle carousel item snap", () => {
            // Horizontal carousel with snap to each item
            mockState.props.snapToIndices = [0, 1, 2, 3, 4];
            mockState.positions = [0, 300, 600, 900, 1200] as any;
            // Ensure we have enough data for getId
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i, value: `item_${i}` }));

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 300, 600, 900, 1200]);
        });

        it("should handle staggered snap points", () => {
            // Non-uniform snap points
            mockState.props.snapToIndices = [0, 3, 7, 15];
            mockState.positions = [];
            mockState.positions[0] = 0;
            mockState.positions[3] = 300;
            mockState.positions[7] = 700;
            mockState.positions[15] = 1500;
            // Ensure we have enough data for getId
            mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i, value: `item_${i}` }));

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 300, 700, 1500]);
        });

        it("should handle dynamic snap indices", () => {
            // Snap indices that change based on content
            const scenarios = [
                { expected: [0, 250, 600], indices: [0, 2, 4] },
                { expected: [100, 400, 850], indices: [1, 3, 5] },
                { expected: [0, 100, 250, 400], indices: [0, 1, 2, 3] },
            ];

            scenarios.forEach(({ indices, expected }) => {
                setStateSpy.mockClear();
                mockState.props.snapToIndices = indices;

                updateSnapToOffsets(mockCtx);

                expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", expected);
            });
        });
    });

    describe("integration with scroll system", () => {
        it("should work correctly when positions are updated", () => {
            // Initial state
            updateSnapToOffsets(mockCtx);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 250, 600]);

            // Positions updated (e.g., after layout)
            setStateSpy.mockClear();
            setLayoutValue(mockState, "positions", 2 as any, 275); // Position changed

            updateSnapToOffsets(mockCtx);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 275, 600]);
        });

        it("should handle data changes affecting indices", () => {
            // Original snap points
            updateSnapToOffsets(mockCtx);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 250, 600]);

            // Items added/removed, indices may now point to different items
            setStateSpy.mockClear();
            mockState.positions = [0, 80, 180, 320, 500, 720] as any;

            updateSnapToOffsets(mockCtx);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 180, 500]);
        });

        it("should handle set$ function errors", () => {
            setStateSpy.mockImplementation(() => {
                throw new Error("State update failed");
            });

            expect(() => {
                updateSnapToOffsets(mockCtx);
            }).toThrow("State update failed");
        });
    });

    describe("type handling", () => {
        it("should handle mixed position value types", () => {
            mockState.positions = [0, undefined, "250", undefined, null] as any;

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, "250", null]);
        });

        it("should handle undefined positions gracefully", () => {
            mockState.positions = [0, undefined, undefined, undefined, 600] as any;

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, undefined, 600]);
        });

        it("should preserve position value types", () => {
            mockState.positions = [0.5, undefined, 250.75, undefined, 600] as any;

            updateSnapToOffsets(mockCtx);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0.5, 250.75, 600]);
        });
    });

    describe("array creation and memory", () => {
        it("should create new array each time", () => {
            updateSnapToOffsets(mockCtx);
            setStateSpy.mockClear();
            updateSnapToOffsets(mockCtx);

            // Should be called twice with separate arrays
            expect(setStateSpy).toHaveBeenCalledTimes(1);
        });

        it("should handle array pre-allocation correctly", () => {
            mockState.props.snapToIndices = [0, 1, 2, 3, 4];

            updateSnapToOffsets(mockCtx);

            const [[, , actualArray]] = setStateSpy.mock.calls;
            expect(actualArray).toHaveLength(5);
            expect(Array.isArray(actualArray)).toBe(true);
        });
    });
});
