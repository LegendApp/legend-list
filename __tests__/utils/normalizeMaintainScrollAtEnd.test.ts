import { describe, expect, it } from "bun:test";
import "../setup";

import { normalizeMaintainScrollAtEnd } from "../../src/utils/normalizeMaintainScrollAtEnd";

describe("normalizeMaintainScrollAtEnd", () => {
    it("returns undefined for falsey values", () => {
        expect(normalizeMaintainScrollAtEnd(false)).toBeUndefined();
        expect(normalizeMaintainScrollAtEnd(undefined)).toBeUndefined();
    });

    it("enables all triggers for boolean true", () => {
        expect(normalizeMaintainScrollAtEnd(true)).toEqual({
            animated: false,
            onDataChange: true,
            onItemLayout: true,
            onLayout: true,
        });
    });

    it("enables unspecified triggers for object values", () => {
        expect(normalizeMaintainScrollAtEnd({ animated: true })).toEqual({
            animated: true,
            onDataChange: true,
            onItemLayout: true,
            onLayout: true,
        });
    });

    it("preserves explicit opt-outs", () => {
        expect(normalizeMaintainScrollAtEnd({ onDataChange: false })).toEqual({
            animated: false,
            onDataChange: false,
            onItemLayout: true,
            onLayout: true,
        });
        expect(normalizeMaintainScrollAtEnd({ onLayout: false })).toEqual({
            animated: false,
            onDataChange: true,
            onItemLayout: true,
            onLayout: false,
        });
    });
});
