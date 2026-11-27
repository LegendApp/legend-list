import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { typedForwardRef } from "../../src/types.internal";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import TestRenderer, { act } from "../helpers/testRenderer";

type KeyboardEvent = { height: number; progress: number };
type Handler = Partial<Record<"onStart" | "onMove" | "onEnd", (event: KeyboardEvent) => void>>;

const handlers: Handler[] = [];
const calls: unknown[][] = [];
let listProps: any;

mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: () => null,
    KeyboardController: { dismiss: () => Promise.resolve(), state: () => ({ height: 0 }) },
    useKeyboardHandler: (handler: Handler) => handlers.push(handler),
}));
mock.module("@legendapp/list/react-native", () => ({ internal: { typedForwardRef, useCombinedRef } }));
mock.module("@legendapp/list/reanimated", () => ({
    AnimatedLegendList: React.forwardRef((props: any, ref) => {
        listProps = props;
        React.useImperativeHandle(ref, () => ({
            reportContentInset: (inset: { bottom: number }) => calls.push(["follow", inset.bottom]),
            reportContentInsetForScrollInternal: (inset: { bottom: number }, options?: object) =>
                calls.push(["keyboard", inset.bottom, options]),
        }));
        return null;
    }),
}));
registerReanimatedModuleMock();

const mount = async (platform: string, props: Record<string, unknown> = {}) => {
    const { Platform } = await import("react-native");
    (Platform as any).OS = platform;
    const { KeyboardAwareLegendList } = await import("../../src/integrations/keyboard?initial-scroll-at-end");
    act(() => {
        TestRenderer.create(<KeyboardAwareLegendList data={["row"]} renderItem={() => null} {...props} />);
    });
    const onContentInsetChange = listProps.renderScrollComponent({}).props.onContentInsetChange;
    return (bottom: number) => onContentInsetChange({ bottom, left: 0, right: 0, top: 0 });
};
const keyboardStart = (height: number) => {
    for (const handler of handlers) handler.onStart?.({ height, progress: 0 });
};

beforeEach(() => {
    handlers.length = 0;
    calls.length = 0;
});

describe("KeyboardAwareLegendList initial scroll-at-end under keyboard insets", () => {
    it("keeps an initial scroll-at-end at the keyboard end on iOS, where the controller shifts once", async () => {
        const reportInset = await mount("ios");

        reportInset(56);
        keyboardStart(300);
        reportInset(356);

        expect(calls).toEqual([
            ["follow", 56],
            ["keyboard", 356, { keepInitialScrollAtEnd: true }],
        ]);
    });

    it("stays out of the way on Android, where the controller scrolls every frame", async () => {
        const reportInset = await mount("android");

        keyboardStart(300);
        reportInset(356);

        expect(calls).toEqual([["keyboard", 356, { keepInitialScrollAtEnd: false }]]);
    });

    it("leaves the initial scroll alone when the controller never lifts", async () => {
        const reportInset = await mount("ios", { keyboardLiftBehavior: "never" });

        keyboardStart(300);
        reportInset(356);

        expect(calls).toEqual([["keyboard", 356, { keepInitialScrollAtEnd: false }]]);
    });
});
