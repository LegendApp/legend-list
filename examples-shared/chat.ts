const conversationSeed = [
    ["Nina", "Morning. The new conversation view feels a lot smoother."],
    ["Sam", "Did you change the message list virtualization?"],
    ["Nina", "Yeah. It now keeps the bottom edge stable while new replies stream in."],
    ["Sam", "Nice. Does it still hold position if I scroll away from the end?"],
    ["Nina", "Yep. The jump-to-latest affordance only shows once you leave the anchored state."],
    ["Sam", "That is exactly what I needed for the demo."],
] as const;

const conversationTopics = [
    "The unread badge stays pinned while older messages recycle offscreen.",
    "Keyboard transitions no longer kick the bottom anchor out of place.",
    "The new jump-to-latest chip only appears once I drift off the live edge.",
    "Mixed attachment cards still estimate close enough to avoid visible snapping.",
    "Streaming replies update the same assistant row instead of inserting new ones.",
    "The loading skeletons clear without shifting the rest of the thread.",
    "The composer stays responsive even when the conversation grows past a few hundred rows.",
    "Long transcripts still jump directly to the latest message after a cold mount.",
] as const;

const detailedConversationTopics = [
    "The preview image rows are useful because they add taller cells to the same thread without turning the example into a gallery.",
    "You can feel whether the list is doing real work once the transcript is deep enough that recycled cells return while new messages keep arriving.",
    "A believable chat surface needs short acknowledgements, medium replies, and a few dense messages that read like actual product conversations.",
    "If the example only contains one-liners, it hides the exact offset and measurement churn that a virtualized chat has to handle in production.",
] as const;

const shortReplies = ["Yep.", "Looks good.", "Still stable.", "Nice.", "Pinned.", "Agreed.", "Copy that."] as const;

const longReplyBlocks = [
    [
        "The important part here is not just that the thread scrolls, but that it remains visually trustworthy once the data becomes messy. A real conversation contains one-line acknowledgements, medium-length clarifications, and a few messages that are genuinely heavy enough to disturb the viewport if the anchor logic is weak.",
        "Once the history gets deep, the same cells come back repeatedly. That is where you notice whether recycling is behaving well, whether measurement correction is subtle, and whether the composer still feels detached from the cost of the transcript beneath it.",
        "This is exactly why the example needs some rows that are dramatically taller than their neighbors instead of a tidy sequence of similarly sized bubbles.",
    ],
    [
        "The mixed-height problem only really appears when a few rows are outliers. If everything is roughly the same height, the list can look perfect even though the anchor logic is not especially resilient.",
        "A better demo includes tall preview cards, dense assistant answers, and a few compact messages clustered beside them. That forces the list to reconcile abrupt height changes while preserving the user’s place in the conversation.",
    ],
    [
        "What makes this feel realistic is not just raw message count. It is the uneven shape of the data: tiny reactions, image previews with generous height, and long explanatory replies that consume a meaningful chunk of the screen on their own.",
        "That unevenness is what makes virtualization visible without turning the surface into a benchmark harness.",
    ],
] as const;

const aiReplySections = [
    "A realistic AI surface should expect the assistant to produce answers that span several paragraphs, because that is where scroll stability actually gets tested.",
    "When the response grows in place, the list has to preserve the visible context while the measured height of the active row keeps changing. If estimates are poor or the anchor is weak, the reply appears to shove the conversation around as it streams.",
    "The example should therefore include long-form answers that are obviously taller than neighboring user prompts, not just modest one-paragraph explanations.",
    "It also helps to vary the shape of those answers. Some can be a dense block of prose, some can be organized into sections, and some can include short checklists or pseudo-structured notes. That makes the mounted window much less uniform.",
] as const;

const aiAppendixSections = [
    "Operationally, this means the example is valuable only if it forces the mounted window to contain a genuine mix of row heights at the same time. Tall assistant answers should sit beside compact prompts, older long answers, and a few medium rows so the viewport has to adapt to abrupt shifts in measured size.",
    "The streaming path matters too. If the reply arrives all at once, you only test the final height. If it grows progressively, you test whether the list can preserve the visible anchor while the same row keeps becoming taller over several updates.",
    "One more reason to make these answers oversized is that users often pause midway through reading. That is precisely when a weak implementation reveals itself, because any new mutation below or above the current viewport can make the text they were reading drift out from under them.",
    "For that reason, an AI example in a virtual list library should intentionally lean into outlier rows rather than optimize for pretty symmetry. The point is to show that the list remains coherent when one row is far taller than the ones around it.",
] as const;

