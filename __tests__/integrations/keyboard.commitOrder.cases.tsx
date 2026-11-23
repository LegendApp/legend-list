import * as React from "react";

import { beforeEach, expect, it, mock } from "bun:test";
import "../setup";

import { StyleSheet, View } from "react-native";

import { installListRegistry, type ListCtx } from "../../examples-shared/layoutInvariants";
import { LegendList } from "../../src/components/LegendList";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import type { StateContext } from "../../src/state/state";
import { typedForwardRef } from "../../src/types.internal";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import { layoutEvent, measureFooter, measureMountedRows } from "../helpers/keyboardLayout";
import TestRenderer, {
    act,
    type ReactTestRenderer,
    type ReactTestRendererJSON,
    type ReactTestRendererNode,
} from "../helpers/testRenderer";

const WIDTH = 402;
const models = ["extent-first", "inset-first", "react-reset", "react-first", "layer-first", "split-mount"] as const;
type Model = "default" | (typeof models)[number];

const itFailing = (it as typeof it & { failing: typeof it }).failing;
let model: Model = "default";
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
mock.module("@legendapp/list/react-native", () => ({
    internal: {
        typedForwardRef,
        useCombinedRef,
    },
}));
mock.module("@legendapp/list/reanimated", () => ({ AnimatedLegendList: LegendList }));

const createSharedValue = <T,>(initial: T) => {
    let current = initial;
    return {
        get: () => current,
        set: (next: T) => {
            current = next;
        },
        get value() {
            return current;
        },
        set value(next: T) {
            current = next;
        },
    };
};

const uiJobs: Array<() => void> = [];
const uiFrames: FrameRequestCallback[] = [];
const jsJobs: Array<() => void> = [];
type Dimensions = { height?: number; minHeight?: number };
type AnimatedStyle = { initial: Dimensions; applied: Dimensions; update: () => Dimensions; stale: boolean };
const animatedStyles = new Map<object, AnimatedStyle>();

function runUI(run: () => void) {
    const requestFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => uiFrames.push(callback);
    try {
        run();
    } finally {
        globalThis.requestAnimationFrame = requestFrame;
    }
    for (const style of animatedStyles.values()) {
        style.applied = style.update();
        style.stale = false;
    }
}

function flushUIJobs() {
    runUI(() => {
        for (const job of uiJobs.splice(0)) job();
    });
}

function runUIFrame() {
    runUI(() => {
        for (const frame of uiFrames.splice(0)) frame(0);
    });
}

function flushJSJobs() {
    if (!jsJobs.length) return;
    act(() => {
        for (const job of jsJobs.splice(0)) job();
    });
}

beforeEach(() => {
    uiJobs.length = 0;
    uiFrames.length = 0;
    jsJobs.length = 0;
    animatedStyles.clear();
    model = "default";
    keyboardHeight = 0;
    registerReanimatedModuleMock({
        runOnJS:
            (fn: (...args: any[]) => void) =>
            (...args: any[]) =>
                jsJobs.push(() => fn(...args)),
        runOnUI:
            (fn: (...args: any[]) => void) =>
            (...args: any[]) =>
                uiJobs.push(() => fn(...args)),
        useAnimatedStyle: (update: () => Dimensions) => {
            const ref = React.useRef<{ record: AnimatedStyle; style: Dimensions }>(undefined);
            if (!ref.current) {
                const initial = update();
                const record = { applied: initial, initial, stale: false, update };
                const read = () => {
                    if (model === "react-reset") return record.applied;
                    return record.stale ? {} : record.update();
                };
                const style = {
                    get height() {
                        return read().height;
                    },
                    get minHeight() {
                        return read().minHeight;
                    },
                };
                animatedStyles.set(style, record);
                ref.current = { record, style };
            }
            ref.current.record.update = update;
            return ref.current.style;
        },
        useSharedValue: <T,>(initial: T) => React.useRef(createSharedValue(initial)).current,
        View: function ReanimatedView(props: any) {
            const styles = [props.style].flat(Number.POSITIVE_INFINITY);
            const style =
                model === "react-first"
                    ? JSON.stringify(styles.filter((entry) => !animatedStyles.has(entry)))
                    : props.style;
            const previous = React.useRef(style);
            if (previous.current !== style) {
                for (const entry of styles) {
                    const record = animatedStyles.get(entry);
                    if (record && model === "react-reset") record.applied = record.initial;
                    if (record && model === "react-first") record.stale = true;
                }
            }
            previous.current = style;
            return React.createElement("reanimated-view", props);
        },
    });
});

