import { describe, expect, it } from "bun:test";
import type { LayoutReader } from "./currentLayoutReader";

interface LayoutReaderHarness {
    reader: LayoutReader;
    setMeasuredSize(index: number, size: number): void;
    updateFrom(startIndex?: number): void;
}

interface LayoutReaderHarnessOptions {
    estimatedItemSize?: number;
    sizes: Array<number | undefined>;
}

export type CreateLayoutReaderHarness = (options: LayoutReaderHarnessOptions) => LayoutReaderHarness;

export function runLayoutReaderContract(name: string, createHarness: CreateLayoutReaderHarness) {
    describe(name, () => {
        it("reads offsets, ends, and total size", () => {
            const harness = createHarness({ sizes: [50, 75, 25] });

            harness.updateFrom();

            const { reader } = harness;
            expect(reader.getOffset(0)).toBe(0);
            expect(reader.getOffset(1)).toBe(50);
            expect(reader.getOffset(2)).toBe(125);
            expect(reader.getEnd(0)).toBe(50);
            expect(reader.getEnd(1)).toBe(125);
            expect(reader.getEnd(2)).toBe(150);
            expect(reader.getTotalSize()).toBe(150);
        });

        it("finds the first item whose end offset is greater than the target offset", () => {
            const harness = createHarness({ sizes: [50, 75, 25] });

            harness.updateFrom();

            const { reader } = harness;
            expect(reader.findIndexAtOffset(0)).toBe(0);
            expect(reader.findIndexAtOffset(49.999)).toBe(0);
            expect(reader.findIndexAtOffset(50)).toBe(1);
            expect(reader.findIndexAtOffset(124.999)).toBe(1);
            expect(reader.findIndexAtOffset(125)).toBe(2);
            expect(reader.findIndexAtOffset(149.999)).toBe(2);
            expect(reader.findIndexAtOffset(150)).toBeUndefined();
        });

        it("handles mixed measured and estimated sizes", () => {
            const harness = createHarness({
                estimatedItemSize: 100,
                sizes: [60, undefined, 140, undefined],
            });

            harness.updateFrom();

            const { reader } = harness;
            expect(reader.getSize(0)).toBe(60);
            expect(reader.getSize(1)).toBe(100);
            expect(reader.getSize(2)).toBe(140);
            expect(reader.getSize(3)).toBe(100);
            expect(reader.getOffset(0)).toBe(0);
            expect(reader.getOffset(1)).toBe(60);
            expect(reader.getOffset(2)).toBe(160);
            expect(reader.getOffset(3)).toBe(300);
            expect(reader.getTotalSize()).toBe(400);
        });

        it("propagates an index 0 size change through semantic offsets", () => {
            const harness = createHarness({ sizes: [100, 100, 100, 100] });

            harness.updateFrom();
            harness.setMeasuredSize(0, 150);
            harness.updateFrom();

            const { reader } = harness;
            expect(reader.getOffset(0)).toBe(0);
            expect(reader.getOffset(1)).toBe(150);
            expect(reader.getOffset(2)).toBe(250);
            expect(reader.getOffset(3)).toBe(350);
            expect(reader.getTotalSize()).toBe(450);
        });

        it("propagates a middle size change from the changed index onward", () => {
            const harness = createHarness({ sizes: [100, 100, 100, 100] });

            harness.updateFrom();
            harness.setMeasuredSize(2, 175);
            harness.updateFrom(2);

            const { reader } = harness;
            expect(reader.getOffset(0)).toBe(0);
            expect(reader.getOffset(1)).toBe(100);
            expect(reader.getOffset(2)).toBe(200);
            expect(reader.getOffset(3)).toBe(375);
            expect(reader.getTotalSize()).toBe(475);
        });

        it("preserves fractional layout sizes", () => {
            const harness = createHarness({ sizes: [10.5, 20.25, 3.75] });

            harness.updateFrom();

            const { reader } = harness;
            expect(reader.getOffset(1)).toBeCloseTo(10.5);
            expect(reader.getOffset(2)).toBeCloseTo(30.75);
            expect(reader.getEnd(2)).toBeCloseTo(34.5);
            expect(reader.getTotalSize()).toBeCloseTo(34.5);
        });

        it("can compute an MVCP-style anchor delta from committed and updated offsets", () => {
            const harness = createHarness({ sizes: [100, 100, 100, 100] });

            harness.updateFrom();

            const oldAnchorTop = harness.reader.getOffset(3);

            harness.setMeasuredSize(0, 150);
            harness.updateFrom();

            const newAnchorTop = harness.reader.getOffset(3);

            expect(oldAnchorTop).toBe(300);
            expect(newAnchorTop).toBe(350);
            expect(newAnchorTop! - oldAnchorTop!).toBe(50);
        });
    });
}
