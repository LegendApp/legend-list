import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildChatMessages, type ChatMessage } from "@examples/chat";
import { buttonStyle, ChatAttachmentCard, cardStyle, listViewportStyle, Shell } from "./shared";

export function ChatExample() {
    const [messages, setMessages] = React.useState<ChatMessage[]>(() => buildChatMessages());
    const [input, setInput] = React.useState("");
    const replyTimerRef = React.useRef<number | null>(null);

    const clearReplyTimer = React.useCallback(() => {
        if (replyTimerRef.current !== null) {
            window.clearTimeout(replyTimerRef.current);
            replyTimerRef.current = null;
        }
    }, []);

    const sendMessage = React.useCallback(
        (draft: string) => {
            const trimmedDraft = draft.trim();
            if (!trimmedDraft) {
                return;
            }

            clearReplyTimer();
            setMessages((current) => [
                ...current,
                {
                    id: `message-${current.length + 1}`,
                    sender: "self",
                    senderName: "You",
                    text: trimmedDraft,
                    timestampLabel: "Now",
                },
            ]);
            setInput("");

            replyTimerRef.current = window.setTimeout(() => {
                setMessages((current) => [
                    ...current,
                    {
                        attachment:
                            trimmedDraft.length % 3 === 0
                                ? {
                                      accent: "#38BDF8",
                                      height: 136,
                                      label: "Preview",
                                      subtitle: "Latest thread capture",
                                  }
                                : undefined,
                        id: `message-${current.length + 1}`,
                        sender: "other",
                        senderName: "Nina",
                        text:
                            trimmedDraft.length < 36
                                ? `Received: ${trimmedDraft}\n\nI added it to the running thread so we can watch the anchored viewport hold while the newest rows arrive.`
                                : `Received: ${trimmedDraft}\n\nThis is the kind of longer follow-up that makes the example more credible, because it changes the row height enough to show whether the list keeps the bottom edge stable while the conversation continues.`,
                        timestampLabel: "Now",
                    },
                ]);
                replyTimerRef.current = null;
            }, 300);
        },
        [clearReplyTimer],
    );

    React.useEffect(() => clearReplyTimer, [clearReplyTimer]);

    return (
        <Shell title="Chat">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <LegendList
                    alignItemsAtEnd
                    contentContainerStyle={{ padding: 8 }}
                    data={messages}
                    estimatedItemSize={168}
                    initialScrollIndex={messages.length - 1}
                    keyExtractor={(item) => item.id}
                    maintainScrollAtEnd
                    maintainVisibleContentPosition
                    renderItem={({ item }: { item: ChatMessage }) => (
                        <div
                            style={{
                                ...cardStyle(item.sender === "self" ? "#DBEAFE" : "#FFFFFF"),
                                marginLeft: item.sender === "self" ? "auto" : 0,
                                maxWidth: "82%",
                                width: "fit-content",
                            }}
                        >
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{item.senderName}</div>
                            {item.attachment ? <ChatAttachmentCard attachment={item.attachment} /> : null}
                            <div style={{ whiteSpace: "pre-wrap" }}>{item.text}</div>
                            <div style={{ color: "#64748b", fontSize: 11, marginTop: 8 }}>{item.timestampLabel}</div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <input
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                sendMessage(input);
                            }
                        }}
                        placeholder="Type a message"
                        style={{
                            background: "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: 16,
                            flex: 1,
                            padding: "12px 14px",
                        }}
                        value={input}
                    />
                    <button onClick={() => sendMessage(input)} style={buttonStyle(true)} type="button">
                        Send
                    </button>
                </div>
            </div>
        </Shell>
    );
}
