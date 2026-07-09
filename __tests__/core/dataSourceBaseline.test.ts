import { describe, expect, it } from "bun:test";
import "../setup";

import { runDataSourceBaseline } from "../../benchmarks/data-source-baseline";

describe("data source architecture baseline", () => {
    it("records comparable array, sparse prefix, and regular-grid samples", () => {
        const baseline = runDataSourceBaseline({ knownCount: 10, lengths: [1_000], queryCount: 25 });

        expect(baseline.version).toBe(1);
        expect(baseline.samples.map((sample) => sample.name)).toEqual([
            "array-structural-comparison",
            "prefix-layout",
            "regular-grid-layout",
        ]);
        expect(baseline.samples.every((sample) => sample.length === 1_000)).toBe(true);
        expect(baseline.samples.every((sample) => sample.queryCount === 25)).toBe(true);
        expect(baseline.samples.every((sample) => Number.isFinite(sample.durationMs))).toBe(true);
        expect(baseline.samples[0]?.keyExtractorCalls).toBe(25);
        expect(baseline.samples[1]?.knownCount).toBe(10);
        expect(baseline.samples[2]?.knownCount).toBe(10);
    });

    it("keeps structural-comparison identity work independent of logical length", () => {
        const baseline = runDataSourceBaseline({ knownCount: 1, lengths: [100_000, 1_000_000], queryCount: 5 });
        const comparisonSamples = baseline.samples.filter((sample) => sample.name === "array-structural-comparison");

        expect(comparisonSamples).toHaveLength(2);
        expect(comparisonSamples.map((sample) => sample.keyExtractorCalls)).toEqual([5, 5]);
    });
});
