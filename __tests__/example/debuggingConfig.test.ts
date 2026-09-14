import {
    buildDebuggingHref,
    DEBUGGING_DEMOS,
    DEBUGGING_HOME_ENTRIES,
    getDebuggingDemo,
} from "../../example/screens/examples/debuggingConfig";

describe("debugging example config", () => {
    it("creates a direct catalog entry for every debugging topic", () => {
        expect(DEBUGGING_HOME_ENTRIES.map((entry) => entry.href)).toEqual(
            DEBUGGING_DEMOS.map((demo) => buildDebuggingHref(demo.id)),
        );
    });

    it("normalizes missing and array search parameters", () => {
        expect(getDebuggingDemo(undefined).id).toBe("row-cost");
        expect(getDebuggingDemo("missing").id).toBe("row-cost");
        expect(getDebuggingDemo(["images", "row-cost"]).id).toBe("images");
    });
});
