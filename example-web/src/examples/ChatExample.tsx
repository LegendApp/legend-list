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

const createMessage = (text: string, sender: Message["sender"], timeStamp = Date.now()): Message => ({
    id: String(idCounter++),
    sender,
    text,
    timeStamp,
});

const defaultChatMessages: Message[] = [
    createMessage("Hi, I have a question", "user", Date.now() - MS_PER_SECOND * 5),
    createMessage("Hello", "bot", Date.now() - MS_PER_SECOND * 4),
    createMessage("How can I help you?", "bot", Date.now() - MS_PER_SECOND * 3),
];

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
