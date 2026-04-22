import { LegendList } from "@legendapp/list/react";
import { ChatComposer, getChatListProps, useChatExample } from "./chatShared";
import { Shell } from "./shared";

export function ChatExample() {
    const { input, messages, sendMessage, setInput } = useChatExample();
    const listProps = getChatListProps({ messages });

    return (
        <Shell>
            <LegendList recycleItems {...listProps} />
            <ChatComposer
                input={input}
                onChangeText={setInput}
                onPress={() => sendMessage(input)}
                placeholder="Type a message"
            />
        </Shell>
    );
}
