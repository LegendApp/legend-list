import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { type AiMessage, buildAiConversation, buildAssistantReply } from "@examples/chat";
import { Shell } from "./shared";

const AI_CHAT_ANCHOR_MAX_LINES = 2;
const AI_CHAT_BODY_LINE_HEIGHT = 20;
const AI_CHAT_ANCHOR_MAX_SIZE = AI_CHAT_ANCHOR_MAX_LINES * AI_CHAT_BODY_LINE_HEIGHT + 32;

function AiBubble({ message }: { message: AiMessage }) {
    const isUser = message.sender === "user";

    return (
        <div
            className={
                isUser
                    ? "mb-3 ml-auto max-w-[78%] rounded-2xl bg-[#111827] px-4 py-3 text-white shadow-sm"
                    : "mb-3 max-w-[86%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm"
            }
        >
            <div className="whitespace-pre-wrap leading-[1.5]">{message.text || "Thinking..."}</div>
            <div className={isUser ? "mt-2 text-xs text-white/70" : "mt-2 text-xs text-slate-500"}>
                {message.isPlaceholder ? "Streaming..." : message.timestampLabel}
            </div>
        </div>
    );
}

function SidebarMessages() {
    const conversation = useMemo(() => buildAiConversation(), []);
    const listRef = useRef<LegendListRef>(null);
    const nextIdRef = useRef(conversation.initialMessages.length);
    const streamTimerRef = useRef<number | undefined>(undefined);

    const [messages, setMessages] = useState<AiMessage[]>(() => conversation.initialMessages);
    const [anchorIndex, setAnchorIndex] = useState<number | undefined>(undefined);
    const [input, setInput] = useState("");
    const [showScrollToEnd, setShowScrollToEnd] = useState(false);

    const stopStreaming = useCallback(() => {
        if (streamTimerRef.current !== undefined) {
            window.clearInterval(streamTimerRef.current);
            streamTimerRef.current = undefined;
        }
    }, []);

    const updateScrollToEndVisibility = useCallback(() => {
        const state = listRef.current?.getState?.() as { isAtEnd?: boolean; isNearEnd?: boolean } | undefined;
        const isNearEnd = state?.isNearEnd ?? state?.isAtEnd;
        if (isNearEnd === undefined) {
            return;
        }

        setShowScrollToEnd(!isNearEnd);
    }, []);

    useEffect(() => {
        const frame = requestAnimationFrame(() => updateScrollToEndVisibility());
        return () => cancelAnimationFrame(frame);
    }, [messages.length, updateScrollToEndVisibility]);

    useEffect(() => stopStreaming, [stopStreaming]);

    const scrollToEnd = useCallback(() => {
        listRef.current?.scrollToEnd({ animated: true });
        setShowScrollToEnd(false);
    }, []);

    const sendPrompt = useCallback(() => {
        const trimmedInput = input.trim();
        if (!trimmedInput) {
            return;
        }

        const newPromptIndex = messages.length;
        const replyWords = buildAssistantReply(trimmedInput, nextIdRef.current).split(/(\s+)/);
        const placeholderId = `assistant-${nextIdRef.current++}`;

        stopStreaming();
        setAnchorIndex(newPromptIndex);
        setMessages((current) => [
            ...current,
            {
                id: `user-${nextIdRef.current++}`,
                sender: "user",
                text: trimmedInput,
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
        scrollToEnd();

        setTimeout(() => {
            let wordIndex = 0;
            streamTimerRef.current = window.setInterval(() => {
                wordIndex += 1;
                const nextText = replyWords.slice(0, wordIndex).join("");
                setMessages((current) =>
                    current.map((message) =>
                        message.id === placeholderId
                            ? {
                                  ...message,
                                  isPlaceholder: wordIndex < replyWords.length,
                                  text: nextText,
                              }
                            : message,
                    ),
                );

                if (wordIndex >= replyWords.length) {
                    stopStreaming();
                }
            }, 20);
        }, 1000);
    }, [input, messages.length, scrollToEnd, stopStreaming]);

    return (
        <div className="flex min-h-0 grow basis-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-sm">
            <div className="relative min-h-0 flex-1">
                <LegendList<AiMessage>
                    anchoredEndSpace={
                        anchorIndex !== undefined
                            ? {
                                  anchorIndex,
                                  anchorMaxSize: AI_CHAT_ANCHOR_MAX_SIZE,
                                  anchorOffset: 16,
                              }
                            : undefined
                    }
                    className="no-scrollbar h-full min-h-0"
                    contentContainerClassName="px-4"
                    data={messages}
                    estimatedItemSize={520}
                    initialScrollAtEnd
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition
                    onScroll={updateScrollToEndVisibility}
                    recycleItems
                    ref={listRef}
                    renderItem={({ item }) => <AiBubble message={item} />}
                />

                {showScrollToEnd ? (
                    <button
                        aria-label="Scroll to end"
                        className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#111827] text-white shadow-lg shadow-slate-900/25"
                        onClick={scrollToEnd}
                        title="Scroll to end"
                        type="button"
                    >
                        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
                            <path
                                d="M5 8L10 13L15 8"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.2"
                            />
                        </svg>
                    </button>
                ) : null}
            </div>

            <form
                className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    sendPrompt();
                }}
            >
                <input
                    className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                    onChange={(event) => setInput(event.currentTarget.value)}
                    placeholder="Ask about list behavior"
                    value={input}
                />
                <button
                    className="rounded-full bg-slate-950 px-5 py-3 font-semibold text-white shadow-sm"
                    type="submit"
                >
                    Send
                </button>
            </form>
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
