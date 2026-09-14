import {
    buildOptimizationHref,
    getOptimizationDemo,
    OPTIMIZATION_DEMOS,
    OPTIMIZATION_HOME_ENTRIES,
} from "../../example/screens/examples/optimizationConfig";

describe("optimization example config", () => {
    it("creates a direct catalog entry for every optimization topic", () => {
        expect(OPTIMIZATION_HOME_ENTRIES).toHaveLength(OPTIMIZATION_DEMOS.length);
        expect(OPTIMIZATION_HOME_ENTRIES.map((entry) => entry.href)).toEqual(
            OPTIMIZATION_DEMOS.map((demo) => buildOptimizationHref(demo.id)),
        );
    });

    it("normalizes invalid and array search parameters", () => {
        expect(getOptimizationDemo(undefined).id).toBe("invalidation");
        expect(getOptimizationDemo("missing").id).toBe("invalidation");
        expect(getOptimizationDemo(["recycling", "data"]).id).toBe("recycling");
    });
});
