import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("ListComponentScrollView (web)", () => {
    it("coalesces scroll callbacks behind requestAnimationFrame", () => {
        const source = readFileSync(join(import.meta.dir, "../../src/components/ListComponentScrollView.tsx"), "utf8");

        expect(source).toContain("const scrollEventRafRef = useRef<number | undefined>(undefined);");
        expect(source).toContain("scrollEventRafRef.current = requestAnimationFrame(() => {");
        expect(source).toContain("cancelAnimationFrame(scrollEventRafRef.current);");
    });
});
