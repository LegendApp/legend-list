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

    it("keeps unspecified triggers disabled for object values", () => {
        expect(normalizeMaintainScrollAtEnd({ animated: true })).toEqual({
            animated: true,
            onDataChange: false,
            onItemLayout: false,
            onLayout: false,
        });
    });

    it("preserves explicit trigger settings", () => {
        expect(normalizeMaintainScrollAtEnd({ onDataChange: false })).toEqual({
            animated: false,
            onDataChange: false,
            onItemLayout: false,
            onLayout: false,
        });
        expect(normalizeMaintainScrollAtEnd({ onLayout: true })).toEqual({
            animated: false,
            onDataChange: false,
            onItemLayout: false,
            onLayout: true,
        });
    });
});
