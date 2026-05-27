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

describe("keyboard integration exports", () => {
    it("exports the canonical keyboard integration APIs", async () => {
        const keyboard = await import("../../src/integrations/keyboard?keyboard-export-test");

        expect(keyboard.KeyboardAvoidingLegendList).toBe(keyboard.KeyboardAwareLegendList);
        expect(typeof keyboard.KeyboardAwareLegendList).toBe("object");
        expect(typeof keyboard.useKeyboardChatComposerInset).toBe("function");
        expect(typeof keyboard.useKeyboardScrollToEnd).toBe("function");
        expect("KeyboardChatLegendList" in keyboard).toBe(false);
    });
});
