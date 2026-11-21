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

const WIDTH = 300;
const VIEWPORT = 600;
const FOOTER = 40;

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
    keyboardHeight = 0;
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
        useSharedValue: <T,>(initial: T) => React.useRef(createSharedValue(initial)).current,
        View: (props: any) => React.createElement("reanimated-view", props),
    });
});

const layoutEvent = (height: number) => ({ nativeEvent: { layout: { height, width: WIDTH, x: 0, y: 0 } } });

// The test renderer has no Yoga layout. Evaluate the fixture's vertical flow, with absolute rows
// positioned from the committed styles and animated minimums read after each UI job.
function readGeometry(json: ReactTestRendererJSON | ReactTestRendererJSON[] | null) {
    const tops = new Map<string, number>();
    type FlowStyle = { gap?: number; rowGap?: number };
    function layout(nodes: ReactTestRendererNode[], top: number, parentStyle: FlowStyle): number {
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
        }
        return cursor - top;
    }
    return {
        contentHeight: layout(json ? [json].flat() : [], 0, StyleSheet.flatten(scrollProps.contentContainerStyle)),
        tops,
    };
}

for (const [withFooter, rowGap] of [
    [false, 0],
    [true, 0],
    [true, 16],
] as const) {
    for (const [mutation, replyHeight, openHeight, collapseHeight] of [
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
    ] as const) {
        it(`${mutation} keeps the anchor and content end together (footer=${withFooter}, gap=${rowGap}, reply=${replyHeight}, keyboard=${openHeight}, target=${collapseHeight ?? (mutation === "collapse" ? 200 : 0)})`, () => {
            const anchorTop = replyHeight < VIEWPORT ? 40 : 300;
            const contentContainerStyle = rowGap
                ? mutation === "collapse"
                    ? [{ gap: 32 }, { rowGap }]
                    : { gap: rowGap }
                : undefined;
            keyboardHeight = openHeight;
            const { KeyboardAwareLegendList } =
                require("../../src/integrations/keyboard") as typeof import("../../src/integrations/keyboard");
            const lists = new Set<ListCtx>();
            const uninstallListRegistry = installListRegistry(lists);
            const sizes = new Map([
                ["prefix", anchorTop],
                ["anchor", 100],
                ["reply", replyHeight],
            ]);
            const renderList = (data: string[], anchored = true) => (
                <KeyboardAwareLegendList
                    anchoredEndSpace={anchored ? { anchorIndex: 1 } : undefined}
                    // An explicit column style keeps the gap on the scroll container.
                    columnWrapperStyle={rowGap ? {} : undefined}
                    contentContainerStyle={contentContainerStyle}
                    data={data}
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
                    renderer = TestRenderer.create(renderList(["prefix", "anchor", "reply"]));
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
                for (const job of uiFrameJobs.splice(0)) job(0);

                const blankSpace = scrollProps.blankSpace;
                const before = readGeometry(renderer.toJSON());
                expect(before.tops.get("anchor")).toBe(anchorTop);
                if (withFooter) expect(before.tops.get("footer")).toBe(anchorTop + 100 + replyHeight + rowGap);
                expect(blankSpace.value).toBe(Math.max(0, VIEWPORT - (100 + replyHeight + (withFooter ? FOOTER : 0))));
                expect(before.contentHeight).toBe(anchorTop + 100 + replyHeight + (withFooter ? FOOTER + rowGap : 0));

                const lastKey = mutation === "collapse" ? "reply" : "anchor";
                let offset = anchorTop;
                let appliedInset = Math.max(blankSpace.value, openHeight);
                let rowBottom = anchorTop + 100 + replyHeight;
                const frames: Array<{ anchorOnScreen: number; footerGap?: number }> = [];
                const mount = () => {
                    const { contentHeight, tops } = readGeometry(renderer.toJSON());
                    expect(tops.get("anchor")).toBe(anchorTop);
                    expect(tops.get(lastKey)! + sizes.get(lastKey)!).toBe(rowBottom);
                    offset = Math.min(offset, Math.max(0, contentHeight + appliedInset - VIEWPORT));
                    frames.push({
                        anchorOnScreen: tops.get("anchor")! - offset,
                        footerGap: withFooter ? tops.get("footer")! - rowBottom : undefined,
                    });
                };
                const mountShrink = () => {
                    mount(); // React commits the rows and footer first.
                    flushUIJobs();

                    // The candidate trace is consistent with a spacer layout reaching iOS before
                    // the new content inset. Model that intermediate native range for footer cases.
                    if (withFooter) mount();
                    appliedInset = Math.max(blankSpace.value, openHeight);
                    for (const job of uiFrameJobs.splice(0)) job(0);
                    mount();
                };
                if (mutation === "collapse") {
                    // Replay the 300 ms transition, or a single layout update for the original hold cases.
                    const heights = collapseHeight
                        ? [collapseHeight]
                        : [374, 369, 363, 355, 344, 331, 316, 298, 279, 266, 247, 236, 225, 215, 208, 203, 200].map(
                              (height) => 200 + Math.round(((replyHeight - 200) * (height - 200)) / 176),
                          );
                    for (const height of heights) {
                        sizes.set("reply", height);
                        rowBottom = anchorTop + 100 + height;
                        measureRows();
                        mountShrink();
                    }
                } else {
                    rowBottom = anchorTop + 100;
                    act(() => renderer.update(renderList(["prefix", "anchor"])));
                    mountShrink();
                }

                const rowAndFooterEnd = rowBottom + (withFooter ? FOOTER : 0);
                expect(blankSpace.value).toBe(anchorTop + VIEWPORT - rowAndFooterEnd);
                const after = readGeometry(renderer.toJSON());
                expect(after.contentHeight).toBe(rowAndFooterEnd + rowGap);
                expect(Math.max(...frames.map((frame) => Math.abs(frame.anchorOnScreen)))).toBe(0);
                if (withFooter) {
                    expect(Math.max(...frames.map((frame) => Math.abs(frame.footerGap! - rowGap)))).toBe(0);
                }
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
