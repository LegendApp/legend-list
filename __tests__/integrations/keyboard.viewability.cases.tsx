import * as React from "react";

import { beforeEach, expect, it, mock } from "bun:test";
import "../setup";

import { LegendList } from "../../src/components/LegendList";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { Platform } from "../../src/platform/Platform";
import type { OnViewableItemsChangedInfo } from "../../src/types.base";
import { typedForwardRef } from "../../src/types.internal";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import { act, render } from "../helpers/testingLibrary";

let scrollProps: any;
let handlers: any;
let latestRows: number[];
const reactions: Array<{
    prepare: () => number;
    react: (value: number, previous: number | null) => void;
    previous: number | null;
}> = [];
const data = Array.from({ length: 40 }, (_, id) => String(id));
const Surface = React.forwardRef(function KeyboardSurface(props: any, ref: React.Ref<any>) {
    scrollProps = props;
    React.useImperativeHandle(ref, () => ({ measure: () => {}, scrollTo: () => {} }));
    return <>{props.children}</>;
});
mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: Surface,
    KeyboardController: { dismiss: () => Promise.resolve(), state: () => ({ height: 0 }) },
    useKeyboardHandler: (value: any) => {
        handlers = value;
    },
}));
mock.module("@legendapp/list/react-native", () => ({ internal: { typedForwardRef, useCombinedRef } }));
mock.module("@legendapp/list/reanimated", () => ({ AnimatedLegendList: LegendList }));

beforeEach(() => {
    reactions.length = 0;
    handlers = undefined;
    latestRows = [];
    registerReanimatedModuleMock({
        useAnimatedReaction: (prepare: () => number, react: (value: number, previous: number | null) => void) => {
            reactions.push({ prepare, previous: null, react });
        },
    });
});

function reactToKeyboard() {
    for (const reaction of reactions) {
        const value = reaction.prepare();
        reaction.react(value, reaction.previous);
        reaction.previous = value;
    }
}
async function flushFrames() {
    for (let i = 0; i < 8; i++) {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}
async function mount(extraProps: Record<string, unknown> = {}) {
    const { KeyboardAwareLegendList } = await import("../../src/integrations/keyboard?viewability-regression");
    const result = render(
        <KeyboardAwareLegendList
            data={data}
            estimatedItemSize={100}
            getFixedItemSize={() => 100}
            keyExtractor={(item: string) => item}
            onViewableItemsChanged={(info: OnViewableItemsChangedInfo<string>) => {
                latestRows = info.viewableItems.map((item) => item.index);
            }}
            recycleItems={false}
            renderItem={() => null}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            {...extraProps}
        />,
    );
    await flushFrames();
    act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 580, width: 300, x: 0, y: 0 } } }));
    await flushFrames();
    act(() => {
        scrollProps.onScroll({
            nativeEvent: {
                contentOffset: { x: 0, y: 600 },
                contentSize: { height: 4000, width: 300 },
                layoutMeasurement: { height: 580, width: 300 },
            },
            timeStamp: Date.now(),
        });
        reactToKeyboard();
    });
    expect(latestRows).toEqual([6, 7, 8, 9, 10, 11]);
    return result;
}

for (const os of ["ios", "android"]) {
    it(`excludes covered rows and restores them when the keyboard closes (${os})`, async () => {
        Platform.OS = os;
        const list = await mount();
        act(() => {
            handlers?.onMove?.({ height: 335, progress: 1 });
            reactToKeyboard();
            scrollProps.onContentInsetChange({ bottom: 335 });
        });
        expect(latestRows).toEqual([6, 7]);
        act(() => {
            handlers?.onEnd?.({ height: 0, progress: 0 });
            reactToKeyboard();
            scrollProps.onContentInsetChange({ bottom: 0 });
        });
        expect(latestRows).toEqual([6, 7, 8, 9, 10, 11]);
        list.unmount();
    });
}

it("updates viewability during interactive movement even when a large blank space keeps content inset unchanged", async () => {
    const list = await mount({ anchoredEndSpace: { anchorIndex: 0 } });
    act(() => {
        // The scroll range can reserve more space than the keyboard covers.
        scrollProps.onContentInsetChange({ bottom: 1000 });
        handlers?.onInteractive?.({ height: 335, progress: 1 });
        reactToKeyboard();
    });
    expect(latestRows).toEqual([6, 7]);
    act(() => {
        handlers?.onInteractive?.({ height: 135, progress: 0.4 });
        reactToKeyboard();
        // No inset callback or scroll event: only the visible area changed.
    });
    expect(latestRows).toEqual([6, 7, 8, 9]);
    list.unmount();
});

it("accounts for keyboardOffset proportionally during movement", async () => {
    const list = await mount({ keyboardOffset: 35 });
    act(() => {
        handlers.onMove({ height: 335, progress: 1 });
        reactToKeyboard();
    });
    expect(latestRows).toEqual([6, 7, 8]);
    act(() => {
        handlers.onMove({ height: 167.5, progress: 0.5 });
        reactToKeyboard();
    });
    expect(latestRows).toEqual([6, 7, 8, 9]);
    list.unmount();
});

it("refreshes stationary viewability when overlaid composer padding changes", async () => {
    const padding = { value: 0 };
    const list = await mount({ contentInsetEndAdjustment: padding });
    act(() => {
        padding.value = 335;
        reactToKeyboard();
    });
    expect(latestRows).toEqual([6, 7]);
    act(() => {
        padding.value = 0;
        reactToKeyboard();
    });
    expect(latestRows).toEqual([6, 7, 8, 9, 10, 11]);
    list.unmount();
});
