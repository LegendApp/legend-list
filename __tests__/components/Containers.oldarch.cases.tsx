import { expect, it, mock } from "bun:test";
import "../setup";

import { StateProvider, set$, useStateContext } from "@/state/state";
import { createMockState } from "../__mocks__/createMockState";
import { act, render } from "../helpers/testingLibrary";

mock.module("@/constants-platform", () => ({ IsNewArchitecture: false }));
const { Containers } = await import("../../src/components/Containers.native?old-architecture");

it("keeps old-architecture content extent on the Animated update path", () => {
    let ctx: ReturnType<typeof useStateContext>;
    function Setup() {
        ctx = useStateContext();
        ctx.state = createMockState();
        ctx.values.set("numContainersPooled", 0);
        ctx.values.set("readyToRender", true);
        ctx.values.set("totalSize", 1000);
        return (
            <Containers
                freshDataTransitionEpoch={0}
                getRenderedItem={() => null}
                horizontal={false}
                recycleItems={false}
            />
        );
    }
    const { toJSON, unmount } = render(
        <StateProvider>
            <Setup />
        </StateProvider>,
    );
    const extent = () => (toJSON() as any).props.style.height.getValue();
    expect(extent()).toBe(1000);
    act(() => {
        set$(ctx!, "totalSize", 700);
        expect(extent()).toBe(700);
    });
    unmount();
});
