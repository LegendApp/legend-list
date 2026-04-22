import { useRef } from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { ChatComposer, getAiChatListProps, useAiChatExample } from "./chatShared";
import { Shell } from "./shared";

export function AiChatExample() {
    const listRef = useRef<LegendListRef>(null);
    const { anchorIndex, input, messages, sendPrompt, setInput } = useAiChatExample({
        listRef,
        streamIntervalMs: 40,
    });
    const listProps = getAiChatListProps({ anchorIndex, messages });

    return (
        <Shell>
            <LegendList recycleItems ref={listRef} {...listProps} />
            <ChatComposer
                input={input}
                onChangeText={setInput}
                onPress={() => sendPrompt(input)}
                placeholder="Ask about list behavior"
            />
        </Shell>
    );
}
