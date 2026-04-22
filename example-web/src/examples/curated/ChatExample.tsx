import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { buildChatMessages, type ChatMessage } from "@examples/chat";
import { buttonStyle, CARD_CLASS, ChatAttachmentCard, cardStyle, listViewportStyle, Shell } from "./shared";

const INCOMING_SPEED_OPTIONS = [1, 2, 3, 4, 5] as const;
const LOAD_OLDER_DELAY_OPTIONS = [0, 250, 500, 1000, 1500] as const;
const THRESHOLD_OPTIONS = Array.from({ length: 11 }, (_, index) => Number((index / 10).toFixed(1)));
const REACTION_OPTIONS = ["👍", "❤️", "😂", "🎉", "👀"] as const;
const PREPEND_BATCH_SIZE = 20;

type Sender = "me" | "other";

type PlaygroundMessage = {
    id: string;
    sender: Sender;
    text: string;
    timestamp: number;
    reactions: string[];
};

type DayRow = {
    id: string;
    dayKey: string;
    label: string;
    type: "day";
};

type MessageRow = {
    id: string;
    message: PlaygroundMessage;
    type: "message";
};

type TypingRow = {
    id: string;
    dayKey: string;
    type: "typing";
};

type ChatRow = DayRow | MessageRow | TypingRow;

const shortTemplates = ["On it.", "Looks good to me.", "Can you share a screenshot?", "That fixed it. Thanks!"];

const mediumTemplates = [
    "I moved the list into a fixed-height container and the scrolling feels much smoother now.",
    "Can we make the sticky date separators a bit more subtle so they do not overpower the messages?",
    "I am testing this on Safari too to make sure scroll anchoring behaves the same as Chrome.",
];

const longTemplates = [
    "I just tried loading older messages from the top while receiving new ones, and the viewport stayed stable. This is exactly the chat behavior we wanted in production.",
    "The message row heights are intentionally mixed here: single-line responses, multiline notes, and simulated attachment blocks. That combination is useful for validating measurement accuracy.",
    "When we tweak maintainScrollAtEndThreshold we can clearly see how strict or forgiving bottom-follow becomes, which makes this demo a good teaching tool for product teams.",
];

const attachmentTemplates = [
    "Design review notes:\n• Confirm sticky day headers\n• Keep input docked\n• Verify unread marker behavior",
    "Attachment: sprint-plan.pdf\nPages: 7\nSummary: Timeline updated after API migration",
    "Release checklist:\n1. Run smoke tests\n2. Validate chat replay\n3. Monitor scroll metrics",
];

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

