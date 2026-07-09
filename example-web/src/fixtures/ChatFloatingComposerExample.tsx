import type React from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react";
import { createMessage, defaultChatMessages, type Message } from "./ChatExample";

function Bubble({ message }: { message: Message }) {
    const isUser = message.sender === "user";

    return (
        <div className="mb-2 flex flex-col items-start gap-1">
            <div
                className="max-w-[75%] rounded-2xl px-4 py-3 shadow-sm"
                style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    background: isUser ? "#007AFF" : "#fff",
                    color: isUser ? "#fff" : "#1f2937",
                }}
            >
                {message.text}
            </div>
            <span
                className="text-xs text-[#6b7280]"
                style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                }}
            >
                {new Date(message.timeStamp).toLocaleTimeString()}
            </span>
        </div>
    );
}

export default function ChatFloatingComposerExample() {
    const listRef = useRef<LegendListRef>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>(defaultChatMessages);
    const [composerHeight, setComposerHeight] = useState(0);
    const [draft, setDraft] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [showScrollToEnd, setShowScrollToEnd] = useState(false);

    useLayoutEffect(() => {
        const composer = composerRef.current;
        if (!composer) {
            return;
        }

        const updateComposerHeight = () => {
            setComposerHeight(composer.getBoundingClientRect().height);
        };

        updateComposerHeight();

        const observer = new ResizeObserver(updateComposerHeight);
        observer.observe(composer);

        return () => observer.disconnect();
    }, []);

    const updateScrollToEndVisibility = useCallback(() => {
        const isAtEnd = listRef.current?.getState().isAtEnd;
        if (isAtEnd === undefined) {
            return;
        }

        const shouldShow = !isAtEnd;
        setShowScrollToEnd((prev) => (prev === shouldShow ? prev : shouldShow));
    }, []);

    const scrollToEnd = useCallback(() => {
        listRef.current?.scrollToEnd({ animated: true });
        setShowScrollToEnd(false);
    }, []);

    const sendMessage = useCallback(() => {
        const trimmedDraft = draft.trim();
        const text = trimmedDraft || "Add another message.";
        const userMessage = createMessage(text, "user");
        const botResponse = createMessage(`Answer: ${text.toUpperCase()}`, "bot");

        setMessages([...messages, userMessage, botResponse]);
        setDraft("");
        listRef.current?.scrollToEnd({ animated: true });
    }, [draft, messages]);

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            sendMessage();
        },
        [sendMessage],
    );

    const handleScroll = useCallback(() => {
        updateScrollToEndVisibility();
    }, [updateScrollToEndVisibility]);

    return (
        <div className="relative h-full min-h-0 overflow-hidden bg-slate-100 text-sm">
            <LegendList<Message>
                className="no-scrollbar h-full min-h-0"
                contentContainerClassName="px-4 pt-4"
                contentInsetEndAdjustment={composerHeight + 24}
                data={messages}
                estimatedItemSize={80}
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                onLoad={updateScrollToEndVisibility}
                onScroll={handleScroll}
                recycleItems
                ref={listRef}
                renderItem={({ item }: LegendListRenderItemProps<Message>) => <Bubble message={item} />}
            />
            {showScrollToEnd ? (
                <button
                    className="absolute right-4 cursor-pointer rounded-full border-0 bg-[#0f172a] px-3.5 py-2.5 text-white shadow-[0_4px_12px_rgba(15,23,42,0.2)]"
                    onClick={scrollToEnd}
                    style={{ bottom: composerHeight + 32 }}
                    type="button"
                >
                    Scroll to latest
                </button>
            ) : null}
            <div
                className="absolute bottom-3 left-4 right-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
                ref={composerRef}
            >
                <form onSubmit={handleSubmit}>
                    <textarea
                        className="block min-h-12 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 leading-[1.45] text-slate-900 outline-none focus:border-slate-500"
                        onChange={(event) => setDraft(event.currentTarget.value)}
                        placeholder="Type a message"
                        rows={expanded ? 5 : 2}
                        value={draft}
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                            className="rounded-full border border-slate-300 bg-white px-3 py-2 font-medium text-slate-800 shadow-sm"
                            onClick={() => setExpanded(!expanded)}
                            type="button"
                        >
                            {expanded ? "Shrink" : "Grow"}
                        </button>
                        <button
                            className="rounded-full bg-slate-950 px-4 py-2 font-semibold text-white shadow-sm"
                            type="submit"
                        >
                            Send
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
