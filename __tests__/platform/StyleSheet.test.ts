import { describe, expect, it } from "bun:test";
import "../setup";

import { StyleSheet } from "../../src/platform/StyleSheet.tsx?web-stylesheet";

describe("StyleSheet.flatten (web)", () => {
    it("returns a plain style object unchanged", () => {
        const style = { flex: 1 };
        expect(StyleSheet.flatten(style)).toBe(style);
    });

    it("merges a flat style array with later entries winning and falsy entries skipped", () => {
        expect(StyleSheet.flatten([{ flex: 1, opacity: 0.5 }, false, null, undefined, { opacity: 1 }])).toEqual({
            flex: 1,
            opacity: 1,
        });
    });

    it("flattens nested style arrays without leaking numeric keys", () => {
        const flattened = StyleSheet.flatten([
            { flex: 1 },
            [{ backgroundColor: "red" }, false, [{ padding: 4 }, { backgroundColor: "blue" }]],
        ]);

        expect(flattened).toEqual({ backgroundColor: "blue", flex: 1, padding: 4 });
        expect(Object.keys(flattened).some((key) => /^\d+$/.test(key))).toBe(false);
    });
});
