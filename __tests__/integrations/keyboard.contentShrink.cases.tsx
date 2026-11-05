import * as React from "react";

import { beforeEach, expect, it, mock } from "bun:test";
import "../setup";

import { installListRegistry, type ListCtx } from "../../examples-shared/layoutInvariants";
import { LegendList } from "../../src/components/LegendList";
import { batchItemSizeUpdates } from "../../src/core/updateItemSizes";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { peek$, type StateContext } from "../../src/state/state";
import { typedForwardRef } from "../../src/types.internal";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import TestRenderer, { act } from "../helpers/testRenderer";

const WIDTH = 300;
const VIEWPORT = 600;

let scrollProps: any;
const Surface = React.forwardRef(function KeyboardSurface(props: any, ref: React.Ref<any>) {
    scrollProps = props;
    React.useImperativeHandle(ref, () => ({ measure: () => {}, scrollTo: () => {} }));
    return <>{props.children}</>;
});
mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: Surface,
    KeyboardController: { dismiss: () => Promise.resolve(), state: () => ({ height: 0 }) },
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
// The content extent's animated style, re-evaluated to read what the UI runtime would apply.
let extentStyle: (() => { minHeight?: number }) | undefined;

beforeEach(() => {
    deferUIJobs = false;
    uiJobs.length = 0;
    extentStyle = undefined;
    registerReanimatedModuleMock({
        runOnUI:
            (fn: (...args: any[]) => void) =>
            (...args: any[]) => {
                if (deferUIJobs) uiJobs.push(() => fn(...args));
                else fn(...args);
            },
        useAnimatedStyle: (updater: () => any) => {
            if ("minHeight" in updater()) extentStyle = updater;
            return updater();
        },
        useSharedValue: <T,>(initial: T) => React.useRef(createSharedValue(initial)).current,
        View: (props: any) => React.createElement("reanimated-view", props),
    });
});

it("queues the grown blank space ahead of the extent's release when a measured row shrinks", async () => {
    const { KeyboardAwareLegendList } = await import("../../src/integrations/keyboard?content-shrink");
    const lists = new Set<ListCtx>();
    const uninstallListRegistry = installListRegistry(lists);
    const sizes = new Map([
        ["anchor", 100],
        ["reply", 400],
    ]);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <KeyboardAwareLegendList
                anchoredEndSpace={{ anchorIndex: 0 }}
                data={["anchor", "reply"]}
                estimatedItemSize={100}
                keyExtractor={(item: string) => item}
                recycleItems={false}
                renderItem={() => null}
            />,
        );
    });
    // Each container's PositionView receives the row's onLayout, as on device.
    const measureRows = () =>
        act(() => {
            const views = renderer.root.findAll(
                (node) => typeof node.type !== "string" && typeof node.props.id === "number" && !!node.props.refView,
            );
            batchItemSizeUpdates(() => {
                for (const view of views) {
                    const key = peek$([...lists][0] as StateContext, `containerItemKey${view.props.id}`);
                    const size = sizes.get(key);
                    if (size !== undefined) {
                        view.props.onLayout?.({ nativeEvent: { layout: { height: size, width: WIDTH, x: 0, y: 0 } } });
                    }
                }
            });
        });
    act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: VIEWPORT, width: WIDTH, x: 0, y: 0 } } }));
    measureRows();

    const blankSpace = scrollProps.blankSpace;
    const scrollLimit = () => extentStyle!().minHeight! + blankSpace.value;
    // The anchor fills the viewport with the rows after it: 600 - (100 + 400).
    expect(blankSpace.value).toBe(100);
    expect(extentStyle!().minHeight).toBe(500);

    // The reply collapses. The list measures it, grows the blank space and commits the shorter
    // extent with the row positions, all queued for the UI runtime.
    deferUIJobs = true;
    sizes.set("reply", 100);
    measureRows();

    // Replayed in order, the scroll limit never drops below the viewport-filling 600, so the
    // offset is never clamped.
    expect(uiJobs.length).toBeGreaterThan(0);
    const limits = [scrollLimit()];
    for (const job of uiJobs.splice(0)) {
        job();
        limits.push(scrollLimit());
    }
    expect(Math.min(...limits)).toBe(VIEWPORT);
    expect(blankSpace.value).toBe(400);
    expect(extentStyle!().minHeight).toBe(200);

    act(() => renderer.unmount());
    uninstallListRegistry();
});
