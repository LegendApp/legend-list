import { describe, expect, it } from "bun:test";
import "../setup";

import { getAutoOtherAxisStyle } from "../../src/components/listComponentStyles";

describe("ListComponent", () => {
    it("returns measured height for horizontal lists that need cross-axis sizing", () => {
        expect(
            getAutoOtherAxisStyle({
                horizontal: true,
                needsOtherAxisSize: true,
                otherAxisSize: 200,
            }),
        ).toEqual({ height: 200 });
    });

    it("returns measured width for vertical lists that need cross-axis sizing", () => {
        expect(
            getAutoOtherAxisStyle({
                horizontal: false,
                needsOtherAxisSize: true,
                otherAxisSize: 320,
            }),
        ).toEqual({ width: 320 });
    });

    it("does not return an override when cross-axis sizing is not needed", () => {
        expect(
            getAutoOtherAxisStyle({
                horizontal: true,
                needsOtherAxisSize: false,
                otherAxisSize: 200,
            }),
        ).toBeUndefined();
    });

    it("does not return an override for missing or zero measured cross-axis size", () => {
        expect(
            getAutoOtherAxisStyle({
                horizontal: true,
                needsOtherAxisSize: true,
                otherAxisSize: undefined,
            }),
        ).toBeUndefined();

        expect(
            getAutoOtherAxisStyle({
                horizontal: false,
                needsOtherAxisSize: true,
                otherAxisSize: 0,
            }),
        ).toBeUndefined();
    });
});
