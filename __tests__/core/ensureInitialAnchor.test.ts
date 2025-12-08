import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { ensureInitialAnchor } from "../../src/core/ensureInitialAnchor";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("ensureInitialAnchor", () => {
    let ctx: StateContext;
    let state: InternalState;

    beforeEach(() => {
        ctx = createMockContext({
            containersDidLayout: true,
            headerSize: 0,
            stylePaddingTop: 0,
        });
    });

    it("requests an adjustment toward the desired anchor offset", () => {
        state = createMockState({
            initialAnchor: { attempts: 0, index: 1, settledTicks: 0, viewOffset: 10, viewPosition: 0.5 },
            positions: new Map([
                ["item_0", 0],
                ["item_1", 120],
                ["item_2", 260],
            ]),
            props: {
                data: [{ id: "a" }, { id: "b" }, { id: "c" }],
                keyExtractor: (_item: any, index: number) => `item_${index}`,
            },
            scroll: 20,
            scrollLength: 200,
            sizesKnown: new Map([["item_1", 60]]),
            totalSize: 600,
        });
        ctx.values.set("totalSize", state.totalSize);
        ctx.state = state;

        const adjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});

        ensureInitialAnchor(ctx);

        expect(adjustSpy).toHaveBeenCalledTimes(1);
        expect(adjustSpy).toHaveBeenCalledWith(ctx, 20);
        expect(state.initialAnchor?.attempts).toBe(1);
        expect(state.initialAnchor?.lastDelta).toBe(20);
        expect(state.initialAnchor?.settledTicks).toBe(0);

        adjustSpy.mockRestore();
    });

    it("clears the anchor once it has settled within tolerance", () => {
        state = createMockState({
            initialAnchor: { attempts: 1, index: 0, settledTicks: 1, viewOffset: 0, viewPosition: 0 },
            positions: new Map([["item_0", 40]]),
            props: {
                data: [{ id: "only" }],
                keyExtractor: (_item: any, index: number) => `item_${index}`,
            },
            scroll: 40.25,
            scrollLength: 200,
            sizesKnown: new Map([["item_0", 60]]),
            totalSize: 400,
        });
        ctx.values.set("totalSize", state.totalSize);
        ctx.state = state;

        const adjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});

        ensureInitialAnchor(ctx);

        expect(adjustSpy).not.toHaveBeenCalled();
        expect(state.initialAnchor).toBeUndefined();

        adjustSpy.mockRestore();
    });

    it("clamps the target offset when content is smaller than the viewport", () => {
        state = createMockState({
            initialAnchor: { attempts: 0, index: 1, settledTicks: 0, viewOffset: 0, viewPosition: 0 },
            positions: new Map([
                ["item_0", 0],
                ["item_1", 60],
            ]),
            props: {
                data: [{ id: "a" }, { id: "b" }],
                keyExtractor: (_item: any, index: number) => `item_${index}`,
            },
            scroll: 15,
            scrollLength: 200,
            sizesKnown: new Map([["item_1", 40]]),
            totalSize: 120,
        });
        ctx.values.set("totalSize", state.totalSize);
        ctx.state = state;

        const adjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});

        ensureInitialAnchor(ctx);

        expect(adjustSpy).toHaveBeenCalledTimes(1);
        expect(adjustSpy).toHaveBeenCalledWith(ctx, -15);
        expect(state.initialAnchor?.lastDelta).toBe(-15);

        adjustSpy.mockRestore();
    });
});
