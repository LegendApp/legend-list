// Replays the iPhone trace of a shrink under anchored end space, in points: UIKit clamps the offset
// to the content it holds against the inset it has applied, and the shift is reported in pixels.
// Collapse splits one layout at the extents where the closed trace emitted native scroll events.
import * as React from "react";

import { beforeEach, expect, it, mock } from "bun:test";
import "../setup";

import { StyleSheet, View } from "react-native";

import { installListRegistry, type ListCtx } from "../../examples-shared/layoutInvariants";
import { LegendList } from "../../src/components/LegendList";
import { batchItemSizeUpdates } from "../../src/core/updateItemSizes";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { peek$, type StateContext } from "../../src/state/state";
import { typedForwardRef } from "../../src/types.internal";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import TestRenderer, {
    act,
    type ReactTestRenderer,
    type ReactTestRendererJSON,
    type ReactTestRendererNode,
} from "../helpers/testRenderer";

const WIDTH = 402;
// iPhone trace in points. List measurements round down to eighths before Yoga snaps to the device grid.
const VIEWPORT = 686 + 2 / 3;
const FOOTER = 37;
const anchorTop = 1566.25;
const anchorHeight = 68.25;

let keyboardHeight = 0;

let scrollProps: any;
const Surface = React.forwardRef(function KeyboardSurface(props: any, ref: React.Ref<any>) {
    scrollProps = props;
    React.useImperativeHandle(ref, () => ({ measure: () => {}, scrollTo: () => {} }));
    return <>{props.children}</>;
});
mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: Surface,
    KeyboardController: { dismiss: () => Promise.resolve(), state: () => ({ height: keyboardHeight }) },
    useKeyboardHandler: () => {},
}));
mock.module("@legendapp/list/react-native", () => ({ internal: { typedForwardRef, useCombinedRef } }));
mock.module("@legendapp/list/reanimated", () => ({ AnimatedLegendList: LegendList }));

const uiJobs: Array<() => void> = [];
const uiFrameJobs: FrameRequestCallback[] = [];

function flushUIJobs() {
    const requestFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => uiFrameJobs.push(callback);
    try {
        for (const job of uiJobs.splice(0)) job();
    } finally {
        globalThis.requestAnimationFrame = requestFrame;
    }
}

beforeEach(() => {
    uiJobs.length = 0;
    uiFrameJobs.length = 0;
    registerReanimatedModuleMock({
        runOnUI:
            (fn: (...args: any[]) => void) =>
            (...args: any[]) =>
                uiJobs.push(() => fn(...args)),
        useAnimatedStyle: (updater: () => any) => ({
            get height() {
                return updater().height;
            },
            get minHeight() {
                return updater().minHeight;
            },
        }),
        useSharedValue: <T,>(initial: T) => React.useRef({ value: initial }).current,
        View: (props: any) => React.createElement("reanimated-view", props),
    });
});

const layoutEvent = (height: number) => ({ nativeEvent: { layout: { height, width: WIDTH, x: 0, y: 0 } } });

// The test renderer has no Yoga layout. Evaluate the fixture's vertical flow, with absolute rows
// positioned from the committed styles and animated minimums read after each UI job.
function readGeometry(json: ReactTestRendererJSON | ReactTestRendererJSON[] | null) {
    const tops = new Map<string, number>();
    const rootEnds: number[] = [];
    type FlowStyle = { gap?: number; rowGap?: number };
    function layout(nodes: ReactTestRendererNode[], top: number, parentStyle: FlowStyle, root = false): number {
        let cursor = top;
        let hasFlowChild = false;
        for (const node of nodes) {
            if (typeof node === "string") continue;
            const style = StyleSheet.flatten(node.props.style) ?? {};
            const absolute = style.position === "absolute";
            const gap = hasFlowChild ? (parentStyle.rowGap ?? parentStyle.gap ?? 0) : 0;
            const start = absolute ? top + (style.top ?? 0) : cursor + gap + (style.marginTop ?? 0);
            if (node.props.testID) tops.set(node.props.testID, start);
            const paddingTop = style.paddingTop ?? 0;
            const padding = paddingTop + (style.paddingBottom ?? 0);
            const childrenHeight = layout(node.children ?? [], start + paddingTop, style);
            const height = typeof style.height === "object" ? style.height.getValue() : style.height;
            if (!absolute) {
                hasFlowChild = true;
                cursor =
                    start +
                    Math.max(height ?? childrenHeight + padding, style.minHeight ?? 0, padding) +
                    (style.marginBottom ?? 0);
            }
            if (root) rootEnds.push(cursor);
        }
        return cursor - top;
    }
    const style = StyleSheet.flatten(scrollProps.contentContainerStyle);
    const paddingTop = style.paddingTop ?? 0;
    const height = layout(json ? [json].flat() : [], paddingTop, style, true) + paddingTop + (style.paddingBottom ?? 0);
    const floor = style.minHeight ?? 0;
    return {
        contentHeight: Math.max(floor, height),
        floor,
        height,
        rootEnds,
        tops,
    };
}

