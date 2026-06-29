import { describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: (props: any) => React.createElement("keyboard-chat-scroll-view", props),
    KeyboardController: {
        dismiss: () => Promise.resolve(),
    },
    useKeyboardHandler: () => {},
}));

const createReanimatedModuleMock = () => {
    const shared = {
        isWorkletFunction: () => false,
        runOnJS:
            (fn: (...args: any[]) => void) =>
            (...args: any[]) =>
                fn(...args),
        useAnimatedProps: (updater: () => unknown) => updater,
        useAnimatedRef: () => ({ current: null }),
        useAnimatedScrollHandler: (handler: any) => handler,
        useAnimatedStyle: (updater: () => unknown) => updater(),
        useComposedEventHandler: (handlers: any[]) => handlers[0],
        useScrollViewOffset: () => {},
        useSharedValue: (value: unknown) => ({ get: () => value, set: () => {}, value }),
    };

    return {
        __esModule: true,
        ...shared,
        default: shared,
    };
};

mock.module("react-native-reanimated", createReanimatedModuleMock);
mock.module("react-native-reanimated/lib/module/index.js", createReanimatedModuleMock);

mock.module("@legendapp/list/reanimated", () => ({
    AnimatedLegendList: React.forwardRef(function AnimatedLegendListMock(_props: any, _ref) {
        return null;
    }),
}));

describe("keyboard integration exports", () => {
    it("exports the canonical keyboard integration APIs", async () => {
        const keyboard = await import("../../src/integrations/keyboard?keyboard-export-test");

        expect(typeof keyboard.KeyboardAwareLegendList).toBe("object");
        expect(typeof keyboard.useKeyboardChatComposerInset).toBe("function");
        expect(typeof keyboard.useKeyboardScrollToEnd).toBe("function");
        expect("KeyboardAvoidingLegendList" in keyboard).toBe(false);
        expect("KeyboardChatLegendList" in keyboard).toBe(false);
    });

    it("exports the legacy keyboard avoiding list from the legacy entrypoint", async () => {
        const keyboardLegacy = await import("../../src/integrations/keyboard-legacy?keyboard-legacy-export-test");

        expect(typeof keyboardLegacy.KeyboardAvoidingLegendList).toBe("object");
    });
});
