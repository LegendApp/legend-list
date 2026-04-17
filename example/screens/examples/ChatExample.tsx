import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardGestureArea, KeyboardProvider, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardChatLegendList } from "@legendapp/list/keyboard-chat";
import { buildChatMessages, type ChatMessage } from "../../../examples-shared/chat";
import { ChatAttachmentCard, SafeAreaShell, styles } from "./shared";

export function ChatExample() {
    const [messages, setMessages] = useState<ChatMessage[]>(() => buildChatMessages());
    const [input, setInput] = useState("");
    const nextIdRef = useRef(messages.length);
    const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const insets = useSafeAreaInsets();

    const clearReplyTimer = () => {
        if (replyTimerRef.current) {
            clearTimeout(replyTimerRef.current);
            replyTimerRef.current = null;
        }
    };

    const sendMessage = (draft: string) => {
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
    };

    useEffect(() => clearReplyTimer, []);

    return (
        <KeyboardProvider>
            <SafeAreaShell>
                <KeyboardGestureArea interpolator="ios" offset={60} style={{ flex: 1 }}>
                    <KeyboardChatLegendList
                        alignItemsAtEnd
                        contentContainerStyle={styles.list}
                        data={messages}
                        estimatedItemSize={168}
                        initialScrollAtEnd
                        keyboardDismissMode="interactive"
                        keyExtractor={(item: ChatMessage) => item.id}
                        maintainScrollAtEnd
                        maintainVisibleContentPosition
                        offset={insets.bottom}
                        renderItem={({ item }: { item: ChatMessage }) => (
                            <View
                                style={[styles.bubble, item.sender === "self" ? styles.selfBubble : styles.otherBubble]}
                            >
                                <Text style={styles.sender}>{item.senderName}</Text>
                                {item.attachment ? <ChatAttachmentCard attachment={item.attachment} /> : null}
                                <Text style={styles.body}>{item.text}</Text>
                                <Text style={styles.timestamp}>{item.timestampLabel}</Text>
                            </View>
                        )}
                        style={{ flex: 1 }}
                    />
                </KeyboardGestureArea>
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                    <View style={[styles.composerRow]}>
                        <TextInput
                            onChangeText={setInput}
                            placeholder="Type a message"
                            placeholderTextColor="#94A3B8"
                            style={styles.composerInput}
                            value={input}
                        />
                        <Pressable onPress={() => sendMessage(input)} style={[styles.button, styles.buttonActive]}>
                            <Text style={[styles.buttonText, styles.buttonTextActive]}>Send</Text>
                        </Pressable>
                    </View>
                </KeyboardStickyView>
            </SafeAreaShell>
        </KeyboardProvider>
    );
}
