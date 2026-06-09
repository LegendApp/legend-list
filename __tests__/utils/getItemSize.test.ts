import { beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { getItemSize } from "../../src/utils/getItemSize";
import { createMockContext } from "../__mocks__/createMockContext";

describe("getItemSize", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    const callGetItemSize = (
        key: string,
        index: number,
        data: any,
        useAverageSize?: boolean,
        preferCachedSize?: boolean,
    ) => getItemSize(mockCtx, key, index, data, useAverageSize, preferCachedSize);

    beforeEach(() => {
        mockCtx = createMockContext(
            { scrollingTo: undefined },
            {
                averageSizes: { "": { avg: 80, num: 1 } },
                props: {
                    estimatedItemSize: 50,
                },
            },
        );
        mockState = mockCtx.state;
    });

    it("returns known measured size without mutating the rendered size cache", () => {
        mockState.sizesKnown.set("item_0", 75);

        const result = callGetItemSize("item_0", 0, { id: 0 });

        expect(result).toBe(75);
        expect(mockState.sizes.has("item_0")).toBe(false);
    });

    it("returns cached rendered size before falling back to estimatedItemSize", () => {
        mockState.sizes.set("item_0", 65);

        const result = callGetItemSize("item_0", 0, { id: 0 });

        expect(result).toBe(65);
    });

    it("uses cached rendered size before fixed size when preferred", () => {
        mockState.sizes.set("item_0", 90);
        mockState.props.getFixedItemSize = () => 150;

        const result = callGetItemSize("item_0", 0, { id: 0 }, false, true);

        expect(result).toBe(90);
        expect(mockState.sizesKnown.has("item_0")).toBe(false);
    });

    it("uses fixed size as authoritative and promotes it to known size", () => {
        mockState.sizes.set("item_0", 90);
        mockState.props.getFixedItemSize = () => 150;

        const result = callGetItemSize("item_0", 0, { id: 0 });

        expect(result).toBe(150);
        expect(mockState.sizesKnown.get("item_0")).toBe(150);
        expect(mockState.sizes.get("item_0")).toBe(150);
    });

    it("falls back to cached rendered size when fixed size returns undefined", () => {
        mockState.sizes.set("item_0", 90);
        mockState.props.getFixedItemSize = () => undefined;

        const result = callGetItemSize("item_0", 0, { id: 0 });

        expect(result).toBe(90);
    });

    it("uses type-specific average size when requested", () => {
        mockState.props.getItemType = (item: { type?: string }) => item.type ?? "";
        mockState.averageSizes = {
            "": { avg: 80, num: 1 },
            large: { avg: 120, num: 1 },
        };

        const result = callGetItemSize("item_0", 0, { id: 0, type: "large" }, true);

        expect(result).toBe(120);
        expect(mockState.sizes.get("item_0")).toBe(120);
    });

    it("uses frozen average size snapshot while scrolling to a target", () => {
        mockState.scrollingTo = { averageSizeSnapshot: { "": 72 }, index: 0, offset: 0 } as any;

        const result = callGetItemSize("item_0", 0, { id: 0 }, true);

        expect(result).toBe(72);
        expect(mockState.sizes.get("item_0")).toBe(72);
    });

    it("reuses rendered size while scrolling when no snapshot average exists", () => {
        mockState.sizes.set("item_0", 90);
        mockState.scrollingTo = { averageSizeSnapshot: {}, index: 0, offset: 0 } as any;

        const result = callGetItemSize("item_0", 0, { id: 0 }, true);

        expect(result).toBe(90);
    });

    it("falls back to static estimatedItemSize when no other size source exists", () => {
        const result = callGetItemSize("item_0", 0, { id: 0 });

        expect(result).toBe(50);
        expect(mockState.sizes.get("item_0")).toBe(50);
    });

    it("uses static estimatedItemSize when average sizing is disabled", () => {
        const result = callGetItemSize("item_0", 0, { id: 0 }, false);

        expect(result).toBe(50);
        expect(mockState.sizes.get("item_0")).toBe(50);
    });

    it("handles explicit zero known size", () => {
        mockState.sizesKnown.set("item_0", 0);

        const result = callGetItemSize("item_0", 0, { id: 0 });

        expect(result).toBe(0);
    });
});
