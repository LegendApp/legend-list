import { describe, expect, it, mock } from "bun:test";
import "../setup";

import { useRecyclingEffect, useRecyclingState } from "../../src/state/ContextContainer";
import TestRenderer, { act } from "../helpers/testRenderer";

describe("recycling hooks outside of a LegendList", () => {
    it("useRecyclingEffect does not crash and never fires", () => {
        const effect = mock(() => {});

        function Probe() {
            useRecyclingEffect(effect);
            return null;
        }

        expect(() => {
            act(() => {
                TestRenderer.create(<Probe />);
            });
        }).not.toThrow();
        expect(effect).not.toHaveBeenCalled();
    });

    it("useRecyclingState does not crash and returns the initial value", () => {
        let value: number | undefined;

        function Probe() {
            [value] = useRecyclingState(() => 42);
            return null;
        }

        expect(() => {
            act(() => {
                TestRenderer.create(<Probe />);
            });
        }).not.toThrow();
        expect(value).toBe(42);
    });
});
