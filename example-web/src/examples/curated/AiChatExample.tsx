import React from "react";

import { LegendList } from "@legendapp/list/react";
import { type AiMessage, buildAiConversation, buildAssistantReply } from "@examples/chat";
import { buttonStyle, cardStyle, listViewportStyle, Shell } from "./shared";

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
    const [input, setInput] = React.useState("");
    const nextIdRef = React.useRef(conversation.initialMessages.length);
    const streamTimerRef = React.useRef<number | null>(null);

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
        [stopStreaming],
    );

    React.useEffect(() => stopStreaming, [stopStreaming]);

    return (
        <Shell title="AI Chat">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {AI_SUGGESTIONS.map((suggestion) => (
                        <button
                            key={suggestion.label}
                            onClick={() => sendPrompt(suggestion.prompt)}
                            style={buttonStyle()}
                            type="button"
                        >
                            {suggestion.label}
                        </button>
                    ))}
                </div>
                <LegendList
                    contentContainerStyle={{ padding: 8 }}
                    data={messages}
                    estimatedItemSize={520}
                    initialScrollIndex={messages.length - 1}
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition
                    renderItem={({ item }: { item: AiMessage }) => (
                        <div
                            style={{
                                ...cardStyle(item.sender === "user" ? "#111827" : "#FFFFFF"),
                                color: item.sender === "user" ? "#FFFFFF" : "#111827",
                                marginLeft: item.sender === "user" ? "auto" : 0,
                                maxWidth: "82%",
                                width: "fit-content",
                            }}
                        >
                            <div style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{item.text || "Thinking..."}</div>
                            <div style={{ fontSize: 12, marginTop: 8, opacity: 0.75 }}>
                                {item.isPlaceholder ? "Streaming..." : item.timestampLabel}
                            </div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <input
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Ask about list behavior"
                        style={{
                            background: "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: 16,
                            flex: 1,
                            padding: "12px 14px",
                        }}
                        value={input}
                    />
                    <button onClick={() => sendPrompt(input)} style={buttonStyle(true)} type="button">
                        Send
                    </button>
                </div>
            </div>
        </Shell>
    );
}
