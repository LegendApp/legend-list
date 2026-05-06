import type React from "react";
import { useRef, useState } from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { Shell } from "./shared";

type Message = {
    id: string;
    role: "assistant" | "user";
    text: string;
};

const sessionMessages: Message[] = [
    {
        id: "assistant-0",
        role: "assistant",
        text: "Here is the initial context. This assistant message is intentionally taller so the anchored end spacer has real content to account for when the list first renders.",
    },
    {
        id: "user-0",
        role: "user",
        text: "Can you summarize the scroll behavior?",
    },
    {
        id: "assistant-1",
        role: "assistant",
        text: "Sure. The list starts at the end, then the add button appends another copy of the seed messages and scrolls to the first appended item while anchoredEndSpace is active.",
    },
    {
        id: "user-1",
        role: "user",
        text: "This is the user message that should be anchored near the top.",
    },
    {
        id: "assistant-2",
        role: "assistant",
        text: "The repro keeps the same rough shape as the reported sidebar code: derived anchor index until the first click, then an explicit anchor index for the appended item.",
    },
];

function useCurrentSessionMessages() {
    return { messages: { data: sessionMessages } };
}

function getString(message: Message) {
    return message.text;
}

function findLastUserMessageIndex(messages: Message[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.role === "user") {
            return index;
        }
    }

    return -1;
}

function SidebarBubble({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-3 ml-auto max-w-[78%] rounded-2xl bg-[#111827] px-4 py-3 text-white shadow-sm">
            <div className="whitespace-pre-wrap leading-[1.5]">{children}</div>
        </div>
    );
}

function SidebarMessages() {
    const { messages } = useCurrentSessionMessages();
    const listRef = useRef<LegendListRef>(null);

    const [extraItems, setExtraItems] = useState<Message[]>([]);
    const listMessages = messages.data.concat(...extraItems);
    const lastUserMessageIndex = findLastUserMessageIndex(listMessages);
    const [_anchorIndex, setAnchorIndex] = useState<number | undefined>(undefined);

    const anchorIndex = _anchorIndex ?? lastUserMessageIndex;

    return (
        <div className="relative flex min-h-0 grow basis-0 flex-col overflow-hidden text-sm">
            {messages.data && (
                <button
                    className="absolute bottom-3 right-3 z-10 rounded-full border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 shadow-sm"
                    onClick={() => {
                        const nextIndex = listMessages.length;
                        setAnchorIndex(nextIndex);
                        setExtraItems([...extraItems, ...messages.data.slice(0, 2)]);
                        listRef.current?.scrollToIndex({
                            animated: true,
                            index: nextIndex,
                        });
                    }}
                    type="button"
                >
                    add
                </button>
            )}
            <LegendList
                anchoredEndSpace={anchorIndex !== undefined ? { anchorIndex: anchorIndex } : undefined}
                className="no-scrollbar min-h-0 flex-1"
                contentContainerClassName="px-4"
                data={listMessages}
                estimatedItemSize={520}
                initialScrollAtEnd
                keyExtractor={(item, index) => item.id + index}
                maintainVisibleContentPosition
                recycleItems
                ref={listRef}
                renderItem={({ item: message, index }: { item: Message; index: number }) => {
                    const str = getString(message);

                    if (message.role === "assistant") {
                        return (
                            <div className="mb-3 max-w-[86%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm">
                                <div className="whitespace-pre-wrap leading-[1.5]">{str}</div>
                            </div>
                        );
                    }

                    return (
                        <SidebarBubble>
                            {str} {index}
                        </SidebarBubble>
                    );
                }}
            />
        </div>
    );
}

export function AiChatExample() {
    return (
        <Shell title="AI Chat">
            <SidebarMessages />
        </Shell>
    );
}
