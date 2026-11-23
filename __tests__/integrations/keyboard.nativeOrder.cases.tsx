// Replays the iOS Fabric commit order measured for KeyboardAwareLegendList with anchoredEndSpace:
// the React commit that shrinks the rows mounts before any UI-thread job of that frame, so UIKit
// clamps the offset against the previous bottom inset. Two candidate mechanisms for that trace:
// "restyle-drop" drops Reanimated-owned style keys from a view whose React-owned style changed in
// the commit, until the UI turn that also lands the grown inset; "layer-first" shrinks the rows
// layer's Animated height before the React commit, with its committed minHeight not holding it.
// Frame callbacks (the release) run after the inset. A hold must pass both orders.
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
import TestRenderer, { act, type ReactTestRenderer, type ReactTestRendererNode } from "../helpers/testRenderer";

const WIDTH = 300;
const VIEWPORT = 600;
const FOOTER = 40;
const ANCHOR_TOP = 40;
let layerFirst = false;

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
// Animated styles whose view changed its React-owned style in the commit being mounted.
const staleAnimatedStyles = new Set<object>();
const animatedStyles = new WeakSet<object>();

function flushUIJobs() {
    const requestFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => uiFrameJobs.push(callback);
    try {
        for (const job of uiJobs.splice(0)) job();
    } finally {
        globalThis.requestAnimationFrame = requestFrame;
    }
    staleAnimatedStyles.clear();
}

beforeEach(() => {
    uiJobs.length = 0;
    uiFrameJobs.length = 0;
    staleAnimatedStyles.clear();
    registerReanimatedModuleMock({
        runOnUI:
            (fn: (...args: any[]) => void) =>
            (...args: any[]) =>
                uiJobs.push(() => fn(...args)),
        useAnimatedStyle: (updater: () => any) => {
            const latest = React.useRef(updater);
            latest.current = updater;
            const handle = React.useRef<object>(undefined);
            if (!handle.current) {
                const read = (key: string) => (staleAnimatedStyles.has(style) ? undefined : latest.current()[key]);
                const style = {
                    get height() {
                        return read("height");
                    },
                    get minHeight() {
                        return read("minHeight");
                    },
                };
                animatedStyles.add(style);
                handle.current = style;
            }
            return handle.current;
        },
        useSharedValue: <T,>(initial: T) => React.useRef({ value: initial }).current,
        View: (props: any) => {
            const styles = [props.style].flat(Infinity).filter(Boolean);
            const reactStyle = JSON.stringify(styles.filter((style) => !animatedStyles.has(style)));
            const previous = React.useRef(reactStyle);
            if (!layerFirst && previous.current !== reactStyle) {
                previous.current = reactStyle;
                for (const style of styles) if (animatedStyles.has(style)) staleAnimatedStyles.add(style);
            }
            return React.createElement("reanimated-view", props);
        },
    });
});

// The test renderer has no Yoga: evaluate the vertical flow from the mounted styles.
function readGeometry(json: ReturnType<ReactTestRenderer["toJSON"]>, layerOnly = false) {
    const tops = new Map<string, number>();
    function layout(nodes: ReactTestRendererNode[], top: number): number {
        let cursor = top;
        for (const node of nodes) {
            if (typeof node === "string") continue;
            const style = StyleSheet.flatten(node.props.style) ?? {};
            const absolute = style.position === "absolute";
            const start = absolute ? top + (style.top ?? 0) : cursor + (style.marginTop ?? 0);
            if (node.props.testID) tops.set(node.props.testID, start);
            const padding = (style.paddingTop ?? 0) + (style.paddingBottom ?? 0);
            const childrenHeight = layout(node.children ?? [], start + (style.paddingTop ?? 0));
            const height = typeof style.height === "object" ? style.height.getValue() : style.height;
            if (!absolute) {
                cursor =
                    start +
                    Math.max(
                        height ?? childrenHeight + padding,
                        // The rows layer is the one view sized by an Animated value.
                        layerOnly && typeof style.height === "object" ? 0 : (style.minHeight ?? 0),
                        padding,
                    ) +
                    (style.marginBottom ?? 0);
            }
        }
        return cursor - top;
    }
    return { contentHeight: layout(json ? [json].flat() : [], 0), tops };
}

for (const order of ["restyle-drop", "layer-first"] as const) {
    for (const withFooter of [false, true]) {
        for (const mutation of ["collapse", "delete"] as const) {
            for (const openHeight of [0, 160]) {
                const name = `${order} footer=${withFooter} ${mutation} keyboard=${openHeight}`;
                it(`holds the anchor through the native commit order (${name})`, () => {
                    keyboardHeight = openHeight;
                    layerFirst = order === "layer-first";
                    const { KeyboardAwareLegendList } =
                        require("../../src/integrations/keyboard") as typeof import("../../src/integrations/keyboard");
                    const lists = new Set<ListCtx>();
                    const uninstallListRegistry = installListRegistry(lists);
                    const sizes = new Map([
                        ["prefix", ANCHOR_TOP],
                        ["anchor", 100],
                        ["reply", 376],
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
                        const measureRows = () => measureMountedRows(renderer, list, sizes, WIDTH);
                        act(() => scrollProps.onLayout(layoutEvent(WIDTH, VIEWPORT)));
                        if (withFooter) measureFooter(renderer, WIDTH, FOOTER);
                        measureRows();
                        flushUIJobs();
                        for (const job of uiFrameJobs.splice(0)) job(0);

                        const blankSpace = scrollProps.blankSpace;
                        let offset = ANCHOR_TOP;
                        let appliedInset = Math.max(blankSpace.value, openHeight);
                        let maxShift = 0;
                        // UIKit clamps the offset to the range of what is mounted right now.
                        const mount = (json = renderer.toJSON(), layerOnly = false) => {
                            const { contentHeight, tops } = readGeometry(json, layerOnly);
                            offset = Math.min(offset, Math.max(0, contentHeight + appliedInset - VIEWPORT));
                            maxShift = Math.max(maxShift, Math.abs(tops.get("anchor")! - offset));
                        };
                        const mountShrink = (commit: () => void) => {
                            const previous = renderer.toJSON();
                            commit();
                            if (layerFirst) mount(previous, true);
                            mount(); // The React commit, against the previous inset.
                            flushUIJobs();
                            appliedInset = Math.max(blankSpace.value, openHeight);
                            mount(); // The UI turn: grown inset and restored animated styles.
                            act(() => {
                                for (const job of uiFrameJobs.splice(0)) job(0);
                            });
                            mount(); // The next UI frame.
                            flushUIJobs();
                        };
                        mount();
                        expect(maxShift).toBe(0);
                        if (mutation === "collapse") {
                            for (const height of [374, 363, 344, 316, 279, 247, 225, 208, 200]) {
                                sizes.set("reply", height);
                                mountShrink(measureRows);
                            }
                        } else {
                            mountShrink(() => act(() => renderer.update(renderList(["prefix", "anchor"]))));
                        }
                        expect(maxShift).toBe(0);
                        // The hold must also let go: the settled extent is the rows plus the footer.
                        const rowsEnd = ANCHOR_TOP + 100 + (mutation === "collapse" ? 200 : 0);
                        expect(readGeometry(renderer.toJSON()).contentHeight).toBe(rowsEnd + (withFooter ? FOOTER : 0));
                    } finally {
                        act(() => renderer?.unmount());
                        uninstallListRegistry();
                    }
                });
            }
        }
    }
}
