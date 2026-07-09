import { describe, expect, it } from "bun:test";
import {
    buildComparisonSearch,
    COMPARISON_LIBRARIES,
    COMPARISON_OVERSCAN_COUNT,
    COMPARISON_PRELOAD_PX,
    getComparisonLibraryRuntimeConfig,
    getVisibleComparisonLibraryIds,
    parseComparisonSearch,
} from "../../example-web/src/examples/comparisonConfig";

describe("example-web comparison config", () => {
    it("expands all library selection in a stable display order", () => {
        expect(getVisibleComparisonLibraryIds("all")).toEqual(COMPARISON_LIBRARIES.map((library) => library.id));
    });

    it("keeps a single selected library isolated", () => {
        expect(getVisibleComparisonLibraryIds("legend-list")).toEqual(["legend-list"]);
    });

    it("normalizes runtime preload settings across the comparison libraries", () => {
        expect(getComparisonLibraryRuntimeConfig("legend-list")).toEqual({
            drawDistance: COMPARISON_PRELOAD_PX,
        });
        expect(getComparisonLibraryRuntimeConfig("react-virtuoso")).toEqual({
            increaseViewportBy: {
                bottom: COMPARISON_PRELOAD_PX,
                top: COMPARISON_PRELOAD_PX,
            },
        });
        expect(getComparisonLibraryRuntimeConfig("react-window")).toEqual({
            overscanCount: COMPARISON_OVERSCAN_COUNT,
        });
        expect(getComparisonLibraryRuntimeConfig("tanstack-virtual")).toEqual({
            overscan: COMPARISON_OVERSCAN_COUNT,
        });
        expect(getComparisonLibraryRuntimeConfig("virtua")).toEqual({
            overscan: COMPARISON_OVERSCAN_COUNT,
        });
    });

    it("clamps small item-count params to the longer comparison minimum", () => {
        expect(parseComparisonSearch("?count=1200").count).toBe(5000);
    });

    it("preserves explicit low work and extra-node params from the url", () => {
        expect(parseComparisonSearch("?workMs=0&extraNodes=0")).toMatchObject({
            extraNodes: 0,
            workMs: 0,
        });
    });

    it("ignores stale automation params from older comparison links", () => {
        expect(
            parseComparisonSearch(
                "?mode=perf&library=react-window&playback=sequential&scenario=scan&autorun=1&count=6200",
            ),
        ).toMatchObject({
            count: 6200,
            extraNodes: 12,
            librarySelection: "react-window",
            workMs: 2,
        });
    });

    it("round-trips non-default manual comparison search params", () => {
        const parsed = parseComparisonSearch("?library=react-window&count=6200&workMs=4&extraNodes=9");

        expect(buildComparisonSearch(parsed)).toBe("?library=react-window&count=6200&workMs=4&extraNodes=9");
    });
});
