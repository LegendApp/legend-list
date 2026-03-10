import * as React from "react";

import { afterEach, describe, expect, it, spyOn } from "bun:test";
import TestRenderer, { act } from "react-test-renderer";

import * as stateModule from "@/state/state";

describe("PositionView (web)", () => {
    let useArrSpy: ReturnType<typeof spyOn>;

    afterEach(() => {
        useArrSpy?.mockRestore();
    });

    it("renders the regular container with data-index and positioned style", async () => {
        const { PositionView } = await import("../../src/components/PositionView.tsx?positionview-web-regular");
        useArrSpy = spyOn(stateModule, "useArr$").mockReturnValue([120] as never);
        const refView = React.createRef<HTMLDivElement>();

        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(
                React.createElement(
                    PositionView,
                    {
                        horizontal: false,
                        id: 3,
                        index: 7,
                        refView,
                        style: { opacity: 0.5 },
                    },
                    "body",
                ),
            );
        });
        const tree = renderer.toJSON() as TestRenderer.ReactTestRendererJSON;

        expect(useArrSpy).toHaveBeenCalledWith(["containerPosition3"]);
        expect(tree.type).toBe("div");
        expect(tree.props["data-index"]).toBe(7);
        expect(tree.props.style).toMatchObject({
            contain: "paint layout style",
            opacity: 0.5,
            top: 120,
        });

        act(() => {
            renderer.unmount();
        });
    });

    it("renders the sticky container with the active sticky offset and data-index", async () => {
        const { PositionViewSticky } = await import("../../src/components/PositionView.tsx?positionview-web-sticky");
        useArrSpy = spyOn(stateModule, "useArr$").mockReturnValue([64, 2] as never);
        const refView = React.createRef<HTMLDivElement>();

        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(
                React.createElement(
                    PositionViewSticky,
                    {
                        horizontal: false,
                        id: 4,
                        index: 2,
                        refView,
                        stickyHeaderConfig: { offset: 12 },
                        style: { opacity: 0.75, transform: "translateY(10px)" },
                    },
                    "sticky",
                ),
            );
        });
        const tree = renderer.toJSON() as TestRenderer.ReactTestRendererJSON;

        expect(useArrSpy).toHaveBeenCalledWith(["containerPosition4", "activeStickyIndex"]);
        expect(tree.type).toBe("div");
        expect(tree.props["data-index"]).toBe(2);
        expect(tree.props.style).toMatchObject({
            contain: "paint layout style",
            opacity: 0.75,
            position: "sticky",
            top: 12,
            zIndex: 1002,
        });
        expect(tree.props.style.transform).toBeUndefined();

        act(() => {
            renderer.unmount();
        });
    });
});