// The test renderer has no Yoga layout. Evaluate the fixture's vertical flow, with absolute rows
// positioned from the committed styles and animated minimums read after each UI job.
function readGeometry(json: ReactTestRendererJSON | ReactTestRendererJSON[] | null, layerOnly = false) {
    const tops = new Map<string, number>();
    const childEnds: number[] = [];
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
                    Math.max(
                        height ?? childrenHeight + padding,
                        layerOnly && typeof style.height === "object" ? 0 : (style.minHeight ?? 0),
                        padding,
                    ) +
                    (style.marginBottom ?? 0);
            }
            if (root) childEnds.push(cursor);
        }
        return cursor - top;
    }
    const style = StyleSheet.flatten(scrollProps.contentContainerStyle);
    const paddingTop = style.paddingTop ?? 0;
    const flowEnd =
        paddingTop + layout(json ? [json].flat() : [], paddingTop, style, true) + (style.paddingBottom ?? 0);
    const floor = style.minHeight ?? 0;
    return { childEnds, contentHeight: Math.max(flowEnd, floor), floor, flowEnd, tops };
}

const collapseSteps = [374, 369, 363, 355, 344, 331, 316, 298, 279, 266, 247, 236, 225, 215, 208, 203, 200];
type Action = "collapse" | "delete";
type Scenario = readonly [Action, number, number, number?];

