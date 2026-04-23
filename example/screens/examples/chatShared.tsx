import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import {
    type AiMessage,
    buildAiConversation,
    buildAssistantReply,
    buildChatMessages,
    type ChatMessage,
} from "../../../examples-shared/chat";
import { ChatAttachmentCard, styles } from "./shared";

const AI_CHAT_ANCHOR_MAX_LINES = 2;
const AI_CHAT_BODY_LINE_HEIGHT = 20;
const AI_CHAT_ANCHOR_MAX_SIZE = AI_CHAT_ANCHOR_MAX_LINES * AI_CHAT_BODY_LINE_HEIGHT + 32;

type AiChatListRef = {
    current: {
        scrollToEnd(params?: { animated?: boolean }): void;
    } | null;
};

export type UseAiChatExampleOptions = {
    listRef: AiChatListRef;
    streamIntervalMs: number;
    streamStartDelayMs?: number;
    beforeScrollToEnd?: () => void | Promise<void>;
};

export function useAiChatExample({
    beforeScrollToEnd,
    listRef,
    streamIntervalMs,
    streamStartDelayMs = 0,
}: UseAiChatExampleOptions) {
    const conversation = useMemo(() => buildAiConversation(), []);
    const [messages, setMessages] = useState<AiMessage[]>(() => conversation.initialMessages);
    const [anchorIndex, setAnchorIndex] = useState<number | undefined>(undefined);
    const [input, setInput] = useState("");
    const nextIdRef = useRef(conversation.initialMessages.length);
    const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopStreaming = useCallback(() => {
        if (streamTimerRef.current) {
            clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
        }
    }, []);

    const sendPrompt = useCallback(
        async (prompt: string) => {
            const trimmedPrompt = prompt.trim();
            if (!trimmedPrompt) {
                return;
            }

            const indexOfNewMessage = messages.length;

            stopStreaming();
            const words = buildAssistantReply(trimmedPrompt, nextIdRef.current).split(/(\s+)/);
            const placeholderId = `assistant-${nextIdRef.current++}`;

            setAnchorIndex(indexOfNewMessage);
            setMessages((current) => [
                ...current,
                {
                    id: `user-${nextIdRef.current++}`,
                    sender: "user",
                    text: trimmedPrompt,
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

            if (beforeScrollToEnd) {
                await beforeScrollToEnd();
            }

            requestAnimationFrame(() => {
                listRef.current?.scrollToEnd({ animated: true });
            });

            const startStreaming = () => {
                let index = 0;
                streamTimerRef.current = setInterval(() => {
                    index += 1;
                    const nextReply = words.slice(0, index).join("");
                    setMessages((current) =>
                        current.map((message) =>
                            message.id === placeholderId
                                ? {
                                      ...message,
                                      isPlaceholder: index < words.length,
                                      text: nextReply,
                                  }
                                : message,
                        ),
                    );

                    if (index >= words.length) {
                        stopStreaming();
                    }
                }, streamIntervalMs);
            };

            if (streamStartDelayMs > 0) {
                setTimeout(startStreaming, streamStartDelayMs);
                return;
            }

            startStreaming();
        },
        [beforeScrollToEnd, listRef, messages.length, stopStreaming, streamIntervalMs, streamStartDelayMs],
    );

    useEffect(() => stopStreaming, [stopStreaming]);

    return {
        anchorIndex,
        input,
        messages,
        sendPrompt,
        setInput,
    };
}

export function getAiChatListProps({
    anchorIndex,
    messages,
}: {
    anchorIndex: number | undefined;
    messages: AiMessage[];
}) {
    return {
        anchoredEndSpace:
            anchorIndex !== undefined
                ? { anchorIndex, anchorMaxSize: AI_CHAT_ANCHOR_MAX_SIZE, anchorOffset: 16 }
                : undefined,
        contentContainerStyle: styles.list,
        data: messages,
        estimatedItemSize: 520,
        initialScrollAtEnd: true,
        keyExtractor: (item: AiMessage) => item.id,
        maintainVisibleContentPosition: true,
        recycleItems: true,
        renderItem: ({ item }: { item: AiMessage }) => (
            <View style={[styles.bubble, item.sender === "user" ? styles.promptBubble : styles.responseBubble]}>
                <Text style={[styles.body, item.sender === "user" && styles.promptText]}>
                    {item.text || "Thinking..."}
                </Text>
                <Text style={[styles.timestamp, item.sender === "user" && styles.promptText]}>
                    {item.isPlaceholder ? "Streaming..." : item.timestampLabel}
                </Text>
            </View>
        ),
    };
}

export function useChatExample() {
    const [messages, setMessages] = useState<ChatMessage[]>(() => buildChatMessages());
    const [input, setInput] = useState("");
    const nextIdRef = useRef(messages.length);
    const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearReplyTimer = useCallback(() => {
        if (replyTimerRef.current) {
            clearTimeout(replyTimerRef.current);
            replyTimerRef.current = null;
        }
    }, []);

    const sendMessage = useCallback(
        (draft: string) => {
            const trimmedDraft = draft.trim();
            if (!trimmedDraft) {
                return;
            }

            clearReplyTimer();

            const baseId = nextIdRef.current++;
            const timeStamp = new Date();
            const timeLabel = timeStamp.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
            });

            setMessages((current) => [
                ...current,
                {
                    id: `message-${baseId}`,
                    sender: "self",
                    senderName: "You",
                    text: trimmedDraft,
                    timestampLabel: timeLabel,
                },
            ]);
            setInput("");

            replyTimerRef.current = setTimeout(() => {
                const replyId = nextIdRef.current++;
                setMessages((current) => [
                    ...current,
                    {
                        attachment:
                            replyId % 4 === 0
                                ? {
                                      accent: "#38BDF8",
                                      height: 136,
                                      label: "Preview",
                                      subtitle: "Latest thread capture",
                                  }
                                : undefined,
                        id: `message-${replyId}`,
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

    useEffect(() => clearReplyTimer, [clearReplyTimer]);

    return {
        input,
        messages,
        sendMessage,
        setInput,
    };
}

export function getChatListProps({ messages }: { messages: ChatMessage[] }) {
    return {
        alignItemsAtEnd: true,
        contentContainerStyle: styles.list,
        data: messages,
        estimatedItemSize: 168,
        initialScrollAtEnd: true,
        keyExtractor: (item: ChatMessage) => item.id,
        maintainScrollAtEnd: true,
        maintainVisibleContentPosition: true,
        recycleItems: true,
        renderItem: ({ item }: { item: ChatMessage }) => (
            <View style={[styles.bubble, item.sender === "self" ? styles.selfBubble : styles.otherBubble]}>
                <Text style={styles.sender}>{item.senderName}</Text>
                {item.attachment ? <ChatAttachmentCard attachment={item.attachment} /> : null}
                <Text style={styles.body}>{item.text}</Text>
                <Text style={styles.timestamp}>{item.timestampLabel}</Text>
            </View>
        ),
    };
}

export function ChatComposer({
    input,
    onPress,
    onChangeText,
    placeholder,
}: {
    input: string;
    onPress: () => void;
    onChangeText: (text: string) => void;
    placeholder: string;
}) {
    return (
        <View style={styles.composerRow}>
            <TextInput
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#94A3B8"
                style={styles.composerInput}
                value={input}
            />
            <Pressable onPress={onPress} style={[styles.button, styles.buttonActive]}>
                <Text style={[styles.buttonText, styles.buttonTextActive]}>Send</Text>
            </Pressable>
        </View>
    );
}
