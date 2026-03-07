import { describe, expect, it } from "bun:test";
import "../setup";

import { checkStructuralDataChange } from "../../src/core/checkStructuralDataChange";
import { createMockState } from "../__mocks__/createMockState";

describe("checkStructuralDataChange", () => {
    it("returns false when the key sequence is unchanged", () => {
        const previousData = [{ id: "item-1" }, { id: "item-2" }];
        const nextData = [{ id: "item-1" }, { id: "item-2" }];
        const state = createMockState({
            idCache: ["item-1", "item-2"],
            props: {
                data: previousData,
                keyExtractor: (item: { id: string }) => item.id,
            },
        });

        expect(checkStructuralDataChange(state, nextData, previousData)).toBe(false);
    });

    it("returns true when the key sequence changes", () => {
        const previousData = [{ id: "item-1" }, { id: "item-2" }];
        const nextData = [{ id: "item-2" }, { id: "item-3" }];
        const state = createMockState({
            idCache: ["item-1", "item-2"],
            props: {
                data: previousData,
                keyExtractor: (item: { id: string }) => item.id,
            },
        });

        expect(checkStructuralDataChange(state, nextData, previousData)).toBe(true);
    });

    it("returns false for the same array reference when the cached key sequence is unchanged", () => {
        const data = [{ id: "item-1" }, { id: "item-2" }];
        const state = createMockState({
            idCache: ["item-1", "item-2"],
            props: {
                data,
                keyExtractor: (item: { id: string }) => item.id,
            },
        });

        expect(checkStructuralDataChange(state, data, data)).toBe(false);
    });

    it("returns true for the same array reference when the cached key sequence changes", () => {
        const data = [{ id: "item-1" }, { id: "item-2" }];
        const state = createMockState({
            idCache: ["item-1", "item-2"],
            props: {
                data,
                keyExtractor: (item: { id: string }) => item.id,
            },
        });

        data.splice(0, data.length, { id: "item-2" }, { id: "item-3" });

        expect(checkStructuralDataChange(state, data, data)).toBe(true);
    });

    it("returns true for the same array reference when the cached length changes", () => {
        const data = [{ id: "item-1" }, { id: "item-2" }];
        const state = createMockState({
            idCache: ["item-1", "item-2"],
            props: {
                data,
                keyExtractor: (item: { id: string }) => item.id,
            },
        });

        data.push({ id: "item-3" });

        expect(checkStructuralDataChange(state, data, data)).toBe(true);
    });

    it("returns false for the same array reference without a keyExtractor when the cached length is unchanged", () => {
        const data = [{ id: "item-1" }];
        const state = createMockState({
            idCache: ["0"],
            props: {
                data,
                keyExtractor: undefined,
            },
        });

        expect(checkStructuralDataChange(state, data, data)).toBe(false);
    });

    it("treats same-length immutable updates without a keyExtractor as structural changes", () => {
        const previousData = [{ id: "item-1" }];
        const nextData = [{ id: "item-2" }];
        const state = createMockState({
            props: {
                data: previousData,
                keyExtractor: undefined,
            },
        });

        expect(checkStructuralDataChange(state, nextData, previousData)).toBe(true);
    });
});