const attachmentPalettes = [
    {
        accent: "#C084FC",
        label: "Preview",
        subtitle: "Prototype board",
    },
    {
        accent: "#60A5FA",
        label: "Capture",
        subtitle: "Feed QA run",
    },
    {
        accent: "#34D399",
        label: "Snapshot",
        subtitle: "Warm scroll trace",
    },
    {
        accent: "#F59E0B",
        label: "Photo",
        subtitle: "Launch shelf",
    },
] as const;

const aiHistoryPairs = [
    {
        prompt: "How should a long message thread stay stable when older rows are prepended?",
        reply:
            "Preserve the visible anchor so the rows already on screen do not jump when the new history arrives above them.",
    },
    {
        prompt: "What matters most when rows have mixed heights?",
        reply:
            "Good size estimates. They let the list place rows close to their final positions before exact measurement completes.",
    },
    {
        prompt: "Why does streaming into an existing assistant row feel better than inserting one token at a time?",
        reply:
            "Because it updates a stable cell instead of changing the surrounding layout for every chunk of text.",
    },
    {
        prompt: "What should I verify in a chat example if I want it to feel credible?",
        reply:
            "Load enough history to require virtualization, preserve the bottom anchor, and make sure new prompts add a user row followed by a streamed assistant row.",
    },
] as const;

export type ChatMessage = {
    attachment?: ChatAttachment;
    id: string;
    sender: "self" | "other";
    senderName: string;
    text: string;
    timestampLabel: string;
};

export type ChatAttachment = {
    accent: string;
    height: number;
    label: string;
    subtitle: string;
};

export type AiMessage = {
    id: string;
    sender: "user" | "assistant";
    text: string;
    timestampLabel: string;
    isPlaceholder?: boolean;
};

export function buildAssistantReply(prompt: string, variant = 0) {
    const longTopic = detailedConversationTopics[variant % detailedConversationTopics.length]!;
    const mode = variant % 5;

    if (mode === 0) {
        return [
            `Prompt received: ${prompt}`,
            "The assistant reply is intentionally long here because short placeholder answers do not reveal much about list stability.",
            aiReplySections[0],
            aiReplySections[1],
            aiReplySections[2],
            `${aiReplySections[3]} ${longTopic}`,
            aiAppendixSections[0],
            aiAppendixSections[1],
            aiAppendixSections[2],
            aiAppendixSections[3],
            aiAppendixSections[0],
            aiAppendixSections[1],
            aiAppendixSections[2],
            aiAppendixSections[3],
            "If this answer can grow while the viewport remains anchored, the example is doing something meaningful.",
        ].join("\n\n");
    }

    if (mode === 1) {
        return [
            `Prompt received: ${prompt}`,
            "Summary:",
            "- Keep the visible content anchored while the current assistant row expands.",
            "- Expect a few responses to be much taller than the surrounding prompts.",
            "- Use realistic paragraph lengths so measurement correction has real work to do.",
            "",
            `Why it matters: ${longTopic}`,
        ].join("\n");
    }

    return [
        `Prompt received: ${prompt}`,
        "A strong AI chat example should make the list carry a realistic answer, not a two-sentence placeholder. Real assistant responses usually arrive as several dense paragraphs, and that matters because the row height keeps changing while the user is still anchored near the latest content.",
        "The list should keep the visible conversation stable while the assistant expands in place. That means estimates need to be close enough to avoid visible snapping, and the update path should mutate the current assistant row rather than insert a stream of tiny sibling rows.",
        `It is also useful to mix response shapes. Some prompts should yield concise answers, but many should produce longer explanations with multiple paragraphs, a few inline breaks, and enough text to reveal whether the viewport, recycling window, and anchor preservation all remain coherent. ${longTopic}`,
        "If this example feels smooth with a long seeded history and long streamed replies, it says something real about the library. If it only ever renders short messages, it mostly proves that a trivial chat can scroll.",
        "A final detail: a few genuinely oversized answers are useful because they become obvious outliers in the mounted window. Those are the rows that reveal whether the list adapts cleanly when one item is several times taller than its neighbors.",
        aiAppendixSections[variant % aiAppendixSections.length]!,
        aiAppendixSections[(variant + 1) % aiAppendixSections.length]!,
        aiAppendixSections[(variant + 2) % aiAppendixSections.length]!,
        aiAppendixSections[(variant + 3) % aiAppendixSections.length]!,
        aiAppendixSections[variant % aiAppendixSections.length]!,
    ].join("\n\n");
}

