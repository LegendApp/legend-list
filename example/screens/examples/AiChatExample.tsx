import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import { type AiMessage, buildAiConversation, buildAssistantReply } from "../../../examples-shared/chat";
import { AI_SUGGESTIONS, Shell, styles } from "./shared";

export function AiChatExample() {
    const conversation = useMemo(() => buildAiConversation(), []);
    const [messages, setMessages] = useState<AiMessage[]>(() => conversation.initialMessages);
    const [input, setInput] = useState("");
    const nextIdRef = useRef(conversation.initialMessages.length);
    const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopStreaming = () => {
        if (streamTimerRef.current) {
            clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
        }
    };

    const sendPrompt = (prompt: string) => {
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt) {
            return;
        }

        stopStreaming();
        const words = buildAssistantReply(trimmedPrompt, nextIdRef.current).split(/(\s+)/);
        const placeholderId = `assistant-${nextIdRef.current++}`;

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
        }, 40);
    };

    useEffect(() => stopStreaming, []);

    return (
        <Shell>
            <View style={styles.toolbar}>
                {AI_SUGGESTIONS.map((suggestion) => (
                    <Pressable
                        key={suggestion.label}
                        onPress={() => sendPrompt(suggestion.prompt)}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.secondaryButtonText}>{suggestion.label}</Text>
                    </Pressable>
                ))}
            </View>
            <LegendList
                contentContainerStyle={styles.list}
                data={messages}
                estimatedItemSize={520}
                initialScrollIndex={messages.length - 1}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                renderItem={({ item }: { item: AiMessage }) => (
                    <View style={[styles.bubble, item.sender === "user" ? styles.promptBubble : styles.responseBubble]}>
                        <Text style={[styles.body, item.sender === "user" && styles.promptText]}>
                            {item.text || "Thinking..."}
                        </Text>
                        <Text style={[styles.timestamp, item.sender === "user" && styles.promptText]}>
                            {item.isPlaceholder ? "Streaming..." : item.timestampLabel}
                        </Text>
                    </View>
                )}
            />
            <View style={styles.composerRow}>
                <TextInput
                    onChangeText={setInput}
                    placeholder="Ask about list behavior"
                    placeholderTextColor="#94A3B8"
                    style={styles.composerInput}
                    value={input}
                />
                <Pressable onPress={() => sendPrompt(input)} style={[styles.button, styles.buttonActive]}>
                    <Text style={[styles.buttonText, styles.buttonTextActive]}>Send</Text>
                </Pressable>
            </View>
        </Shell>
    );
}