function testShrink(order: Model, withFooter: boolean, rowGap: number, scenario: Scenario, overlap = false) {
    const [mutation, replyHeight, openHeight, collapseHeight] = scenario;
    const split = order === "split-mount";
    const sol = order === "extent-first" || order === "inset-first";
    const fable = order === "react-first" || order === "layer-first";
    const traced = sol || split;
    const viewport = split ? 686 + 2 / 3 : sol ? 687 : 600;
    const footerSize = traced ? 37 : 40;
    const anchorSize = split ? 68.25 : sol ? 68 : 100;
    const anchorTop = split ? 1566.25 : sol ? 1566 : fable || replyHeight < viewport ? 40 : 300;
    const name = `footer=${withFooter}, gap=${rowGap}, reply=${replyHeight}, keyboard=${openHeight}, target=${collapseHeight ?? (mutation === "collapse" ? 200 : 0)}`;
    // The iOS clamp preceded the first release job by 4–7 ms. Keep the early-release
    // replay as a counterfactual, including the matching footer-off controls.
    const test = order === "extent-first" && withFooter && (mutation === "delete" || !openHeight) ? itFailing : it;
    test(`${overlap ? "overlapping frames" : order}: ${mutation} keeps the anchor and content end together (${name})`, () => {
        model = order;
        keyboardHeight = openHeight;
        const contentContainerStyle = rowGap
            ? mutation === "collapse"
                ? [{ gap: 32 }, { rowGap }]
                : { gap: rowGap }
            : undefined;
        const { KeyboardAwareLegendList } =
            require("../../src/integrations/keyboard") as typeof import("../../src/integrations/keyboard");
        const lists = new Set<ListCtx>();
        const uninstallListRegistry = installListRegistry(lists);
        const sizes = new Map([
            ["prefix", anchorTop],
            ["anchor", anchorSize],
            ["reply", replyHeight],
        ]);
        const renderList = (data: string[], anchored = true) => (
            <KeyboardAwareLegendList
                anchoredEndSpace={anchored ? { anchorIndex: 1 } : undefined}
                columnWrapperStyle={rowGap ? {} : undefined}
                contentContainerStyle={contentContainerStyle}
                data={data}
                drawDistance={traced ? anchorTop + viewport : undefined}
                estimatedItemSize={100}
                keyExtractor={(item: string) => item}
                ListFooterComponent={withFooter ? <View testID="footer" /> : undefined}
                ListFooterComponentStyle={{ height: footerSize }}
                recycleItems={false}
                renderItem={({ item }) => <View testID={item} />}
            />
        );
        let renderer!: ReactTestRenderer;
        try {
            act(() => {
                renderer = TestRenderer.create(renderList(["prefix", "anchor", "reply"]));
            });
            const list = [...lists][0] as StateContext;
            const measureRows = () => measureMountedRows(renderer, list, sizes, WIDTH);
            act(() => scrollProps.onLayout(layoutEvent(WIDTH, viewport)));
            if (withFooter) measureFooter(renderer, WIDTH, footerSize);
            measureRows();
            flushUIJobs();
            runUIFrame();
            if (uiFrames.length) runUIFrame();
            flushJSJobs();

            const controllerInset = () => Math.min(viewport, Math.max(scrollProps.blankSpace.value, openHeight));
            const reportInset = (bottom: number) =>
                act(() => scrollProps.onContentInsetChange?.({ bottom, left: 0, right: 0, top: 0 }));
            const before = readGeometry(renderer.toJSON());
            expect(before.tops.get("anchor")).toBe(anchorTop);
            const footerExtent = withFooter ? footerSize + rowGap : 0;
            let rowBottom = anchorTop + anchorSize + replyHeight;
            if (withFooter) expect(before.tops.get("footer")).toBe(rowBottom + rowGap);
            expect(scrollProps.blankSpace.value).toBeCloseTo(
                Math.max(0, anchorTop + viewport - rowBottom - footerExtent + rowGap),
            );
            expect(before.contentHeight).toBe(rowBottom + footerExtent);

            const lastKey = mutation === "collapse" ? "reply" : "anchor";
            // The closed-delete trace starts at the offset left by the preceding collapse.
            const startOffset = split && withFooter && mutation === "delete" && !openHeight ? 1558 + 1 / 3 : anchorTop;
            let offset = startOffset;
            let appliedInset = controllerInset();
            let maxFooterGap = 0;
            let reportedHeight = before.contentHeight;
            let previous = before;
            const emitScroll = (content: number) =>
                act(() =>
                    scrollProps.onScroll({
                        nativeEvent: {
                            contentInset: { bottom: appliedInset, left: 0, right: 0, top: 0 },
                            contentOffset: { x: 0, y: offset },
                            contentSize: { height: content, width: WIDTH },
                            layoutMeasurement: { height: viewport, width: WIDTH },
                        },
                    }),
                );
            if (split) {
                reportInset(appliedInset);
                act(() => scrollProps.onContentSizeChange?.(WIDTH, reportedHeight));
                emitScroll(reportedHeight);
            }
            const applySize = (contentHeight: number) => {
                const limit = Math.max(0, contentHeight + appliedInset - viewport);
                if (offset > limit) {
                    offset = limit;
                    if (split) emitScroll(contentHeight);
                }
            };
            const mount = () => {
                const { contentHeight, tops } = readGeometry(renderer.toJSON());
                expect(tops.get("anchor")).toBe(anchorTop);
                expect(tops.get(lastKey)! + sizes.get(lastKey)!).toBe(rowBottom);
                applySize(contentHeight);
                if (split && contentHeight !== reportedHeight) {
                    reportedHeight = contentHeight;
                    act(() => scrollProps.onContentSizeChange?.(WIDTH, contentHeight));
                }
                if (withFooter) {
                    maxFooterGap = Math.max(maxFooterGap, Math.abs(tops.get("footer")! - rowBottom - rowGap));
                }
            };
            const mountShrink = (commit: () => void, partial: boolean) => {
                const oldTree = renderer.toJSON();
                commit();
                if (order === "layer-first") applySize(readGeometry(oldTree, true).contentHeight);
                if (split && partial) {
                    const next = readGeometry(renderer.toJSON());
                    expect(next.childEnds.length).toBe(previous.childEnds.length);
                    // Publish each new leading child while the previous trailing contribution is still mounted.
                    for (const [index, end] of next.childEnds.entries()) {
                        const trailing = previous.flowEnd - previous.childEnds[index];
                        applySize(Math.max(Math.min(previous.floor, next.floor), end + trailing));
                    }
                }
                mount();
                flushUIJobs();
                if (order === "extent-first" && withFooter) {
                    runUIFrame();
                    flushJSJobs();
                }
                if (split || (!fable && withFooter)) mount();
                const wantedInset = controllerInset();
                if (split) {
                    reportInset(wantedInset);
                    mount(); // The report can precede the native inset mount.
                }
                appliedInset = wantedInset;
                if (fable) mount();
                runUIFrame();
                flushJSJobs();
                mount();
                if (!overlap && uiFrames.length) {
                    runUIFrame();
                    flushJSJobs();
                    mount();
                }
                previous = readGeometry(renderer.toJSON());
            };
            if (mutation === "collapse") {
                const steps = split
                    ? openHeight
                        ? [[200, true] as const]
                        : ([
                              [374, true],
                              [373.625, false],
                              [370.375, true],
                              [365, false],
                              [357, true],
                              [200, false],
                          ] as const)
                    : (collapseHeight
                          ? [collapseHeight]
                          : fable
                            ? [374, 363, 344, 316, 279, 247, 225, 208, 200]
                            : collapseSteps.map(
                                  (height) => 200 + Math.round(((replyHeight - 200) * (height - 200)) / 176),
                              )
                      ).map((height) => [height, false] as const);
                for (const [height, partial] of steps) {
                    sizes.set("reply", height);
                    rowBottom = anchorTop + anchorSize + height;
                    mountShrink(measureRows, partial);
                }
            } else {
                rowBottom = anchorTop + anchorSize;
                mountShrink(() => act(() => renderer.update(renderList(["prefix", "anchor"]))), true);
            }

            if (overlap) {
                runUIFrame();
                flushJSJobs();
                mount();
            }
            const after = readGeometry(renderer.toJSON());
            const shift = Math.abs(startOffset - offset);
            expect(maxFooterGap).toBeLessThanOrEqual(split ? 1 / 3 : 0);
            expect(shift).toBeLessThanOrEqual(split ? 2 / 3 : 0);
            expect(scrollProps.blankSpace.value).toBeCloseTo(anchorTop + viewport - rowBottom - footerExtent + rowGap);
            expect(after.contentHeight).toBe(rowBottom + footerExtent);
            if (rowGap) {
                const data = mutation === "collapse" ? ["prefix", "anchor", "reply"] : ["prefix", "anchor"];
                act(() => renderer.update(renderList(data, false)));
                const unanchored = readGeometry(renderer.toJSON());
                expect(unanchored.contentHeight).toBe(after.contentHeight);
                expect(unanchored.tops.get("footer")).toBe(rowBottom + rowGap);
            }
        } finally {
            act(() => renderer?.unmount());
            uninstallListRegistry();
        }
    });
}

