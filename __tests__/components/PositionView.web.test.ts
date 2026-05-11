import * as React from "react";

import { describe, expect, it } from "bun:test";
import "../setup";

import { StateProvider, useStateContext } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";

function StateSetup({ activeStickyIndex, children }: { activeStickyIndex?: number; children: React.ReactNode }) {
    const ctx = useStateContext();
    ctx.values.set("containerPosition0", 32);
    ctx.values.set("activeStickyIndex", activeStickyIndex);
    return children;
}

describe("PositionView (web)", () => {
    it("renders regular container DOM props without leaking RN-only props", async () => {
        const refView = React.createRef<HTMLDivElement>();
        const { PositionView } = await import("../../src/components/PositionView?web-regular-render");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        act(() => {
            renderer = TestRenderer.create(
                React.createElement(
                    StateProvider,
                    null,
                    React.createElement(
                        StateSetup,
                        null,
                        React.createElement(
                            PositionView,
                            {
                                animatedScrollY: {},
                                horizontal: false,
                                id: 0,
                                index: 3,
                                onLayout: () => {},
                                onLayoutChange: () => {},
                                refView,
                                stickyHeaderConfig: { offset: 10 },
                                style: { width: 100 },
                            },
                            React.createElement("span", null, "child"),
                        ),
                    ),
                ),
            );
        });

        const div = renderer!.root.findByType("div");
        expect(div.props["data-index"]).toBe(3);
        expect(div.props.style).toMatchObject({
            contain: "paint layout style",
            top: 32,
            width: 100,
        });
        expect(div.props.style.display).toBeUndefined();
        expect(div.props.style.flexDirection).toBeUndefined();
        expect(div.props.animatedScrollY).toBeUndefined();
        expect(div.props.onLayout).toBeUndefined();
        expect(div.props.onLayoutChange).toBeUndefined();
        expect(div.props.stickyHeaderConfig).toBeUndefined();

        act(() => {
            renderer?.unmount();
        });
    });

    it("uses React Native Web flex defaults when the RNW stylesheet is present", async () => {
        const refView = React.createRef<HTMLDivElement>();
        const originalDocument = globalThis.document;
        (globalThis as any).document = {
            getElementById: (id: string) => (id === "react-native-stylesheet" ? {} : null),
        };

        try {
            const { PositionView } = await import("../../src/components/PositionView?web-rnw-flex-render");
            let renderer: TestRenderer.ReactTestRenderer | undefined;

            act(() => {
                renderer = TestRenderer.create(
                    React.createElement(
                        StateProvider,
                        null,
                        React.createElement(
                            StateSetup,
                            null,
                            React.createElement(PositionView, {
                                horizontal: false,
                                id: 0,
                                index: 3,
                                refView,
                                style: { width: 100 },
                            }),
                        ),
                    ),
                );
            });

            const div = renderer!.root.findByType("div");
            expect(div.props.style).toMatchObject({
                contain: "paint layout style",
                display: "flex",
                flexDirection: "column",
                top: 32,
                width: 100,
            });

            act(() => {
                renderer?.unmount();
            });
        } finally {
            if (originalDocument) {
                globalThis.document = originalDocument;
            } else {
                delete (globalThis as any).document;
            }
        }
    });

    it("renders sticky container DOM props without leaking RN-only props", async () => {
        const refView = React.createRef<HTMLDivElement>();
        const { PositionViewSticky } = await import("../../src/components/PositionView?web-sticky-render");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        act(() => {
            renderer = TestRenderer.create(
                React.createElement(
                    StateProvider,
                    null,
                    React.createElement(
                        StateSetup,
                        { activeStickyIndex: 4 },
                        React.createElement(
                            PositionViewSticky,
                            {
                                animatedScrollY: {},
                                horizontal: false,
                                id: 0,
                                index: 4,
                                onLayout: () => {},
                                onLayoutChange: () => {},
                                refView,
                                stickyHeaderConfig: { offset: 10 },
                                style: { transform: "translateY(10px)", width: 100 } as React.CSSProperties,
                            },
                            React.createElement("span", null, "sticky"),
                        ),
                    ),
                ),
            );
        });

        const div = renderer!.root.findByType("div");
        expect(div.props["data-index"]).toBe(4);
        expect(div.props.style).toMatchObject({
            contain: "paint layout style",
            position: "sticky",
            top: 10,
            width: 100,
            zIndex: 1004,
        });
        expect(div.props.style.transform).toBeUndefined();
        expect(div.props.animatedScrollY).toBeUndefined();
        expect(div.props.onLayout).toBeUndefined();
        expect(div.props.onLayoutChange).toBeUndefined();
        expect(div.props.stickyHeaderConfig).toBeUndefined();

        act(() => {
            renderer?.unmount();
        });
    });

    it("renders a sticky header backdrop on web", async () => {
        const refView = React.createRef<HTMLDivElement>();
        const { PositionViewSticky } = await import("../../src/components/PositionView?web-sticky-backdrop-render");
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        const Backdrop = () => React.createElement("span", null, "backdrop");

        act(() => {
            renderer = TestRenderer.create(
                React.createElement(
                    StateProvider,
                    null,
                    React.createElement(
                        StateSetup,
                        { activeStickyIndex: 4 },
                        React.createElement(
                            PositionViewSticky,
                            {
                                horizontal: false,
                                id: 0,
                                index: 4,
                                refView,
                                stickyHeaderConfig: { backdropComponent: Backdrop, offset: 10 },
                                style: { width: 100 } as React.CSSProperties,
                            },
                            React.createElement("span", null, "sticky"),
                        ),
                    ),
                ),
            );
        });

        const spans = renderer!.root.findAllByType("span");
        expect(spans.map((span) => span.props.children)).toEqual(["backdrop", "sticky"]);

        const backdropWrapper = renderer!.root.findAllByType("div")[1];
        expect(backdropWrapper.props.style).toMatchObject({
            inset: 0,
            pointerEvents: "none",
            position: "absolute",
        });

        act(() => {
            renderer?.unmount();
        });
    });
});
