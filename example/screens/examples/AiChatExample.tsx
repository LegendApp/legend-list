import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardGestureArea, KeyboardProvider, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LegendListRef } from "@legendapp/list";
import { KeyboardChatLegendList } from "@legendapp/list/keyboard-chat";
import { type AiMessage, buildAiConversation, buildAssistantReply } from "../../../examples-shared/chat";
import { AI_SUGGESTIONS, Shell, styles } from "./shared";

export function AiChatExample() {
    const conversation = useMemo(() => buildAiConversation(), []);
    const [messages, setMessages] = useState<AiMessage[]>(() => conversation.initialMessages);
    const [anchorIndex, setAnchorIndex] = useState<number | undefined>(undefined);
    const [input, setInput] = useState("");
    const nextIdRef = useRef(conversation.initialMessages.length);
    const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const listRef = useRef<LegendListRef>(null);
    const insets = useSafeAreaInsets();

    const stopStreaming = useCallback(() => {
        if (streamTimerRef.current) {
            clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
        }
    }, []);

    const sendPrompt = useCallback(
        (prompt: string) => {
            const trimmedPrompt = prompt.trim();
            if (!trimmedPrompt) {
                return;
            }

            stopStreaming();
            const words = buildAssistantReply(trimmedPrompt, nextIdRef.current).split(/(\s+)/);
            const placeholderId = `assistant-${nextIdRef.current++}`;

            setAnchorIndex(messages.length);
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

            requestAnimationFrame(() => {
                listRef.current?.scrollToEnd({ animated: true });
            });

        setTimeout(() => {

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
            }, 5);
        }, 1000)

        },
        [messages.length, stopStreaming],
    );

  useEffect(() => stopStreaming, []);

    return (
        <KeyboardProvider>
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
                <KeyboardGestureArea interpolator="ios" offset={60} style={{ flex: 1 }}>
                    <KeyboardChatLegendList
                        anchoredEndSpace={anchorIndex !== undefined ? { anchorIndex } : undefined}
                        contentContainerStyle={styles.list}
                        data={messages}
                        estimatedItemSize={520}
                        initialScrollAtEnd
                        keyboardDismissMode="interactive"
                        keyExtractor={(item: AiMessage) => item.id}
                        maintainVisibleContentPosition
                        offset={insets.bottom}
                        ref={listRef}
                        renderItem={({ item }: { item: AiMessage }) => (
                            <View
                                style={[
                                    styles.bubble,
                                    item.sender === "user" ? styles.promptBubble : styles.responseBubble,
                                ]}
                            >
                                <Text style={[styles.body, item.sender === "user" && styles.promptText]}>
                                    {item.text || "Thinking..."}
                                </Text>
                                <Text style={[styles.timestamp, item.sender === "user" && styles.promptText]}>
                                    {item.isPlaceholder ? "Streaming..." : item.timestampLabel}
                                </Text>
                            </View>
                        )}
                        style={{ flex: 1 }}
                    />
                </KeyboardGestureArea>
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                    <View style={[styles.composerRow, { paddingBottom: insets.bottom + 16 }]}>
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
                </KeyboardStickyView>
            </Shell>
        </KeyboardProvider>
    );
}
