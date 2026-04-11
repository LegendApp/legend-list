import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Container (web)", () => {
    it("uses web CSS padding keys and border-box sizing for gap spacing", () => {
        const source = readFileSync(join(import.meta.dir, "../../src/components/Container.tsx"), "utf8");

        expect(source).toContain("paddingLeft: numColumns > 1 ? (columnGap || gap || 0) / 2 : undefined");
        expect(source).toContain("paddingRight: numColumns > 1 ? (columnGap || gap || 0) / 2 : undefined");
        expect(source).toContain("paddingTop: numColumns > 1 ? (rowGap || gap || 0) / 2 : undefined");
        expect(source).toContain("paddingBottom: numColumns > 1 ? (rowGap || gap || 0) / 2 : undefined");
        expect(source).toContain('boxSizing: paddingStyles ? "border-box" : undefined');
    });
});
