import { expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

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
    let commits = 0;
    const { toJSON, unmount } = render(
        <StateProvider>
            <React.Profiler id="extent" onRender={() => commits++}>
                <Setup />
            </React.Profiler>
        </StateProvider>,
    );
    const extent = () => (toJSON() as any).props.style.height.getValue();
    expect(extent()).toBe(1000);
    act(() => {
        set$(ctx!, "totalSize", 700);
        expect(extent()).toBe(700);
    });
    for (const size of [600, 500, 400]) act(() => set$(ctx!, "totalSize", size));
    expect(extent()).toBe(400);
    expect(commits).toBe(1);
    unmount();
});

it("does not wrap the old-architecture layer in an integration's content extent", () => {
    let wrapped = false;
    function ContentExtent({ children }: { children: React.ReactNode }) {
        wrapped = true;
        return <>{children}</>;
    }
    function Setup() {
        const ctx = useStateContext();
        // Set up once, so a re-render doesn't reset the store's values.
        if (!ctx.state) {
            ctx.state = createMockState({ props: { contentExtentComponentInternal: ContentExtent } as any });
            ctx.values.set("numContainersPooled", 0);
            ctx.values.set("readyToRender", true);
            ctx.values.set("totalSize", 1000);
        }
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
    // The wrapper relies on Fabric commit ordering, so old architecture keeps its Animated extent.
    expect(wrapped).toBe(false);
    expect((toJSON() as any).props.style.height.getValue()).toBe(1000);
    unmount();
});
