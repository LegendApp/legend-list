import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("PositionView (web)", () => {
    it("renders data-index on both regular and sticky div containers", () => {
        const source = readFileSync(join(import.meta.dir, "../../src/components/PositionView.tsx"), "utf8");
        const matches = source.match(/data-index=\{index\}/g) ?? [];

        expect(matches.length).toBe(2);
    });

    it("strips stickyHeaderConfig before spreading props onto div elements", () => {
        const source = readFileSync(join(import.meta.dir, "../../src/components/PositionView.tsx"), "utf8");

        expect(source).toContain("stickyHeaderConfig: _stickyHeaderConfig");
    });
});