function buildChatAttachment(index: number) {
    if (index % 7 !== 3 && index % 11 !== 5 && index % 17 !== 9) {
        return undefined;
    }

    const palette = attachmentPalettes[index % attachmentPalettes.length]!;
    const heights = [96, 148, 220, 320, 420] as const;

    return {
        accent: palette.accent,
        height: heights[index % heights.length]!,
        label: palette.label,
        subtitle: index % 5 === 0 ? `${palette.subtitle} full board` : palette.subtitle,
    } satisfies ChatAttachment;
}

export function buildChatMessages(count = 96) {
    return Array.from({ length: count }, (_, index) => {
        const seedIndex = index % conversationSeed.length;
        const cycle = Math.floor(index / conversationSeed.length);
        const [senderName, baseText] = conversationSeed[seedIndex]!;
        const sender = seedIndex % 2 === 0 ? "other" : "self";
        const hour = 8 + Math.floor(index / 6);
        const minute = 10 + ((index * 7) % 50);
        const suffix = conversationTopics[(seedIndex + cycle) % conversationTopics.length]!;
        const detailedSuffix = detailedConversationTopics[(seedIndex + cycle) % detailedConversationTopics.length]!;
        const attachment = buildChatAttachment(index);
        const mode = (cycle + seedIndex) % 6;
        const text =
            mode === 0
                ? shortReplies[(index + cycle) % shortReplies.length]!
                : mode === 1
                  ? baseText
                  : mode === 2
                    ? `${baseText} ${suffix}`
                    : mode === 3
                      ? `${baseText}\n\n${suffix}`
                      : mode === 4
                        ? `${baseText} ${suffix}\n\n${detailedSuffix}\n\n${longReplyBlocks[(index + cycle) % longReplyBlocks.length]!.join("\n\n")}`
                        : attachment
                          ? `${shortReplies[(index + 1) % shortReplies.length]!}\n\nSharing the latest capture below so the thread includes a much taller row between smaller messages.`
                          : `${baseText}\n\n${longReplyBlocks[(index + cycle) % longReplyBlocks.length]!.join("\n\n")}`;

        return {
            attachment,
            id: `message-${index}`,
            sender,
            senderName,
            text,
            timestampLabel: `${hour}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`,
        } satisfies ChatMessage;
    });
}

export function buildAiConversation(historyPairs = 75) {
    const prompt =
        "Summarize how virtualization helps a list keep scrolling smooth when rows have mixed heights and new content streams in.";
    const reply = buildAssistantReply(prompt);

    return {
        prompt,
        reply,
        initialMessages: [
            ...Array.from({ length: historyPairs }, (_, index) => {
                const pair = aiHistoryPairs[index % aiHistoryPairs.length]!;
                const hour = 8 + Math.floor(index / 2);
                const minute = 2 + ((index * 5) % 56);
                const timestampLabel = `${hour}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;

                return [
                    {
                        id: `ai-user-${index}`,
                        sender: "user",
                        text: index % 3 === 0 ? `${pair.prompt} Keep it concrete.` : pair.prompt,
                        timestampLabel,
                    },
                    {
                        id: `ai-assistant-${index}`,
                        sender: "assistant",
                        text: buildAssistantReply(pair.prompt, index),
                        timestampLabel,
                    },
                ] satisfies AiMessage[];
            }).flat(),
            {
                id: `ai-user-${historyPairs}`,
                sender: "user",
                text: prompt,
                timestampLabel: "Now",
            },
            {
                id: `ai-assistant-${historyPairs}`,
                sender: "assistant",
                text: reply,
                timestampLabel: "Now",
            },
        ] satisfies AiMessage[],
    };
}
