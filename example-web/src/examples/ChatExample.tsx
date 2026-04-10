/** biome-ignore-all assist/source/useSortedKeys: Need them in specific order */
import React from "react";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react";

type Message = {
    id: string;
    text: string;
    sender: "user" | "bot";
    timeStamp: number;
};

const MS_PER_SECOND = 1000;

let idCounter = 0;

const baseTime = Date.now();

const createMessage = (text: string, sender: Message["sender"], timeStamp = Date.now()): Message => ({
    id: String(idCounter++),
    sender,
    text,
    timeStamp,
});

const defaultChatMessagesSeed: Array<{ text: string; sender: Message["sender"] }> = [
    { text: "Hi, I have a question", sender: "user" },
    { text: "Hello", sender: "bot" },
    { text: "How can I help you?", sender: "bot" },
    { text: "I'm trying to use Legend List in a chat view.", sender: "user" },
    { text: "Nice! Are you targeting web or React Native?", sender: "bot" },
    { text: "Both, starting with the web playground.", sender: "user" },
    { text: "Cool, the web example mirrors native behavior pretty closely.", sender: "bot" },
    { text: "I see the list jumping when new messages arrive.", sender: "user" },
    { text: "Did you enable maintainScrollAtEnd on the list?", sender: "bot" },
    { text: "Yes, it's set along with maintainVisibleContentPosition.", sender: "user" },
    { text: "Great, what's the estimatedItemSize you're using?", sender: "bot" },
    { text: "Right now it's set to 80.", sender: "user" },
    { text: "That should be fine, are your messages variable height?", sender: "bot" },
    { text: "Yeah, some have links and span multiple lines.", sender: "user" },
    { text: "Try bumping estimatedItemSize to the median height you see.", sender: "bot" },
    { text: "Okay, I'll try 96 and see.", sender: "user" },
    { text: "Also, wrap the chat bubbles so they don't exceed 75% width.", sender: "bot" },
    { text: "Already have that in place from the example.", sender: "user" },
    { text: "Perfect, then the jitter might be from the initial scroll index.", sender: "bot" },
    { text: "Should I remove initialScrollIndex and rely on alignItemsAtEnd?", sender: "user" },
    { text: "Set initialScrollIndex to the last item and keep alignItemsAtEnd true.", sender: "bot" },
    { text: "That's how it's currently wired.", sender: "user" },
    { text: "Got it, can you share a quick reproduction snippet?", sender: "bot" },
    { text: "It's basically the chat example with different colors.", sender: "user" },
    { text: "Let me run through the example-web build to verify.", sender: "bot" },
    { text: "Thanks, appreciate it.", sender: "user" },
    { text: "No problem, are you on a fast refresh loop or full reload?", sender: "bot" },
    { text: "Fast refresh while tweaking styles.", sender: "user" },
    { text: "Sometimes state gets stale; try a hard reload after changing layout.", sender: "bot" },
    { text: "Will do.", sender: "user" },
    { text: "Any console warnings related to scroll events?", sender: "bot" },
    { text: "Nothing obvious, just the React devtools noise.", sender: "user" },
    { text: "Alright, I'll check with the latest nightly build.", sender: "bot" },
    { text: "Is there a prop for custom scroll handlers?", sender: "user" },
    { text: "Yes, ScrollAdjustHandler lets you tune momentum on append.", sender: "bot" },
    { text: "Great, I'll dig into that file.", sender: "user" },
    { text: "Remember to clear timeouts on unmount in your chat bot logic.", sender: "bot" },
    { text: "Good call, I saw that in the sample code.", sender: "user" },
    { text: "How many items are you loading initially?", sender: "bot" },
    { text: "About 120 messages from a fixture.", sender: "user" },
    { text: "That should stream fine; Legend List handles large batches.", sender: "bot" },
    { text: "Does alignItemsAtEnd work with inverted lists?", sender: "user" },
    { text: "We don't invert the DOM; instead we anchor to the bottom with padding.", sender: "bot" },
    { text: "Makes sense, avoids the transform hacks.", sender: "user" },
    { text: "Exactly, keeps accessibility happier too.", sender: "bot" },
    { text: "Scrolling feels smoother after the estimated height tweak.", sender: "user" },
    { text: "Great! Any remaining stutters when the bot replies?", sender: "bot" },
    { text: "There's a tiny nudge if a message is much longer.", sender: "user" },
    { text: "Try setting maintainVisibleContentPosition to true to stabilize.", sender: "bot" },
    { text: "It's already true, but I'll double-check.", sender: "user" },
    { text: "Another trick is to debounce setMessages when batching replies.", sender: "bot" },
    { text: "Interesting, I can buffer bot responses by 16ms.", sender: "user" },
    { text: "Yep, prevents layout thrash on bursts.", sender: "bot" },
    { text: "What about virtualization thresholds?", sender: "user" },
    { text: "Legend List virtualizes aggressively; you can tune overscan via props.", sender: "bot" },
    { text: "Got it. Does the list support pull-to-refresh?", sender: "user" },
    { text: "On native yes; on web you can wire your own handler easily.", sender: "bot" },
    { text: "I'm also seeing odd focus behavior on Safari.", sender: "user" },
    { text: "Safari sometimes scrolls inputs into view abruptly, try preventing default on submit.", sender: "bot" },
    { text: "I already have event.preventDefault in place.", sender: "user" },
    { text: "Then consider a small timeout before re-focusing the input.", sender: "bot" },
    { text: "Should I keep auto-focus after send?", sender: "user" },
    { text: "Yes, but guard against selecting stale refs.", sender: "bot" },
    { text: "How do I style the scrollbars on web?", sender: "user" },
    { text: "Wrap the list in a container with custom scrollbar CSS.", sender: "bot" },
    { text: "Does paddingHorizontal affect measurement?", sender: "user" },
    { text: "Legend List accounts for container padding in its size math.", sender: "bot" },
    { text: "Cool, that saves me some manual offsets.", sender: "user" },
    { text: "If you're adding headers, use the header prop not a list item.", sender: "bot" },
    { text: "I'm also logging some analytics per message.", sender: "user" },
    { text: "Use keyExtractor to keep keys stable for those logs.", sender: "bot" },
    { text: "Keys are just incremental strings right now.", sender: "user" },
    { text: "That's fine as long as they don't collide across sessions.", sender: "bot" },
    { text: "Can I reset idCounter when loading history?", sender: "user" },
    { text: "Sure, just seed it from your message count.", sender: "bot" },
    { text: "Do you recommend FlatList for this?", sender: "user" },
    { text: "FlatList works, but Legend List will give smoother shifts at scale.", sender: "bot" },
    { text: "I like the maintainScrollAtEnd behavior a lot.", sender: "user" },
    { text: "Thanks! It took a few iterations to feel natural.", sender: "bot" },
    { text: "Is there a way to fade in new messages?", sender: "user" },
    { text: "You can add a CSS animation to the message wrapper.", sender: "bot" },
    { text: "Do you have an example of that?", sender: "user" },
    { text: "Check the example-web styles; you can add a simple keyframe.", sender: "bot" },
    { text: "Okay, I'll experiment with opacity transitions.", sender: "user" },
    { text: "Keep the duration short to avoid delaying scroll.", sender: "bot" },
    { text: "Makes sense.", sender: "user" },
    { text: "Are your timestamps formatted locally or UTC?", sender: "bot" },
    { text: "They're using toLocaleTimeString.", sender: "user" },
    { text: "Perfect; consider passing locales for consistency in tests.", sender: "bot" },
    { text: "Good tip, I'll add en-US.", sender: "user" },
    { text: "How are you generating fixture messages?", sender: "bot" },
    { text: "Right now it's just a manual array.", sender: "user" },
    { text: "We can switch to a helper to make the seed clearer.", sender: "bot" },
    { text: "That would be nice for readability.", sender: "user" },
    { text: "You can map over text templates and add alternating senders.", sender: "bot" },
    { text: "That's similar to what I did after reading the docs.", sender: "user" },
    { text: "Awesome, just ensure the time stamps are spaced realistically.", sender: "bot" },
    { text: "Spacing by a few seconds looks pretty natural.", sender: "user" },
    { text: "Exactly, keeps the scroll anchored.", sender: "bot" },
    { text: "Do you prefer storing sender as 'bot' or 'assistant'?", sender: "user" },
    { text: "Either works, just keep the union consistent across code.", sender: "bot" },
    { text: "I'll stick with 'bot' to match the example.", sender: "user" },
    { text: "Sounds good.", sender: "bot" },
];

