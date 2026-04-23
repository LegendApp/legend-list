import { describe, expect, it } from "bun:test";
import { PUBLIC_EXAMPLE_GROUP_ORDER, PUBLIC_EXAMPLE_ROUTES } from "../../example-web/src/examples/publicExampleRoutes";

describe("example-web public example routes", () => {
    it("registers the benchmark route in the public examples catalog", () => {
        expect(PUBLIC_EXAMPLE_GROUP_ORDER).toEqual(["Benchmarks"]);
        expect(PUBLIC_EXAMPLE_ROUTES).toEqual([
            {
                description: "Manual cross-library benchmark for side-by-side scrolling comparison.",
                group: "Benchmarks",
                slug: "library-benchmark",
                title: "Library Benchmark",
            },
        ]);
    });
});
