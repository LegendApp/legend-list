import { describe, expect, it } from "bun:test";
import "../setup";

// The query keeps the setup's native alias for @/platform/StyleSheet from replacing the web module
async function loadWebStyleSheet() {
    const { StyleSheet } = await import("../../src/platform/StyleSheet?web-axis-shorthands");
    return StyleSheet;
}

describe("StyleSheet.flatten (web)", () => {
    it("writes React Native axis shorthands out per side, which the DOM understands", async () => {
        const StyleSheet = await loadWebStyleSheet();

        const style = StyleSheet.flatten([
            { marginHorizontal: 4, paddingHorizontal: 24 },
            { marginVertical: 2, paddingVertical: 16 },
        ]);

        expect(style).toEqual({
            marginBottom: 2,
            marginLeft: 4,
            marginRight: 4,
            marginTop: 2,
            paddingBottom: 16,
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 16,
        });
        expect("paddingHorizontal" in style).toBe(false);
        expect("paddingVertical" in style).toBe(false);
        expect("marginHorizontal" in style).toBe(false);
        expect("marginVertical" in style).toBe(false);
    });

    it("lets a side set on its own win over its axis, as in React Native", async () => {
        const StyleSheet = await loadWebStyleSheet();

        const style = StyleSheet.flatten({ padding: 4, paddingHorizontal: 24, paddingLeft: 8 });

        expect(style).toEqual({ padding: 4, paddingLeft: 8, paddingRight: 24 });
        // The sides come after padding, so they override it in CSS as the axis does in React Native
        expect(Object.keys(style)).toEqual(["padding", "paddingLeft", "paddingRight"]);
    });

    it("returns a style without axis shorthands unchanged", async () => {
        const StyleSheet = await loadWebStyleSheet();
        const style = { padding: "8px 16px" };

        expect(StyleSheet.flatten(style)).toBe(style);
        expect(StyleSheet.flatten(undefined)).toBeUndefined();
    });

    it("does not change the style it was given", async () => {
        const StyleSheet = await loadWebStyleSheet();
        const style = { paddingHorizontal: 24 };

        StyleSheet.flatten(style);

        expect(style).toEqual({ paddingHorizontal: 24 });
    });
});
