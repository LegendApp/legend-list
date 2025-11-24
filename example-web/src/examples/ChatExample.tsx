/** biome-ignore-all assist/source/useSortedKeys: <explanation> */
import React from "react";

import { LegendList } from "@legendapp/list";

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
    const [inputText, setInputText] = React.useState("");
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
        setMessages((prev) => [...prev, userMessage]);
        setInputText("");

        const timeout = setTimeout(() => {
            const botResponse = createMessage(`Answer: ${text.toUpperCase()}`, "bot");
            setMessages((prev) => [...prev, botResponse]);
            botReplyTimeouts.current = botReplyTimeouts.current.filter((id) => id !== timeout);
        }, 300);
        botReplyTimeouts.current.push(timeout);
    }, [inputText]);

    const handleSubmit = React.useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            sendMessage();
        },
        [sendMessage],
    );

    return (
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 12, minHeight: 0 }}>
            <LegendList<Message>
                alignItemsAtEnd
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                data={messages}
                estimatedItemSize={80}
                initialScrollIndex={messages.length - 1}
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                renderItem={({ item }) => (
                    <div
                        style={{
                            alignItems: "flex-start",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            marginBottom: 8,
                        }}
                    >
                        <div
                            style={{
                                alignSelf: item.sender === "user" ? "flex-end" : "flex-start",
                                background: item.sender === "user" ? "#007AFF" : "#f1f3f5",
                                borderRadius: 16,
                                color: item.sender === "user" ? "#fff" : "#1f2937",
                                maxWidth: "75%",
                                padding: "12px 16px",
                            }}
                        >
                            {item.text}
                        </div>
                        <span
                            style={{
                                color: "#6b7280",
                                fontSize: 12,
                                alignSelf: item.sender === "user" ? "flex-end" : "flex-start",
                            }}
                        >
                            {new Date(item.timeStamp).toLocaleTimeString()}
                        </span>
                    </div>
                )}
                style={{ flex: 1, minHeight: 0 }}
            />
            <form
                onSubmit={handleSubmit}
                style={{ alignItems: "center", borderTop: "1px solid #e2e8f0", display: "flex", gap: 12, padding: 12 }}
            >
                <input
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Type a message"
                    style={{
                        border: "1px solid #d1d5db",
                        borderRadius: 24,
                        flex: 1,
                        fontSize: 16,
                        padding: "10px 16px",
                    }}
                    value={inputText}
                />
                <button style={{ padding: "10px 18px" }} type="submit">
                    Send
                </button>
            </form>
        </div>
    );
}
