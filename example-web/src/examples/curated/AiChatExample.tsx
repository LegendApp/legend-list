import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { type AiMessage, buildAiConversation, buildAssistantReply } from "@examples/chat";
import { buttonStyle, CARD_CLASS, cardStyle, listViewportStyle, Shell } from "./shared";

const AI_SUGGESTIONS = [
    {
        label: "Stable anchors",
        prompt: "Summarize why stable anchors matter for chat UIs.",
    },
    {
        label: "Mixed heights",
        prompt: "Explain how mixed row heights affect virtualization.",
    },
    {
        label: "Visible content",
        prompt: "Describe when to use maintainVisibleContentPosition.",
    },
] as const;

export function AiChatExample() {
    const conversation = React.useMemo(() => buildAiConversation(), []);
    const [messages, setMessages] = React.useState<AiMessage[]>(() => conversation.initialMessages);
    const [anchorIndex, setAnchorIndex] = React.useState<number | undefined>(undefined);
    const [input, setInput] = React.useState("");
    const nextIdRef = React.useRef(conversation.initialMessages.length);
    const streamTimerRef = React.useRef<number | null>(null);
    const listRef = React.useRef<LegendListRef | null>(null);

    const stopStreaming = React.useCallback(() => {
        if (streamTimerRef.current !== null) {
            window.clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
        }
    }, []);

    const sendPrompt = React.useCallback(
        (nextPrompt: string) => {
            const trimmedPrompt = nextPrompt.trim();
            if (!trimmedPrompt) {
                return;
            }

            stopStreaming();
            const words = buildAssistantReply(trimmedPrompt, nextIdRef.current).split(/(\s+)/);
            const placeholderId = `assistant-${nextIdRef.current++}`;
            const nextAnchorIndex = messages.length;

            setAnchorIndex(nextAnchorIndex);
            setMessages((current) => [
                ...current,
                {
                    id: `user-${nextIdRef.current++}`,
                    sender: "user",
                    text: trimmedPrompt,
                    timestampLabel: "Now",
                },
                {
                    id: placeholderId,
                    isPlaceholder: true,
                    sender: "assistant",
                    text: "",
                    timestampLabel: "Now",
                },
            ]);
            setInput("");

            listRef.current?.scrollToIndex({ animated: true, index: nextAnchorIndex });

            let index = 0;
            streamTimerRef.current = window.setInterval(() => {
                index += 1;
                const nextReply = words.slice(0, index).join("");
                setMessages((current) =>
                    current.map((message) =>
                        message.id === placeholderId
                            ? {
                                  ...message,
                                  isPlaceholder: index < words.length,
                                  text: nextReply,
                              }
                            : message,
                    ),
                );

                if (index >= words.length) {
                    stopStreaming();
                }
            }, 40);
        },
        [messages.length, stopStreaming],
    );

    React.useEffect(() => stopStreaming, [stopStreaming]);

    return (
        <Shell title="AI Chat">
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex flex-wrap gap-2">
                    {AI_SUGGESTIONS.map((suggestion) => (
                        <button
                            className={buttonStyle()}
                            key={suggestion.label}
                            onClick={() => sendPrompt(suggestion.prompt)}
                            type="button"
                        >
                            {suggestion.label}
                        </button>
                    ))}
                </div>
                <LegendList
                    anchoredEndSpace={anchorIndex !== undefined ? { anchorIndex } : undefined}
                    contentContainerStyle={{ padding: 8 }}
                    data={messages}
                    estimatedItemSize={520}
                    initialScrollAtEnd
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition
                    ref={listRef}
                    renderItem={({ item }: { item: AiMessage }) => (
                        <div
                            className={`${CARD_CLASS} w-fit max-w-[82%]`}
                            style={{
                                ...cardStyle(item.sender === "user" ? "#111827" : "#FFFFFF"),
                                color: item.sender === "user" ? "#FFFFFF" : "#111827",
                                marginLeft: item.sender === "user" ? "auto" : 0,
                            }}
                        >
                            <div className="whitespace-pre-wrap leading-[1.5]">{item.text || "Thinking..."}</div>
                            <div className="mt-2 text-xs opacity-75">
                                {item.isPlaceholder ? "Streaming..." : item.timestampLabel}
                            </div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
                <div className="mt-3 flex gap-3">
                    <input
                        className="flex-1 rounded-2xl border border-gray-300 bg-white px-[14px] py-3"
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                sendPrompt(input);
                            }
                        }}
                        placeholder="Ask about list behavior"
                        value={input}
                    />
                    <button className={buttonStyle(true)} onClick={() => sendPrompt(input)} type="button">
                        Send
                    </button>
                </div>
            </div>
        </Shell>
    );
}
