import { useCallback, useRef } from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { ChatComposer, getAiChatListProps, useAiChatExample } from "./chatShared";
import { Shell } from "./shared";

export function AiChatExample() {
    const listRef = useRef<LegendListRef>(null);
    const scrollToEnd = useCallback(() => listRef.current?.scrollToEnd({ animated: true }), []);
    const { anchorIndex, input, messages, sendPrompt, setInput } = useAiChatExample({
        scrollMessageToEnd: scrollToEnd,
        streamIntervalMs: 40,
    });
    const listProps = getAiChatListProps({ anchorIndex, messages });

    return (
        <Shell>
            <LegendList ref={listRef} {...listProps} />
            <ChatComposer
                input={input}
                onChangeText={setInput}
                onPress={() => sendPrompt(input)}
                placeholder="Ask about list behavior"
            />
        </Shell>
    );
}