function ChatBubbleMessageItem({
    message,
    onAddReaction,
}: {
    message: PlaygroundMessage;
    onAddReaction: (messageId: string, emoji: string) => void;
}) {
    const isMine = message.sender === "me";
    const [isReactionMenuOpen, setIsReactionMenuOpen] = React.useState(false);

    React.useEffect(() => {
        setIsReactionMenuOpen(false);
    }, [message.id]);

    return (
        <div className={cx("flex px-4 py-1.5", isMine ? "justify-end" : "justify-start")}>
            <div className={cx("relative flex max-w-[80%] flex-col", isMine ? "items-end" : "items-start")}>
                <div className={cx("flex w-full items-end gap-2", isMine ? "flex-row-reverse" : "flex-row")}>
                    <div className="relative shrink-0">
                        <button
                            className="inline-flex h-7 w-7 min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 p-0 text-xs text-zinc-300"
                            onClick={() => setIsReactionMenuOpen((previous) => !previous)}
                            title="Add reaction"
                            type="button"
                        >
                            +
                        </button>

                        {isReactionMenuOpen ? (
                            <div
                                className={cx(
                                    "absolute top-[34px] z-10 flex gap-1.5 rounded-[10px] border border-zinc-700 bg-zinc-900 p-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.4)]",
                                    isMine ? "right-0" : "left-0",
                                )}
                            >
                                {REACTION_OPTIONS.map((emoji) => (
                                    <button
                                        className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-base leading-none"
                                        key={`${message.id}-${emoji}`}
                                        onClick={() => {
                                            onAddReaction(message.id, emoji);
                                            setIsReactionMenuOpen(false);
                                        }}
                                        type="button"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div
                        className={cx(
                            "overflow-hidden rounded-2xl px-3 py-2.5",
                            isMine ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-200",
                        )}
                    >
                        <div className="whitespace-pre-line text-sm leading-6">{message.text}</div>

                        {message.reactions.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {message.reactions.map((reaction, index) => (
                                    <span
                                        className={cx(
                                            "rounded-full px-2 py-0.5 text-[13px] text-zinc-100",
                                            isMine ? "bg-white/20" : "bg-zinc-700",
                                        )}
                                        key={`${message.id}-reaction-${index}`}
                                    >
                                        {reaction}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="mt-1 text-[11px] text-zinc-400">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
            </div>
        </div>
    );
}

function toDayKey(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDayLabel(dayKey: string): string {
    const now = new Date();
    const todayKey = toDayKey(now.getTime());
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = toDayKey(yesterday.getTime());

    if (dayKey === todayKey) return "Today";
    if (dayKey === yesterdayKey) return "Yesterday";

    const [year, month, day] = dayKey.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function buildMixedMessageText(index: number): string {
    if (index % 7 === 0) return attachmentTemplates[index % attachmentTemplates.length]!;
    if (index % 4 === 0) return longTemplates[index % longTemplates.length]!;
    if (index % 2 === 0) return mediumTemplates[index % mediumTemplates.length]!;
    return shortTemplates[index % shortTemplates.length]!;
}

function createSeedMessages(getNextId: () => string): PlaygroundMessage[] {
    const now = Date.now();
    const start = now - 1000 * 60 * 60 * 24 * 10;
    const totalMessages = 64;
    const span = now - start;

    return Array.from({ length: totalMessages }, (_, index) => {
        const progress = index / (totalMessages - 1);
        const timestamp = Math.floor(start + progress * span);
        const sender: Sender = index % 3 === 0 ? "other" : "me";
        return {
            id: getNextId(),
            reactions: [],
            sender,
            text: buildMixedMessageText(index),
            timestamp,
        };
    });
}

function createOlderBatch(getNextId: () => string, beforeTimestamp: number, indexSeed: number): PlaygroundMessage[] {
    const messages: PlaygroundMessage[] = [];
    let cursor = beforeTimestamp;

    for (let index = 0; index < PREPEND_BATCH_SIZE; index++) {
        const minutes = 120 + ((index + indexSeed) % 4) * 60;
        cursor -= minutes * 60 * 1000;
        const sender: Sender = (index + indexSeed) % 3 === 0 ? "me" : "other";
        messages.push({
            id: getNextId(),
            reactions: [],
            sender,
            text: buildMixedMessageText(indexSeed + index),
            timestamp: cursor,
        });
    }

    return messages.reverse();
}

function createIncomingMessage(getNextId: () => string, index: number): PlaygroundMessage {
    return {
        id: getNextId(),
        reactions: [],
        sender: "other",
        text: buildMixedMessageText(index),
        timestamp: Date.now(),
    };
}

function buildRows(
    messages: PlaygroundMessage[],
    includeTypingRow: boolean,
): { rows: ChatRow[]; stickyHeaderIndices: number[] } {
    const rows: ChatRow[] = [];
    const stickyHeaderIndices: number[] = [];
    let lastDayKey = "";

    for (const message of messages) {
        const dayKey = toDayKey(message.timestamp);
        if (dayKey !== lastDayKey) {
            stickyHeaderIndices.push(rows.length);
            rows.push({
                dayKey,
                id: `day-${dayKey}`,
                label: formatDayLabel(dayKey),
                type: "day",
            });
            lastDayKey = dayKey;
        }

        rows.push({
            id: message.id,
            message,
            type: "message",
        });
    }

    if (includeTypingRow) {
        const typingDayKey = toDayKey(Date.now());
        if (typingDayKey !== lastDayKey) {
            stickyHeaderIndices.push(rows.length);
            rows.push({
                dayKey: typingDayKey,
                id: `day-${typingDayKey}`,
                label: formatDayLabel(typingDayKey),
                type: "day",
            });
        }

        rows.push({
            dayKey: typingDayKey,
            id: "typing-indicator",
            type: "typing",
        });
    }

    return { rows, stickyHeaderIndices };
}

function ChatExamplePlayground() {
    const idCounterRef = React.useRef(0);
    const createId = React.useCallback(() => {
        const id = `msg-${idCounterRef.current}`;
        idCounterRef.current += 1;
        return id;
    }, []);

    const listRef = React.useRef<LegendListRef | null>(null);
    const timeoutsRef = React.useRef<number[]>([]);
    const prependSeedRef = React.useRef(1000);
    const isLoadingOlderRef = React.useRef(false);
    const incomingMessageIndexRef = React.useRef(2000);

    const [messages, setMessages] = React.useState<PlaygroundMessage[]>(() => createSeedMessages(createId));
    const [inputText, setInputText] = React.useState("");
    const [incomingSpeedSec, setIncomingSpeedSec] = React.useState<number>(5);
    const [loadOlderDelayMs, setLoadOlderDelayMs] = React.useState<number>(0);
    const [maintainScrollAtEndThreshold, setMaintainScrollAtEndThreshold] = React.useState<number>(0.1);
    const [startReachedThreshold, setStartReachedThreshold] = React.useState<number>(0.2);
    const [showScrollToLatest, setShowScrollToLatest] = React.useState<boolean>(false);
    const [isTyping, setIsTyping] = React.useState<boolean>(false);
    const [isLoadingOlder, setIsLoadingOlder] = React.useState<boolean>(false);

    const { rows, stickyHeaderIndices } = React.useMemo(() => buildRows(messages, isTyping), [messages, isTyping]);

    const updateScrollToLatestVisibility = React.useCallback(() => {
        const state = listRef.current?.getState?.() as { isAtEnd?: boolean } | undefined;
        if (state?.isAtEnd === undefined) {
            return;
        }
        setShowScrollToLatest(!state.isAtEnd);
    }, []);

    React.useEffect(() => {
        const raf = requestAnimationFrame(() => updateScrollToLatestVisibility());
        return () => cancelAnimationFrame(raf);
    }, [maintainScrollAtEndThreshold, rows.length, updateScrollToLatestVisibility]);

    React.useEffect(() => {
        const clearAllTimeouts = () => {
            for (const timeoutId of timeoutsRef.current) {
                window.clearTimeout(timeoutId);
            }
            timeoutsRef.current = [];
        };

        clearAllTimeouts();

        const intervalMs = incomingSpeedSec * 1000;
        const intervalId = window.setInterval(() => {
            setIsTyping(true);

            const typingDuration = Math.min(3200, Math.max(700, Math.floor(intervalMs * 0.75)));
            const timeoutId = window.setTimeout(() => {
                incomingMessageIndexRef.current += 1;
                setMessages((previous) => [
                    ...previous,
                    createIncomingMessage(createId, incomingMessageIndexRef.current),
                ]);
                setIsTyping(false);
            }, typingDuration);
            timeoutsRef.current.push(timeoutId);
        }, intervalMs);

        return () => {
            window.clearInterval(intervalId);
            clearAllTimeouts();
        };
    }, [createId, incomingSpeedSec]);

    const prependOlderMessages = React.useCallback(() => {
        setMessages((previous) => {
            const oldestTimestamp = previous[0]?.timestamp ?? Date.now();
            const older = createOlderBatch(createId, oldestTimestamp, prependSeedRef.current);
            prependSeedRef.current += PREPEND_BATCH_SIZE;
            return [...older, ...previous];
        });
        isLoadingOlderRef.current = false;
        setIsLoadingOlder(false);
    }, [createId]);

    const handleStartReached = React.useCallback(() => {
        if (isLoadingOlderRef.current) {
            return;
        }

        isLoadingOlderRef.current = true;
        setIsLoadingOlder(true);

        if (loadOlderDelayMs === 0) {
            prependOlderMessages();
            return;
        }

        const timeoutId = window.setTimeout(() => {
            prependOlderMessages();
        }, loadOlderDelayMs);
        timeoutsRef.current.push(timeoutId);
    }, [loadOlderDelayMs, prependOlderMessages]);

    const handleSendMessage = React.useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const text = inputText.trim();
            if (!text) {
                return;
            }

            setMessages((previous) => [
                ...previous,
                {
                    id: createId(),
                    reactions: [],
                    sender: "me",
                    text,
                    timestamp: Date.now(),
                },
            ]);
            setInputText("");
            requestAnimationFrame(() => {
                listRef.current?.scrollToEnd?.({ animated: true });
                setShowScrollToLatest(false);
            });
        },
        [createId, inputText],
    );

    const handleAddReaction = React.useCallback((messageId: string, emoji: string) => {
        setMessages((previous) =>
            previous.map((message) =>
                message.id === messageId
                    ? {
                          ...message,
                          reactions: [...message.reactions, emoji],
                      }
                    : message,
            ),
        );
    }, []);

    const renderRow = React.useCallback(
        ({ item }: { item: ChatRow }) => {
            if (item.type === "day") {
                return (
                    <div className="pointer-events-none px-4 py-2">
                        <div className="mx-auto max-w-[220px] rounded-full border border-zinc-700 bg-[rgba(24,24,27,0.92)] px-2.5 py-1 text-center text-xs font-semibold text-zinc-300 backdrop-blur-[3px]">
                            {item.label}
                        </div>
                    </div>
                );
            }

            if (item.type === "typing") {
                return (
                    <div className="flex justify-start px-4 py-1.5">
                        <div className="max-w-[72%] rounded-2xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200">
                            Typing…
                        </div>
                    </div>
                );
            }

            return <ChatBubbleMessageItem message={item.message} onAddReaction={handleAddReaction} />;
        },
        [handleAddReaction],
    );

    const scrollToLatest = React.useCallback(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
        setShowScrollToLatest(false);
    }, []);

    return (
        <Shell title="Chat">
            <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-zinc-700">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 border-b border-zinc-700 bg-[#111214] p-3">
                    <label className="flex flex-col gap-1.5 text-xs text-zinc-300">
                        Incoming speed
                        <select
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-[13px] text-zinc-200"
                            onChange={(event) => setIncomingSpeedSec(Number(event.target.value))}
                            value={incomingSpeedSec}
                        >
                            {INCOMING_SPEED_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    Every {option} second{option > 1 ? "s" : ""}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1.5 text-xs text-zinc-300">
                        Load older delay
                        <select
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-[13px] text-zinc-200"
                            onChange={(event) => setLoadOlderDelayMs(Number(event.target.value))}
                            value={loadOlderDelayMs}
                        >
                            {LOAD_OLDER_DELAY_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}ms
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1.5 text-xs text-zinc-300">
                        maintainScrollAtEndThreshold
                        <select
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-[13px] text-zinc-200"
                            onChange={(event) => setMaintainScrollAtEndThreshold(Number(event.target.value))}
                            value={maintainScrollAtEndThreshold}
                        >
                            {THRESHOLD_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option.toFixed(1)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1.5 text-xs text-zinc-300">
                        onStartReachedThreshold
                        <select
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-[13px] text-zinc-200"
                            onChange={(event) => setStartReachedThreshold(Number(event.target.value))}
                            value={startReachedThreshold}
                        >
                            {THRESHOLD_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option.toFixed(1)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="relative flex h-[680px] min-h-0 min-w-0 w-full flex-col bg-[#0d0f12]">
                    {isLoadingOlder ? (
                        <div className="border-b border-zinc-700 bg-[rgba(161,161,170,0.12)] px-3 py-1.5 text-center text-xs text-zinc-300">
                            Loading older messages…
                        </div>
                    ) : null}

                    <LegendList<ChatRow>
                        alignItemsAtEnd
                        className="min-h-0 flex-1 bg-[#0d0f12] overscroll-contain"
                        data={rows}
                        estimatedItemSize={90}
                        initialScrollIndex={Math.max(rows.length - 1, 0)}
                        keyExtractor={(item) => item.id}
                        ListFooterComponent={<div className="h-4" />}
                        maintainScrollAtEnd
                        maintainScrollAtEndThreshold={maintainScrollAtEndThreshold}
                        maintainVisibleContentPosition
                        onScroll={updateScrollToLatestVisibility}
                        onStartReached={handleStartReached}
                        onStartReachedThreshold={startReachedThreshold}
                        recycleItems
                        ref={listRef}
                        renderItem={renderRow}
                        stickyHeaderIndices={stickyHeaderIndices}
                    />

                    {showScrollToLatest ? (
                        <button
                            aria-label="Scroll to latest"
                            className="absolute bottom-[90px] right-4 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-zinc-100 shadow-lg shadow-black/40"
                            onClick={scrollToLatest}
                            title="Scroll to latest"
                            type="button"
                        >
                            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
                                <path
                                    d="M4 6L8 10L12 6"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.8"
                                />
                            </svg>
                        </button>
                    ) : null}

                    <form
                        className="flex items-center gap-2 border-t border-zinc-700 bg-[#111214] p-2.5"
                        onSubmit={handleSendMessage}
                    >
                        <input
                            className="min-w-0 flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-200"
                            onChange={(event) => setInputText(event.target.value)}
                            placeholder="Send a message..."
                            value={inputText}
                        />
                        <button
                            className="cursor-pointer rounded-full bg-blue-600 px-4 py-2.5 font-semibold text-white"
                            type="submit"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </Shell>
    );
}

function ChatExampleDefault() {
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
                    recycleItems
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

export function ChatExample({ playground = false }: { playground?: boolean } = {}) {
    if (playground) {
        return <ChatExamplePlayground />;
    }

    return <ChatExampleDefault />;
}
