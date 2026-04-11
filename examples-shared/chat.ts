const conversationSeed = [
    ["Nina", "Morning. The new conversation view feels a lot smoother."],
    ["Sam", "Did you change the message list virtualization?"],
    ["Nina", "Yeah. It now keeps the bottom edge stable while new replies stream in."],
    ["Sam", "Nice. Does it still hold position if I scroll away from the end?"],
    ["Nina", "Yep. The jump-to-latest affordance only shows once you leave the anchored state."],
    ["Sam", "That is exactly what I needed for the demo."],
] as const;

export type ChatMessage = {
    id: string;
    sender: "self" | "other";
    senderName: string;
    text: string;
    timestampLabel: string;
};

export type AiMessage = {
    id: string;
    sender: "user" | "assistant";
    text: string;
    timestampLabel: string;
    isPlaceholder?: boolean;
};

export function buildChatMessages() {
    return conversationSeed.map(([senderName, text], index) => ({
        id: `message-${index}`,
        sender: index % 2 === 0 ? "other" : "self",
        senderName,
        text,
        timestampLabel: `9:${String(10 + index).padStart(2, "0")} AM`,
    })) satisfies ChatMessage[];
}

export function buildAiConversation() {
    const prompt =
        "Summarize how virtualization helps a list keep scrolling smooth when rows have mixed heights and new content streams in.";
    const reply = [
        "Virtualization keeps only the visible rows and a small buffer mounted.",
        "That reduces memory pressure, layout work, and view churn as you scroll.",
        "When new content streams in, a stable anchor lets the list preserve the part of the conversation you were already reading.",
        "With good size estimates, the list can update positions smoothly before exact measurements arrive.",
    ].join(" ");

    return {
        prompt,
        reply,
        initialMessages: [
            {
                id: "ai-user-0",
                sender: "user",
                text: prompt,
                timestampLabel: "Now",
            },
            {
                id: "ai-assistant-placeholder",
                isPlaceholder: true,
                sender: "assistant",
                text: "",
                timestampLabel: "Now",
            },
        ] satisfies AiMessage[],
    };
}
