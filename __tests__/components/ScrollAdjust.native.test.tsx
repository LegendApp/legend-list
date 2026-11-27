import { describe, expect, it } from "bun:test";
import "../setup";

import { ScrollAdjust } from "@/components/ScrollAdjust";
import { StateProvider, useStateContext } from "@/state/state";
import { createMockState } from "../__mocks__/createMockState";
import { render } from "../helpers/testingLibrary";

function Setup({ horizontal }: { horizontal: boolean }) {
    const ctx = useStateContext();
    ctx.state = createMockState({ props: { horizontal } });
    ctx.values.set("scrollAdjust", 50);
    ctx.values.set("scrollAdjustUserOffset", 25);
    return <ScrollAdjust />;
}

describe("ScrollAdjust native axis", () => {
    it("uses top for vertical lists", () => {
        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup horizontal={false} />
            </StateProvider>,
        );

        const style = (toJSON() as any)?.props?.style;
        expect(style?.top).toBe(1_000_075);
        expect(style?.left).toBe(0);

        unmount();
    });

    it("keeps fractional adjustments when native layout stores the position as a 32-bit float", () => {
        function FractionalSetup() {
            const ctx = useStateContext();
            ctx.state = createMockState({ props: { horizontal: false } });
            ctx.values.set("scrollAdjust", -131.9);
            ctx.values.set("scrollAdjustUserOffset", 0);
            return <ScrollAdjust />;
        }
        const { toJSON, unmount } = render(
            <StateProvider>
                <FractionalSetup />
            </StateProvider>,
        );

        // Native layout rounds the position to float32, so the anchor must stay close to the requested adjustment.
        const top = (toJSON() as any)?.props?.style?.top;
        expect(Math.abs(Math.fround(top) - top)).toBeLessThan(0.05);

        unmount();
    });

    it("uses left for horizontal lists", () => {
        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup horizontal />
            </StateProvider>,
        );

        const style = (toJSON() as any)?.props?.style;
        expect(style?.left).toBe(1_000_075);
        expect(style?.top).toBe(0);

        unmount();
    });
});