const rangeCases = [
    ["collapse", 376, 0],
    ["collapse", 684, 395],
    ["delete", 200, 0],
    ["delete", 200, 395],
] as const;
const spacerTraceCases = [
    ["collapse", 376, 0, true],
    ["delete", 200, 0, true],
    ["delete", 200, 395, true],
] as const;

for (const withFooter of [false, true]) {
    for (const [mutation, replyHeight, openHeight, spacerTrace] of [
        ...rangeCases,
        ...(withFooter ? spacerTraceCases : []),
    ]) {
        const trace = spacerTrace ? ", relative spacer capture" : "";
        it(`native range during ${mutation}, footer=${withFooter}, open=${!!openHeight}${trace}`, () => {
            keyboardHeight = openHeight;
            const { KeyboardAwareLegendList } =
                require("../../src/integrations/keyboard") as typeof import("../../src/integrations/keyboard");
            const lists = new Set<ListCtx>();
            const uninstallListRegistry = installListRegistry(lists);
            const sizes = new Map([
                ["prefix", anchorTop],
                ["anchor", anchorHeight],
                ["reply", replyHeight],
            ]);
            let data = ["prefix", "anchor", "reply"];
            const renderList = () => (
                <KeyboardAwareLegendList
                    anchoredEndSpace={{ anchorIndex: 1 }}
                    data={data}
                    drawDistance={anchorTop + VIEWPORT}
                    estimatedItemSize={100}
                    keyExtractor={(item: string) => item}
                    ListFooterComponent={withFooter ? <View testID="footer" /> : undefined}
                    ListFooterComponentStyle={{ height: FOOTER }}
                    recycleItems={false}
                    renderItem={({ item }) => <View testID={item} />}
                />
            );
            let renderer!: ReactTestRenderer;
            try {
                act(() => {
                    renderer = TestRenderer.create(renderList());
                });
                const list = [...lists][0] as StateContext;
                const measureRows = () =>
                    act(() => {
                        const views = renderer.root.findAll(
                            (node) =>
                                typeof node.type !== "string" &&
                                typeof node.props.id === "number" &&
                                !!node.props.refView,
                        );
                        batchItemSizeUpdates(() => {
                            for (const view of views) {
                                const key = peek$(list, `containerItemKey${view.props.id}`);
                                const size = key === undefined ? undefined : sizes.get(key);
                                if (size !== undefined) view.props.onLayout?.(layoutEvent(size));
                            }
                        });
                    });
                act(() => scrollProps.onLayout(layoutEvent(VIEWPORT)));
                if (withFooter) {
                    const footerLayout = renderer.root.find(
                        (node) =>
                            typeof node.type === "string" &&
                            node.children.some((child) => typeof child !== "string" && child.props.testID === "footer"),
                    );
                    act(() => footerLayout.props.onLayout(layoutEvent(FOOTER)));
                }
                measureRows();
                flushUIJobs();
                act(() => {
                    for (const job of uiFrameJobs.splice(0)) job(0);
                });

                const controllerInset = () =>
                    (scrollProps.contentInset?.bottom ?? 0) +
                    Math.min(VIEWPORT, Math.max(scrollProps.blankSpace?.value ?? 0, openHeight));
                act(() => scrollProps.onContentInsetChange?.({ bottom: controllerInset(), left: 0, right: 0, top: 0 }));
                const before = readGeometry(renderer.toJSON());
                act(() => scrollProps.onContentSizeChange?.(WIDTH, before.contentHeight));
                expect(before.tops.get("anchor")).toBe(anchorTop);
                if (withFooter) expect(before.tops.get("footer")).toBe(anchorTop + anchorHeight + replyHeight);
                const naturalEnd = anchorTop + anchorHeight + replyHeight + (withFooter ? FOOTER : 0);
                expect(before.contentHeight + controllerInset()).toBeCloseTo(
                    Math.max(naturalEnd + openHeight, anchorTop + VIEWPORT),
                );

                const lastKey = mutation === "collapse" ? "reply" : "anchor";
                // Closed delete starts at the offset left by the preceding collapse.
                const startOffset =
                    withFooter && mutation === "delete" && !openHeight
                        ? (spacerTrace ? 1548 : 1558) + 1 / 3
                        : anchorTop;
                let offset = startOffset;
                let appliedInset = controllerInset();
                const emitScroll = (content: number) =>
                    act(() =>
                        scrollProps.onScroll({
                            nativeEvent: {
                                contentInset: { bottom: appliedInset, left: 0, right: 0, top: 0 },
                                contentOffset: { x: 0, y: offset },
                                contentSize: { height: content, width: WIDTH },
                                layoutMeasurement: { height: VIEWPORT, width: WIDTH },
                            },
                        }),
                    );
                emitScroll(before.contentHeight);
                const applySize = (content: number) => {
                    const limit = Math.max(0, content + appliedInset - VIEWPORT);
                    if (offset > limit) {
                        offset = limit;
                        emitScroll(content);
                    }
                };
                let rowBottom = anchorTop + anchorHeight + replyHeight;
                let maxShiftPx = 0;
                let maxFooterGap = 0;
                let reportedHeight = before.contentHeight;
                const mount = () => {
                    const { contentHeight, tops } = readGeometry(renderer.toJSON());
                    expect(tops.get("anchor")).toBe(anchorTop);
                    expect(tops.get(lastKey)! + sizes.get(lastKey)!).toBe(rowBottom);
                    applySize(contentHeight);
                    if (contentHeight !== reportedHeight) {
                        reportedHeight = contentHeight;
                        act(() => scrollProps.onContentSizeChange?.(WIDTH, contentHeight));
                    }
                    maxShiftPx = Math.max(maxShiftPx, 3 * Math.abs(startOffset - offset));
                    if (withFooter) maxFooterGap = Math.max(maxFooterGap, Math.abs(tops.get("footer")! - rowBottom));
                };
                let previous = readGeometry(renderer.toJSON());
                const mountShrink = (split: boolean) => {
                    const next = readGeometry(renderer.toJSON());
                    if (split) {
                        // One layout publishes new leading flow children and the prior trailing contribution.
                        // Native scroll establishes this range; the intermediate shadow tree is inferred.
                        for (const [index, end] of next.rootEnds.slice(0, previous.rootEnds.length).entries()) {
                            const trailing = previous.height - previous.rootEnds[index];
                            const content = Math.max(Math.min(previous.floor, next.floor), end + trailing);
                            applySize(content);
                        }
                    }
                    mount();
                    flushUIJobs();
                    mount();
                    const wantedInset = controllerInset();
                    act(() => scrollProps.onContentInsetChange?.({ bottom: wantedInset, left: 0, right: 0, top: 0 }));
                    mount(); // The controller can report the desired inset before UIKit applies it.
                    appliedInset = wantedInset;
                    act(() => {
                        for (const job of uiFrameJobs.splice(0)) job(0);
                    });
                    mount();
                    previous = readGeometry(renderer.toJSON());
                };
                if (mutation === "collapse") {
                    // The closed trace emitted native-scroll at these three shrinking extents.
                    // Its later commits kept the resulting offset. The open capture had enough headroom throughout.
                    const steps = spacerTrace
                        ? ([
                              ...[374, 370, 365, 356 + 1 / 3, 346, 334, 300, 263].map(
                                  (height) => [height, true] as const,
                              ),
                              [200, false],
                          ] as const)
                        : openHeight
                          ? [[200, true] as const]
                          : ([
                                [374, true],
                                [373.625, false],
                                [370.375, true],
                                [365, false],
                                [357, true],
                                [200, false],
                            ] as const);
                    for (const [height, split] of steps) {
                        sizes.set("reply", height);
                        rowBottom = anchorTop + anchorHeight + height;
                        measureRows();
                        mountShrink(split);
                    }
                } else {
                    rowBottom = anchorTop + anchorHeight;
                    data = ["prefix", "anchor"];
                    act(() => renderer.update(renderList()));
                    mountShrink(true);
                }

                const rowAndFooterEnd = rowBottom + (withFooter ? FOOTER : 0);
                const after = readGeometry(renderer.toJSON());
                expect(after.contentHeight + appliedInset).toBeCloseTo(
                    Math.max(rowAndFooterEnd + openHeight, anchorTop + VIEWPORT),
                );
                expect(maxFooterGap).toBeLessThanOrEqual(1 / 3);
                console.log(
                    `native range: ${mutation} footer=${withFooter} open=${!!openHeight} shift=${maxShiftPx.toFixed(2)}px`,
                );
                expect(maxShiftPx).toBeLessThanOrEqual(2);
            } finally {
                act(() => renderer?.unmount());
                uninstallListRegistry();
            }
        });
    }
}
