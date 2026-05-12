import { describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: (props: any) => React.createElement("keyboard-chat-scroll-view", props),
    KeyboardController: {
        dismiss: () => Promise.resolve(),
    },
}));

mock.module("react-native-reanimated", () => ({
    __esModule: true,
    default: {},
    useSharedValue: (value: unknown) => ({ value }),
}));

mock.module("@legendapp/list/reanimated", () => ({
    AnimatedLegendList: React.forwardRef(function AnimatedLegendListMock(_props: any, _ref) {
        return null;
    }),
}));

describe("keyboard integration compatibility exports", () => {
    it("keeps legacy component names pointed at KeyboardAwareLegendList", async () => {
        const keyboard = await import("../../src/integrations/keyboard?keyboard-export-test");
        const keyboardChat = await import("../../src/integrations/keyboard-chat?keyboard-chat-export-test");
        const keyboardTest = await import("../../src/integrations/keyboard-test?keyboard-test-export-test");

        expect(keyboard.KeyboardAvoidingLegendList).toBe(keyboard.KeyboardAwareLegendList);
        expect("KeyboardChatLegendList" in keyboard).toBe(false);
        expect("KeyboardAwareLegendList" in keyboardChat).toBe(false);
        expect("KeyboardAvoidingLegendList" in keyboardChat).toBe(false);
        expect(typeof keyboardChat.KeyboardChatLegendList).toBe("object");
        expect(typeof keyboardChat.useKeyboardChatComposerInset).toBe("function");
        expect(typeof keyboardChat.useKeyboardScrollToEnd).toBe("function");
        expect("KeyboardAwareLegendList" in keyboardTest).toBe(false);
        expect("KeyboardChatLegendList" in keyboardTest).toBe(false);
        expect(typeof keyboardTest.KeyboardAvoidingLegendList).toBe("object");
        expect(typeof keyboardTest.useKeyboardScrollToEnd).toBe("function");
    });
});
