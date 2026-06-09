import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";

type Message = {
    id: string;
    role: "assistant" | "user";
    text: string;
};

const messagePairs: Array<{ assistant: string; user: string }> = [
    {
        assistant:
            "Here is the initial context. The composer is floating over the list, so the list receives contentInsetEndAdjustment instead of relying on content padding.",
        user: "Can you keep the tail visible while the composer changes height?",
    },
    {
        assistant:
            "Yes. When the floating composer grows or shrinks, contentInsetEndAdjustment changes and the list adjusts the scroll position if it was already pinned to the end.",
        user: "This should behave like the AI chat fixture, but with an absolute composer.",
    },
    {
        assistant:
            "The fixture keeps anchoredEndSpace active so the messages around the tail remain mounted while the overlay inset handles the floating input area.",
        user: "What happens if I scroll upward and then grow the composer?",
    },
    {
        assistant:
            "If you are away from the end, the overlay still reserves space, but the viewport should not be pulled back down. The adjustment only applies when the list was already within the end threshold.",
        user: "Add enough history that the initial render starts at the tail.",
    },
    {
        assistant:
            "This seeded history is intentionally long. It gives the floating composer room to cover real content, tests initialScrollAtEnd, and makes grow/shrink changes visible.",
        user: "Does the measured composer height include the buttons below the input?",
    },
    {
        assistant:
            "It does. ResizeObserver measures the full floating composer shell, then the list adds a small breathing gap before passing the value to contentInsetEndAdjustment.",
        user: "Send should clear the draft after appending the new messages.",
    },
    {
        assistant:
            "The textarea now starts empty with a placeholder. Sending appends the user message and a response, then clears the input so the next send starts fresh.",
        user: "Can we keep alternating short and long bubbles?",
    },
    {
        assistant:
            "Yes. A few assistant messages are longer to exercise variable measurement. That makes the anchored end space and overlay inset interaction easier to spot during manual testing.",
        user: "Great. I will use the Grow button while pinned at the bottom.",
    },
];

const seedMessages: Message[] = messagePairs.flatMap((pair, index) => [
    {
        id: `assistant-${index}`,
        role: "assistant",
        text: pair.assistant,
    },
    {
        id: `user-${index}`,
        role: "user",
        text: pair.user,
    },
]);

function findLastUserMessageIndex(messages: Message[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.role === "user") {
            return index;
        }
    }

    return -1;
}

function Bubble({ children, role }: { children: React.ReactNode; role: Message["role"] }) {
    const isUser = role === "user";

    return (
        <div
            className={
                isUser
                    ? "mb-3 ml-auto max-w-[78%] rounded-2xl bg-[#111827] px-4 py-3 text-white shadow-sm"
                    : "mb-3 max-w-[86%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm"
            }
        >
            <div className="whitespace-pre-wrap leading-[1.5]">{children}</div>
        </div>
    );
}

export default function AiChatFloatingComposerExample() {
    const listRef = useRef<LegendListRef>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState(seedMessages);
    const [composerHeight, setComposerHeight] = useState(0);
    const [draft, setDraft] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [anchorIndex, setAnchorIndex] = useState<number | undefined>(() => findLastUserMessageIndex(seedMessages));

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

    const sendMessage = () => {
        const nextIndex = messages.length;
        const trimmedDraft = draft.trim();
        const userMessage: Message = {
            id: `user-${nextIndex}`,
            role: "user",
            text: trimmedDraft || "Add another message.",
        };
        const assistantMessage: Message = {
            id: `assistant-${nextIndex}`,
            role: "assistant",
            text: "The floating composer remains outside normal content flow. The list reserves the measured overlay height with contentInsetEndAdjustment and stays pinned when already at the end.",
        };

        setAnchorIndex(nextIndex);
        setMessages([...messages, userMessage, assistantMessage]);
        setDraft("");
        listRef.current?.scrollToEnd({ animated: true });
    };

    return (
        <div className="relative h-full min-h-0 overflow-hidden bg-slate-100 text-sm">
            <LegendList
                anchoredEndSpace={anchorIndex !== undefined ? { anchorIndex } : undefined}
                className="no-scrollbar h-full min-h-0"
                contentContainerClassName="px-4 pt-4"
                contentInsetEndAdjustment={composerHeight + 24}
                data={messages}
                estimatedItemSize={220}
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                recycleItems
                ref={listRef}
                renderItem={({ item: message, index }: { item: Message; index: number }) => (
                    <Bubble role={message.role}>
                        {message.text} {message.role === "user" ? index : ""}
                    </Bubble>
                )}
            />
            <div
                className="absolute bottom-3 left-4 right-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
                ref={composerRef}
            >
                <textarea
                    className="block min-h-12 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 leading-[1.45] text-slate-900 outline-none focus:border-slate-500"
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    placeholder="Ask about the scrolling behavior."
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
                        onClick={sendMessage}
                        type="button"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
