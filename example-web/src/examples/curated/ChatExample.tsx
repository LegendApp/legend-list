import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildChatMessages, type ChatMessage } from "@examples/chat";
import { buttonStyle, CARD_CLASS, ChatAttachmentCard, cardStyle, listViewportStyle, Shell } from "./shared";

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
            <div className="flex min-h-0 flex-1 flex-col">
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
                            className={`${CARD_CLASS} w-fit max-w-[82%]`}
                            style={{
                                ...cardStyle(item.sender === "self" ? "#DBEAFE" : "#FFFFFF"),
                                marginLeft: item.sender === "self" ? "auto" : 0,
                            }}
                        >
                            <div className="mb-1 text-xs font-bold">{item.senderName}</div>
                            {item.attachment ? <ChatAttachmentCard attachment={item.attachment} /> : null}
                            <div className="whitespace-pre-wrap">{item.text}</div>
                            <div className="mt-2 text-[11px] text-slate-500">{item.timestampLabel}</div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
                <div className="mt-3 flex gap-3">
                    <input
                        className="flex-1 rounded-2xl border border-gray-300 bg-white px-[14px] py-3"
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                sendMessage(input);
                            }
                        }}
                        placeholder="Type a message"
                        value={input}
                    />
                    <button className={buttonStyle(true)} onClick={() => sendMessage(input)} type="button">
                        Send
                    </button>
                </div>
            </div>
        </Shell>
    );
}
