import { describe, expect, it } from "bun:test";
import {
    buildComparisonHref,
    COMPARISON_EXAMPLES,
    COMPARISON_HOME_ENTRIES,
    COMPARISON_LIBRARIES,
    getComparisonExample,
    getComparisonLibrary,
} from "../../example/screens/examples/comparisonConfig";

describe("native comparison config", () => {
    it("builds a home action for every example and library", () => {
        expect(COMPARISON_HOME_ENTRIES).toHaveLength(COMPARISON_EXAMPLES.length);

        for (const entry of COMPARISON_HOME_ENTRIES) {
            expect(entry.actions).toHaveLength(COMPARISON_LIBRARIES.length);
            for (const library of COMPARISON_LIBRARIES) {
                expect(entry.actions).toContainEqual({
                    href: buildComparisonHref(entry.id, library.id),
                    label: library.label,
                });
            }
        }
    });

    it("keeps the selected example and library in the deep link", () => {
        expect(buildComparisonHref("movies", "flashlist")).toBe("/comparisons?example=movies&list=flashlist");
    });

    it("normalizes missing and invalid search parameters", () => {
        expect(getComparisonExample("unknown").id).toBe("cards");
        expect(getComparisonLibrary(undefined).id).toBe("legendlist");
    });

    it("accepts Expo Router array search parameters", () => {
        expect(getComparisonExample(["movies", "cards"]).id).toBe("movies");
        expect(getComparisonLibrary(["flatlist", "legendlist"]).id).toBe("flatlist");
    });
});
