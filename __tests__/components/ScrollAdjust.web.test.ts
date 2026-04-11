import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("ScrollAdjust (web)", () => {
    it("handles horizontal adjust bookkeeping on the x axis", () => {
        const source = readFileSync(join(import.meta.dir, "../../src/components/ScrollAdjust.tsx"), "utf8");

        expect(source).toContain('contentSizeKey: "scrollWidth"');
        expect(source).toContain('paddingEndProp: "paddingRight"');
        expect(source).toContain('viewportSizeKey: "clientWidth"');
        expect(source).toContain("scrollView.scrollBy(axis.x * scrollDelta, axis.y * scrollDelta)");
    });
});
