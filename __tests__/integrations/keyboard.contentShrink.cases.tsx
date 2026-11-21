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

// runOnUI runs immediately unless a test defers it, to replay the UI runtime's queue in order.
let deferUIJobs = false;
const uiJobs: Array<() => void> = [];
beforeEach(() => {
    deferUIJobs = false;
    uiJobs.length = 0;
    keyboardHeight = 0;
    registerReanimatedModuleMock({
        runOnUI:
            (fn: (...args: any[]) => void) =>
            (...args: any[]) => {
                if (deferUIJobs) uiJobs.push(() => fn(...args));
                else fn(...args);
            },
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
        ["collapse", 400, 0],
        ["delete", 400, 160],
        ["collapse", 600, 160],
        ["delete", 600, 0],
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

                const blankSpace = scrollProps.blankSpace;
                const before = readGeometry(renderer.toJSON());
                expect(blankSpace.value).toBe(Math.max(0, VIEWPORT - (before.contentHeight - anchorTop)));
                expect(before.tops.get("anchor")).toBe(anchorTop);
                if (withFooter) expect(before.tops.get("footer")).toBe(anchorTop + 100 + replyHeight);

                deferUIJobs = true;
                if (mutation === "collapse") {
                    sizes.set("reply", 100);
                    measureRows();
                } else {
                    act(() => renderer.update(renderList(["prefix", "anchor"])));
                }

                const lastKey = mutation === "collapse" ? "reply" : "anchor";
                const rowBottom = anchorTop + (mutation === "collapse" ? 200 : 100);
                const checkFrame = () => {
                    const { contentHeight, tops } = readGeometry(renderer.toJSON());
                    return {
                        anchorTop: tops.get("anchor"),
                        footerTop: tops.get("footer"),
                        lastRowBottom: tops.get(lastKey)! + sizes.get(lastKey)!,
                        scrollLimit: contentHeight + Math.max(blankSpace.value, openHeight) - VIEWPORT,
                    };
                };
                const frames = [checkFrame()];
                expect(uiJobs.length).toBeGreaterThan(0);
                for (const job of uiJobs.splice(0)) {
                    job();
                    frames.push(checkFrame());
                }

                const finalHeight = rowBottom + (withFooter ? FOOTER : 0);
                expect(blankSpace.value).toBe(anchorTop + VIEWPORT - finalHeight);
                expect(readGeometry(renderer.toJSON()).contentHeight).toBe(finalHeight);
                for (const frame of frames) {
                    // A clamp below this offset would move the anchored row away from the viewport top.
                    expect(frame.scrollLimit).toBeGreaterThanOrEqual(anchorTop);
                    expect(frame.anchorTop).toBe(anchorTop);
                    expect(frame.lastRowBottom).toBe(rowBottom);
                }
                expect(frames.map((frame) => frame.footerTop)).toEqual(
                    frames.map(() => (withFooter ? rowBottom : undefined)),
                );
            } finally {
                act(() => renderer?.unmount());
                uninstallListRegistry();
            }
        });
    }
}
