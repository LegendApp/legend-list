import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Containers (web)", () => {
    it("does not add outer horizontal negative margins for vertical multi-column gaps", () => {
        const source = readFileSync(join(import.meta.dir, "../../src/components/Containers.tsx"), "utf8");

        expect(source).not.toContain("style.marginLeft = style.marginRight");
    });
});