const defaultChatMessages: Message[] = defaultChatMessagesSeed.map((message, index) =>
    createMessage(message.text, message.sender, baseTime - MS_PER_SECOND * (defaultChatMessagesSeed.length - index)),
);

export default function ChatExample() {
    const [messages, setMessages] = React.useState<Message[]>(defaultChatMessages);
    const [anchorIndex, setAnchorIndex] = React.useState<number | undefined>(undefined);
    const [inputText, setInputText] = React.useState("");
    const [showScrollToEnd, setShowScrollToEnd] = React.useState(false);
    const listRef = React.useRef<LegendListRef | null>(null);
    const botReplyTimeouts = React.useRef<ReturnType<typeof setTimeout>[]>([]);

    React.useEffect(() => {
        return () => {
            botReplyTimeouts.current.forEach((timeout) => clearTimeout(timeout));
            botReplyTimeouts.current = [];
        };
    }, []);

    const sendMessage = React.useCallback(() => {
        const text = (inputText || "Empty message").trim();
        if (!text) {
            return;
        }

        const userMessage = createMessage(text, "user");
        setAnchorIndex(messages.length);
        setMessages((prev) => [...prev, userMessage]);
        setInputText("");

        const timeout = setTimeout(() => {
            const botResponse = createMessage(`Answer: ${text.toUpperCase()}`, "bot");
            setMessages((prev) => [...prev, botResponse]);
            botReplyTimeouts.current = botReplyTimeouts.current.filter((id) => id !== timeout);
        }, 300);
        botReplyTimeouts.current.push(timeout);
    }, [inputText, messages.length]);

    const handleSubmit = React.useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            sendMessage();
        },
        [sendMessage],
    );

    const updateScrollToEndVisibility = React.useCallback(() => {
        const state = listRef.current?.getState();

        const isAtEnd = state!.isAtEnd;
        if (isAtEnd === undefined) {
            return;
        }
        const shouldShow = !isAtEnd;
        setShowScrollToEnd((prev) => (prev === shouldShow ? prev : shouldShow));
    }, []);

    const scrollToEnd = React.useCallback(() => {
        listRef.current?.scrollToEnd({ animated: true });
        setShowScrollToEnd(false);
    }, []);

    const handleScroll = React.useCallback(() => {
        updateScrollToEndVisibility();
    }, [updateScrollToEndVisibility]);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <LegendList<Message>
                alignItemsAtEnd
                className="min-h-0 flex-1"
                anchoredEndSpace={anchorIndex !== undefined ? { anchorIndex } : undefined}
                contentContainerStyle={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 16, paddingTop: 16 }}
                data={messages}
                estimatedItemSize={80}
                initialScrollIndex={messages.length - 1}
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                onLoad={updateScrollToEndVisibility}
                onScroll={handleScroll}
                ref={listRef}
                renderItem={({ item }: LegendListRenderItemProps<Message>) => (
                    <div className="mb-2 flex flex-col items-start gap-1">
                        <div
                            className="max-w-[75%] rounded-2xl px-4 py-3"
                            style={{
                                alignSelf: item.sender === "user" ? "flex-end" : "flex-start",
                                background: item.sender === "user" ? "#007AFF" : "#f1f3f5",
                                color: item.sender === "user" ? "#fff" : "#1f2937",
                            }}
                        >
                            {item.text}
                        </div>
                        <span
                            className="text-xs text-[#6b7280]"
                            style={{
                                alignSelf: item.sender === "user" ? "flex-end" : "flex-start",
                            }}
                        >
                            {new Date(item.timeStamp).toLocaleTimeString()}
                        </span>
                    </div>
                )}
            />
            {showScrollToEnd ? (
                <button
                    className="absolute bottom-24 right-4 cursor-pointer rounded-full border-0 bg-[#0f172a] px-3.5 py-2.5 text-white shadow-[0_4px_12px_rgba(15,23,42,0.2)]"
                    onClick={scrollToEnd}
                    type="button"
                >
                    Scroll to latest
                </button>
            ) : null}
            <form className="flex items-center gap-3 border-t border-[#e2e8f0] p-3" onSubmit={handleSubmit}>
                <input
                    className="flex-1 rounded-[24px] border border-[#d1d5db] px-4 py-2.5 text-base"
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Type a message"
                    value={inputText}
                />
                <button className="px-[18px] py-2.5" type="submit">
                    Send
                </button>
            </form>
        </div>
    );
}
