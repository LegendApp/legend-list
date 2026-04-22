import { useCallback, useRef } from "react";
import { Platform } from "react-native";
import {
    KeyboardController,
    KeyboardGestureArea,
    KeyboardProvider,
    KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardChatLegendList } from "@legendapp/list/keyboard-chat";
import type { LegendListRef } from "@legendapp/list/react-native";
import { ChatComposer, getAiChatListProps, useAiChatExample } from "./chatShared";
import { SafeAreaShell } from "./shared";

export function AiChatExample() {
    const listRef = useRef<LegendListRef>(null);
    const insets = useSafeAreaInsets();
    const beforeScrollToEnd = useCallback(async () => {
        const keyboardDismissPromise = KeyboardController.dismiss();
        if (Platform.OS === "android") {
            await keyboardDismissPromise;
        }
    }, []);
    const { anchorIndex, input, messages, sendPrompt, setInput } = useAiChatExample({
        beforeScrollToEnd,
        listRef,
        streamIntervalMs: 5,
        streamStartDelayMs: 1000,
    });
    const listProps = getAiChatListProps({ anchorIndex, messages });

    return (
        <KeyboardProvider>
            <SafeAreaShell>
                <KeyboardGestureArea interpolator="ios" offset={60} style={{ flex: 1 }}>
                    <KeyboardChatLegendList
                        keyboardDismissMode="interactive"
                        offset={insets.bottom}
                        recycleItems
                        ref={listRef}
                        style={{ flex: 1 }}
                        {...listProps}
                    />
                </KeyboardGestureArea>
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                    <ChatComposer
                        input={input}
                        onChangeText={setInput}
                        onPress={() => sendPrompt(input)}
                        placeholder="Ask about list behavior"
                    />
                </KeyboardStickyView>
            </SafeAreaShell>
        </KeyboardProvider>
    );
}