const scenarios: readonly Scenario[] = [
    ["collapse", 376, 0],
    ["collapse", 376, 160],
    ["collapse", 600, 0],
    ["collapse", 600, 160],
    ["delete", 376, 0],
    ["delete", 376, 160],
    ["delete", 600, 0],
    ["delete", 600, 160],
    ["collapse", 400, 0, 100],
    ["collapse", 600, 160, 100],
    ["delete", 400, 160],
];

testShrink("split-mount", true, 0, scenarios[0], true);
for (const order of models) {
    const traceCases: readonly Scenario[] =
        order === "split-mount"
            ? [
                  ["collapse", 376, 0],
                  ["collapse", 684, 395],
                  ["delete", 200, 0],
                  ["delete", 200, 395],
              ]
            : order === "extent-first" || order === "inset-first"
              ? [
                    ["collapse", 376, 0],
                    ["collapse", 376, 395],
                    ["delete", 200, 0],
                    ["delete", 200, 395],
                ]
              : [scenarios[0], scenarios[1], scenarios[4], scenarios[5]];
    for (const withFooter of [false, true]) {
        for (const scenario of traceCases) testShrink(order, withFooter, 0, scenario);
    }
}

for (const [withFooter, rowGap] of [
    [false, 0],
    [true, 0],
    [true, 16],
] as const) {
    for (const scenario of scenarios) testShrink("default", withFooter, rowGap, scenario);
}

for (const startsAnchored of [false, true]) {
    it(`preserves footer state when anchored end space toggles (starts anchored=${startsAnchored})`, () => {
        const { KeyboardAwareLegendList } =
            require("../../src/integrations/keyboard") as typeof import("../../src/integrations/keyboard");
        let setDraft!: React.Dispatch<React.SetStateAction<string>>;
        function Footer() {
            const [draft, updateDraft] = React.useState("");
            setDraft = updateDraft;
            return <View accessibilityLabel={draft} testID="stateful-footer" />;
        }
        const renderList = (anchored: boolean) => (
            <KeyboardAwareLegendList
                anchoredEndSpace={anchored ? { anchorIndex: 0 } : undefined}
                data={["row"]}
                ListFooterComponent={Footer}
                recycleItems={false}
                renderItem={() => null}
            />
        );
        let renderer!: ReactTestRenderer;
        try {
            act(() => {
                renderer = TestRenderer.create(renderList(startsAnchored));
            });
            act(() => setDraft("saved draft"));
            for (const anchored of [!startsAnchored, startsAnchored]) {
                act(() => renderer.update(renderList(anchored)));
                const footer = renderer.root.findAllByProps({ testID: "stateful-footer" })[0];
                expect(footer.props.accessibilityLabel).toBe("saved draft");
            }
        } finally {
            act(() => renderer?.unmount());
        }
    });
}
