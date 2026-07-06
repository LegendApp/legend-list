import type { LayoutEngine } from "@/core/LayoutEngine";
import { describe, expect, it } from "bun:test";

interface LayoutEngineHarness {
    engine: LayoutEngine;
    updateFrom(startIndex?: number): void;
}

interface LayoutEngineHarnessOptions {
    estimatedItemSize?: number;
    sizes: Array<number | undefined>;
}

export type CreateLayoutEngineHarness = (options: LayoutEngineHarnessOptions) => LayoutEngineHarness;

export function runLayoutEngineContract(name: string, createHarness: CreateLayoutEngineHarness) {
    describe(name, () => {
        it("reads offsets, sizes, ends, and total size", () => {
            const harness = createHarness({ sizes: [50, 75, 25] });

            harness.updateFrom();

            const { engine } = harness;
            expect(engine.getOffset(0)).toBe(0);
            expect(engine.getOffset(1)).toBe(50);
            expect(engine.getOffset(2)).toBe(125);
            expect(engine.getSize(0)).toBe(50);
            expect(engine.getSize(1)).toBe(75);
            expect(engine.getSize(2)).toBe(25);
            expect(engine.getEnd(0)).toBe(50);
            expect(engine.getEnd(1)).toBe(125);
            expect(engine.getEnd(2)).toBe(150);
            expect(engine.getTotalSize()).toBe(150);
        });

        it("handles mixed measured and estimated sizes", () => {
            const harness = createHarness({
                estimatedItemSize: 100,
                sizes: [60, undefined, 140, undefined],
            });

            harness.updateFrom();

            const { engine } = harness;
            expect(engine.getSize(0)).toBe(60);
            expect(engine.getSize(1)).toBe(100);
            expect(engine.getSize(2)).toBe(140);
            expect(engine.getSize(3)).toBe(100);
            expect(engine.getOffset(0)).toBe(0);
            expect(engine.getOffset(1)).toBe(60);
            expect(engine.getOffset(2)).toBe(160);
            expect(engine.getOffset(3)).toBe(300);
            expect(engine.getTotalSize()).toBe(400);
        });

        it("computes snap offsets from layout offsets", () => {
            const harness = createHarness({ sizes: [40, 60, 125, 75] });

            harness.updateFrom();

            expect(harness.engine.getSnapOffsets([0, 2, 3])).toEqual([0, 100, 225]);
        });

        it("syncs total size through the engine", () => {
            const harness = createHarness({ sizes: [50, 75, 25] });

            harness.updateFrom();

            expect(harness.engine.syncTotalSize()).toBe(true);
            expect(harness.engine.getTotalSize()).toBe(150);
        });

        it("preserves fractional layout sizes", () => {
            const harness = createHarness({ sizes: [10.5, 20.25, 3.75] });

            harness.updateFrom();

            const { engine } = harness;
            expect(engine.getOffset(1)).toBeCloseTo(10.5);
            expect(engine.getOffset(2)).toBeCloseTo(30.75);
            expect(engine.getEnd(2)).toBeCloseTo(34.5);
            expect(engine.getTotalSize()).toBeCloseTo(34.5);
        });
    });
}
