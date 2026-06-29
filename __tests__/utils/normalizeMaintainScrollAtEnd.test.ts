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
            onFooterLayout: true,
            onItemLayout: true,
            onLayout: true,
        });
    });

    it("treats modifier-only object values as shorthand for all triggers", () => {
        expect(normalizeMaintainScrollAtEnd({ animated: true })).toEqual({
            animated: true,
            onDataChange: true,
            onFooterLayout: true,
            onItemLayout: true,
            onLayout: true,
        });
    });

    it("supports explicit on configs", () => {
        expect(normalizeMaintainScrollAtEnd({ animated: true, on: { layout: true } })).toEqual({
            animated: true,
            onDataChange: false,
            onFooterLayout: false,
            onItemLayout: false,
            onLayout: true,
        });
        expect(normalizeMaintainScrollAtEnd({ on: { layout: true } })).toEqual({
            animated: false,
            onDataChange: false,
            onFooterLayout: false,
            onItemLayout: false,
            onLayout: true,
        });
        expect(
            normalizeMaintainScrollAtEnd({ on: { dataChange: true, footerLayout: true, itemLayout: true } }),
        ).toEqual({
            animated: false,
            onDataChange: true,
            onFooterLayout: true,
            onItemLayout: true,
            onLayout: false,
        });
        expect(normalizeMaintainScrollAtEnd({ on: { dataChange: true, itemLayout: true } })).toEqual({
            animated: false,
            onDataChange: true,
            onFooterLayout: false,
            onItemLayout: true,
            onLayout: false,
        });
    });

    it("defaults object values without on to all triggers", () => {
        expect(normalizeMaintainScrollAtEnd({})).toEqual({
            animated: false,
            onDataChange: true,
            onFooterLayout: true,
            onItemLayout: true,
            onLayout: true,
        });
    });
});
