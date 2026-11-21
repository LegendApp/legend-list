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
    function layout(nodes: ReactTestRendererNode[], top: number): number {
        let cursor = top;
        for (const node of nodes) {
            if (typeof node === "string") continue;
            const style = StyleSheet.flatten(node.props.style) ?? {};
            const absolute = style.position === "absolute";
            const start = absolute ? top + (style.top ?? 0) : cursor + (style.marginTop ?? 0);
            if (node.props.testID) tops.set(node.props.testID, start);
            const paddingTop = style.paddingTop ?? 0;
            const padding = paddingTop + (style.paddingBottom ?? 0);
            const childrenHeight = layout(node.children ?? [], start + paddingTop);
            const height = typeof style.height === "object" ? style.height.getValue() : style.height;
            if (!absolute) {
                cursor =
                    start +
                    Math.max(height ?? childrenHeight + padding, style.minHeight ?? 0, padding) +
                    (style.marginBottom ?? 0);
            }
        }
        return cursor - top;
    }
    return { contentHeight: layout(json ? [json].flat() : [], 0), tops };
}

for (const withFooter of [false, true]) {
    for (const [mutation, replyHeight, openHeight] of [
        ["collapse", 376, 0],
        ["collapse", 376, 160],
        ["collapse", 600, 0],
        ["collapse", 600, 160],
        ["delete", 376, 0],
        ["delete", 376, 160],
        ["delete", 600, 0],
        ["delete", 600, 160],
    ] as const) {
        it(`${mutation} keeps the anchor and content end together (footer=${withFooter}, reply=${replyHeight}, keyboard=${openHeight})`, () => {
            const anchorTop = replyHeight < VIEWPORT ? 40 : 300;
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
            const renderList = (data: string[]) => (
                <KeyboardAwareLegendList
                    anchoredEndSpace={{ anchorIndex: 1 }}
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
                expect(blankSpace.value).toBe(Math.max(0, VIEWPORT - (before.contentHeight - anchorTop)));
                expect(before.tops.get("anchor")).toBe(anchorTop);
                if (withFooter) expect(before.tops.get("footer")).toBe(anchorTop + 100 + replyHeight);

                const lastKey = mutation === "collapse" ? "reply" : "anchor";
                let offset = anchorTop;
                let appliedInset = Math.max(blankSpace.value, openHeight);
                let rowBottom = anchorTop + 100 + replyHeight;
                const frames: Array<{ anchorOnScreen: number; footerGap?: number }> = [];
                const mount = () => {
                    const { contentHeight, tops } = readGeometry(renderer.toJSON());
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
                    // Replay the increasing and decreasing shrink steps of the 300 ms iOS transition.
                    for (const remainingHeight of [
                        374, 369, 363, 355, 344, 331, 316, 298, 279, 266, 247, 236, 225, 215, 208, 203, 200,
                    ]) {
                        const height = 200 + Math.round(((replyHeight - 200) * (remainingHeight - 200)) / 176);
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

                const finalHeight = rowBottom + (withFooter ? FOOTER : 0);
                expect(blankSpace.value).toBe(anchorTop + VIEWPORT - finalHeight);
                const final = readGeometry(renderer.toJSON());
                expect(final.contentHeight).toBe(finalHeight);
                expect(final.tops.get(lastKey)! + sizes.get(lastKey)!).toBe(rowBottom);
                expect(Math.max(...frames.map((frame) => Math.abs(frame.anchorOnScreen)))).toBe(0);
                if (withFooter) expect(Math.max(...frames.map((frame) => Math.abs(frame.footerGap!)))).toBe(0);
            } finally {
                act(() => renderer?.unmount());
                uninstallListRegistry();
            }
        });
    }
}
