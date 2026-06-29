import * as React from "react";

import { describe, expect, it } from "bun:test";
import "../setup";

import { updateItemSizes } from "../../src/core/updateItemSizes";
import { type StateContext, StateProvider, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import { setLayoutValue } from "../helpers/layoutArrays";
import TestRenderer, { act } from "../helpers/testRenderer";

let currentCtx: StateContext | undefined;

function StateSetup({ activeStickyIndex, children }: { activeStickyIndex?: number; children: React.ReactNode }) {
    const ctx = useStateContext();
    ctx.values.set("containerPosition0", 32);
    ctx.values.set("activeStickyIndex", activeStickyIndex);
    return children;
}

function ReplacementMeasurementSetup({ children }: { children: React.ReactNode }) {
    const ctx = useStateContext();
    const didSetupRef = React.useRef(false);
    currentCtx = ctx;

    if (!didSetupRef.current) {
        const data = Array.from({ length: 5 }, (_, index) => ({ id: index }));
        const state = createMockState({
            didContainersLayout: true,
            endBuffered: 4,
            endNoBuffer: 4,
            lastLayout: { height: 300, width: 400, x: 0, y: 0 },
            props: {
                data,
                drawDistance: 0,
                estimatedItemSize: 100,
            },
            queuedInitialLayout: true,
            scrollLength: 300,
            startBuffered: 0,
            startNoBuffer: 0,
            totalSize: 500,
            userScrollAnchorReset: {
                keys: new Set(["item_0", "item_1", "item_2", "item_3", "item_4"]),
            },
        });

        for (let index = 0; index < data.length; index++) {
            const itemKey = `item_${index}`;
            state.idCache[index] = itemKey;
            state.indexByKey.set(itemKey, index);
            state.sizes.set(itemKey, 100);
            state.sizesKnown.set(itemKey, 100);
            state.containerItemKeys.set(itemKey, index);
            setLayoutValue(state, "positions", itemKey, index * 100);
            ctx.values.set(`containerItemKey${index}`, itemKey);
            ctx.values.set(`containerPosition${index}`, index * 100);
        }

        ctx.state = state;
        ctx.values.set("numContainers", data.length);
        ctx.values.set("numContainersPooled", data.length);
        ctx.values.set("otherAxisSize", 400);
        ctx.values.set("totalSize", 500);
        didSetupRef.current = true;
    }

    return children;
}

describe("PositionView (web)", () => {
    it("renders regular container DOM props without leaking RN-only props", async () => {
        const refView = React.createRef<HTMLDivElement>();
        const { PositionView } = await import("../../src/components/PositionView?web-regular-render");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        act(() => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <StateSetup>
                        <PositionView
                            animatedScrollY={{}}
                            horizontal={false}
                            id={0}
                            index={3}
                            onLayout={() => {}}
                            onLayoutChange={() => {}}
                            refView={refView}
                            stickyHeaderConfig={{ offset: 10 }}
                            style={{ width: 100 }}
                        >
                            <span>child</span>
                        </PositionView>
                    </StateSetup>
                </StateProvider>,
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

    it("rerenders with recalculated positions before the next animation frame", async () => {
        const refView = React.createRef<HTMLDivElement>();
        const { PositionView } = await import("../../src/components/PositionView?web-replacement-measurement");
        const rafCallbacks: FrameRequestCallback[] = [];
        const originalRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        }) as typeof requestAnimationFrame;
        currentCtx = undefined;

        try {
            let renderer: TestRenderer.ReactTestRenderer | undefined;
            act(() => {
                renderer = TestRenderer.create(
                    <StateProvider>
                        <ReplacementMeasurementSetup>
                            <PositionView horizontal={false} id={1} index={1} refView={refView} style={{}}>
                                {null}
                            </PositionView>
                        </ReplacementMeasurementSetup>
                    </StateProvider>,
                );
            });

            expect(renderer!.root.findByType("div").props.style.top).toBe(100);

            act(() => {
                updateItemSizes(currentCtx!, { itemKey: "item_0", size: { height: 150, width: 400 } });
            });

            expect(rafCallbacks).toHaveLength(0);
            expect(currentCtx!.values.get("containerPosition1")).toBe(150);
            expect(renderer!.root.findByType("div").props.style.top).toBe(150);

            act(() => {
                renderer?.unmount();
            });
        } finally {
            globalThis.requestAnimationFrame = originalRaf;
        }
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
                    <StateProvider>
                        <StateSetup>
                            <PositionView horizontal={false} id={0} index={3} refView={refView} style={{ width: 100 }}>
                                {null}
                            </PositionView>
                        </StateSetup>
                    </StateProvider>,
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
                <StateProvider>
                    <StateSetup activeStickyIndex={4}>
                        <PositionViewSticky
                            animatedScrollY={{}}
                            horizontal={false}
                            id={0}
                            index={4}
                            onLayout={() => {}}
                            onLayoutChange={() => {}}
                            refView={refView}
                            stickyHeaderConfig={{ offset: 10 }}
                            style={{ transform: "translateY(10px)", width: 100 } as React.CSSProperties}
                        >
                            <span>sticky</span>
                        </PositionViewSticky>
                    </StateSetup>
                </StateProvider>,
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
        const Backdrop = () => <span>backdrop</span>;

        act(() => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <StateSetup activeStickyIndex={4}>
                        <PositionViewSticky
                            horizontal={false}
                            id={0}
                            index={4}
                            refView={refView}
                            stickyHeaderConfig={{ backdropComponent: Backdrop, offset: 10 }}
                            style={{ width: 100 } as React.CSSProperties}
                        >
                            <span>sticky</span>
                        </PositionViewSticky>
                    </StateSetup>
                </StateProvider>,
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
