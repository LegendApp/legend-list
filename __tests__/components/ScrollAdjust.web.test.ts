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

    it("preserves the original temporary padding baseline across repeated adjustments", () => {
        const source = readFileSync(join(import.meta.dir, "../../src/components/ScrollAdjust.tsx"), "utf8");

        expect(source).toContain("resetPaddingBaselineRef");
        expect(source).not.toContain("ctx.state.props.stylePaddingBottom");
        expect(source).toContain("resetPaddingBaselineRef.current ?? contentNode.style[axis.paddingEndProp]");
        expect(source).toContain("resetPaddingBaselineRef.current = previousPaddingEnd");
        expect(source).toContain("resetPaddingBaselineRef.current = undefined");
        expect(source).toContain("contentNode.style[axis.paddingEndProp] = previousPaddingEnd");
    });
});
