import { KeyboardGestureArea, KeyboardProvider, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardChatLegendList } from "@legendapp/list/keyboard-chat";
import { ChatComposer, getChatListProps, useChatExample } from "./chatShared";
import { SafeAreaShell } from "./shared";

export function ChatExample() {
    const insets = useSafeAreaInsets();
    const { input, messages, sendMessage, setInput } = useChatExample();
    const listProps = getChatListProps({ messages });

    return (
        <KeyboardProvider>
            <SafeAreaShell>
                <KeyboardGestureArea interpolator="ios" offset={60} style={{ flex: 1 }}>
                    <KeyboardChatLegendList
                        keyboardDismissMode="interactive"
                        keyboardOffset={insets.bottom}
                        style={{ flex: 1 }}
                        {...listProps}
                    />
                </KeyboardGestureArea>
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                    <ChatComposer
                        input={input}
                        onChangeText={setInput}
                        onPress={() => sendMessage(input)}
                        placeholder="Type a message"
                    />
                </KeyboardStickyView>
            </SafeAreaShell>
        </KeyboardProvider>
    );
}
