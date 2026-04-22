import { describe, expect, it } from "bun:test";
import {
    BENCHMARK_LIBRARIES,
    buildBenchmarkScenarioSteps,
    getBenchmarkScenarioBudgetMs,
    getVisibleBenchmarkLibraryIds,
} from "../../example-web/src/examples/benchmarkConfig";

describe("example-web benchmark config", () => {
    it("expands all library selection in a stable display order", () => {
        expect(getVisibleBenchmarkLibraryIds("all")).toEqual(BENCHMARK_LIBRARIES.map((library) => library.id));
    });

    it("keeps a single selected library isolated", () => {
        expect(getVisibleBenchmarkLibraryIds("legend-list")).toEqual(["legend-list"]);
    });

    it("builds bounded jump-tour steps for the provided item count", () => {
        const steps = buildBenchmarkScenarioSteps("jump-tour", 10);

        expect(steps.map((step) => step.label)).toEqual([
            "Top",
            "14%",
            "36%",
            "62%",
            "86%",
            "Bottom",
            "Center",
            "Reset",
        ]);
        expect(steps.map((step) => step.index)).toEqual([0, 1, 3, 6, 8, 9, 5, 0]);
        expect(steps.every((step) => step.index >= 0 && step.index < 10)).toBe(true);
    });

    it("includes the scenario settle budget in the scripted runtime budget", () => {
        expect(getBenchmarkScenarioBudgetMs("jump-tour", 100)).toBe(1300);
        expect(getBenchmarkScenarioBudgetMs("bounds-tour", 100)).toBe(720);
    });
});
