import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardProvider, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareLegendList, useKeyboardChatComposerInset } from "@legendapp/list/keyboard";
import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { useColorScheme } from "~/hooks/useColorScheme";

type Message = { id: string; role: "user" | "assistant"; text: string };

const INITIAL_MESSAGES: Message[] = [
    { id: "welcome-user", role: "user", text: "Help me plan a slow Sunday." },
    {
        id: "welcome-assistant",
        role: "assistant",
        text: "Start with coffee somewhere sunny, then take the long way to a park. Leave the afternoon open.\n\nWhat would make the day feel like yours?",
    },
];
const IDEAS = [
    [
        "Something outdoors.",
        "Find a nearby trail with a view and pack a small picnic. Go early, walk slowly, and leave your headphones at home. A short route leaves plenty of room for an unplanned stop.",
    ],
    [
        "What if it rains?",
        "Make it a neighborhood day: a quiet bookshop, a warm lunch, and a museum you have been meaning to visit. Pick just one thing to book and let the rest happen naturally.",
    ],
    [
        "I would love to cook.",
        "Choose a recipe with a little ritual to it, like fresh pasta or a soup that simmers all afternoon. Shop for the ingredients in the morning and invite someone to help chop.",
    ],
    [
        "Keep it simple.",
        "One good coffee, a walk around the block, and an hour with a book is enough. Leave a little space between things. You do not need to fill the day for it to be a good one.",
    ],
] as const;
const FOLLOW_END = { animated: false, on: { dataChange: true, itemLayout: true, layout: true } } as const;
const keyExtractor = (message: Message) => message.id;
const getItemType = (message: Message) => message.role;
const ChatList = Platform.OS === "web" ? LegendList : KeyboardAwareLegendList;

export function TranslucentChatExample() {
    return (
        <KeyboardProvider>
            <Chat />
        </KeyboardProvider>
    );
}

function Chat() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const dark = useColorScheme() === "dark";
    const colors = dark ? palettes.dark : palettes.light;
    const bottom = Math.max(insets.bottom, 12);
    // The header reports its real height after mount, replacing this first-render estimate.
    const [headerHeight, setHeaderHeight] = useState(insets.top + 44);
    const [composerHeight, setComposerHeight] = useState(92);
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const listRef = useRef<LegendListRef | null>(null);
    const composerRef = useRef<View>(null);
    const nextId = useRef(0);
    const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const { contentInsetEndAdjustment, onComposerLayout } = useKeyboardChatComposerInset(listRef, composerRef, 92);

    const attachList = useCallback(
        (list: LegendListRef | null) => {
            listRef.current = list;
            if (Platform.OS !== "web") list?.reportContentInset({ bottom: contentInsetEndAdjustment.value });
        },
        [contentInsetEndAdjustment],
    );

    useEffect(() => () => clearInterval(timer.current), []);

    const send = () => {
        const text = input.trim();
        if (!text || streaming) return;
        const id = nextId.current++;
        const replyId = `assistant-${id}`;
        const reply = `${IDEAS[id % IDEAS.length][1]}\n\nA little plan to try:\n• Choose one place you can walk to.\n• Give yourself an hour with no agenda.\n• Bring something good to eat.\n\nIf you tell me how much time you have, we can shape this into a day that feels easy.`;
        const words = reply.split(" ");
        let count = 0;
        setInput("");
        setStreaming(true);
        setMessages((current) => [
            ...current,
            { id: `user-${id}`, role: "user", text },
            { id: replyId, role: "assistant", text: "…" },
        ]);
        void listRef.current?.scrollToEnd({ animated: true });
        timer.current = setInterval(() => {
            count += 3;
            const partial = words.slice(0, count).join(" ");
            setMessages((current) =>
                current.map((message) => (message.id === replyId ? { ...message, text: partial } : message)),
            );
            if (count >= words.length) {
                clearInterval(timer.current);
                setStreaming(false);
            }
        }, 90);
    };

    const loadHistory = () => {
        const history: Message[] = Array.from({ length: 24 }, (_, index) => {
            const idea = IDEAS[index % IDEAS.length];
            return [
                { id: `history-user-${index}`, role: "user" as const, text: idea[0] },
                { id: `history-assistant-${index}`, role: "assistant" as const, text: idea[1] },
            ];
        }).flat();
        setHistoryLoaded(true);
        setMessages((current) => [...history, ...current]);
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <ChatList
                {...(Platform.OS !== "web" && {
                    applyWorkaroundForContentInsetHitTestBug: true,
                    automaticallyAdjustsScrollIndicatorInsets: false,
                    contentInset: Platform.OS === "ios" ? { top: headerHeight } : undefined,
                    contentInsetAdjustmentBehavior: "never" as const,
                    contentInsetEndAdjustment,
                    keyboardDismissMode: "interactive" as const,
                    keyboardLiftBehavior: "whenAtEnd" as const,
                    keyboardOffset: bottom,
                    keyboardShouldPersistTaps: "handled" as const,
                    scrollIndicatorInsets: { top: headerHeight },
                })}
                alignItemsAtEnd
                contentContainerStyle={[
                    styles.content,
                    Platform.OS !== "ios" && { paddingTop: headerHeight + 16 },
                    Platform.OS === "web" && { paddingBottom: composerHeight },
                ]}
                data={messages}
                estimatedItemSize={140}
                extraData={dark}
                getItemType={getItemType}
                initialScrollAtEnd
                keyExtractor={keyExtractor}
                maintainScrollAtEnd={FOLLOW_END}
                maintainVisibleContentPosition
                ref={attachList}
                renderItem={({ item }) => (
                    <View style={[styles.message, item.role === "user" ? styles.userMessage : styles.assistantMessage]}>
                        {item.role === "assistant" && (
                            <Text style={[styles.role, { color: colors.muted }]}>WEEKEND ASSISTANT</Text>
                        )}
                        <View
                            style={[
                                styles.bubble,
                                { backgroundColor: item.role === "user" ? colors.accent : colors.surface },
                            ]}
                        >
                            <Text
                                style={[styles.messageText, { color: item.role === "user" ? "#FFFFFF" : colors.text }]}
                            >
                                {item.text}
                            </Text>
                        </View>
                    </View>
                )}
                style={styles.list}
            />
            <View
                onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
                style={[styles.header, { borderColor: colors.border, paddingTop: insets.top }]}
            >
                {Platform.OS === "ios" ? (
                    <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={dark ? "dark" : "light"} />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
                )}
                <View style={styles.toolbar}>
                    <Pressable
                        accessibilityLabel="Back to examples"
                        accessibilityRole="button"
                        hitSlop={12}
                        onPress={() => router.back()}
                        style={styles.back}
                    >
                        <MaterialIcons color={colors.text} name="arrow-back-ios-new" size={20} />
                    </Pressable>
                    <View style={styles.heading}>
                        <Text style={[styles.title, { color: colors.text }]}>A little room to breathe</Text>
                        <Text style={[styles.subtitle, { color: colors.muted }]}>
                            Your weekend, thoughtfully planned
                        </Text>
                    </View>
                    <Pressable
                        accessibilityLabel="Load earlier conversation"
                        accessibilityRole="button"
                        disabled={historyLoaded}
                        onPress={loadHistory}
                        style={styles.history}
                    >
                        <MaterialIcons color={historyLoaded ? colors.muted : colors.accent} name="history" size={23} />
                        <Text style={[styles.historyLabel, { color: colors.muted }]}>
                            {historyLoaded ? "Loaded" : "History"}
                        </Text>
                    </Pressable>
                </View>
            </View>
            <KeyboardStickyView offset={{ closed: 0, opened: bottom }} style={styles.overlay}>
                <View
                    onLayout={(event) => {
                        onComposerLayout(event);
                        if (Platform.OS === "web") setComposerHeight(event.nativeEvent.layout.height);
                    }}
                    ref={composerRef}
                    style={[styles.composer, { paddingBottom: bottom }]}
                >
                    <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TextInput
                            accessibilityLabel="Message"
                            multiline
                            onChangeText={setInput}
                            placeholder="Make a little space for…"
                            placeholderTextColor={colors.muted}
                            style={[styles.input, { color: colors.text }]}
                            value={input}
                        />
                        <Pressable
                            accessibilityLabel="Send message"
                            accessibilityRole="button"
                            disabled={!input.trim() || streaming}
                            onPress={send}
                            style={[
                                styles.send,
                                { backgroundColor: colors.accent, opacity: input.trim() && !streaming ? 1 : 0.4 },
                            ]}
                        >
                            <MaterialIcons color="#FFFFFF" name="arrow-upward" size={22} />
                        </Pressable>
                    </View>
                </View>
            </KeyboardStickyView>
        </View>
    );
}

const palettes = {
    dark: {
        accent: "#577D68",
        background: "#151B19",
        border: "#35423B",
        muted: "#A4B4AB",
        surface: "#242E29",
        text: "#EDF3EE",
    },
    light: {
        accent: "#38634F",
        background: "#F6F5F0",
        border: "#DDDFD5",
        muted: "#69796F",
        surface: "#FFFFFF",
        text: "#24392F",
    },
};

const styles = StyleSheet.create({
    assistantMessage: { alignSelf: "flex-start" },
    back: { justifyContent: "center", minHeight: 44, width: 28 },
    bubble: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 14 },
    composer: { paddingHorizontal: 16, paddingTop: 12 },
    content: { paddingHorizontal: 20, paddingTop: 16 },
    header: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        left: 0,
        overflow: "hidden",
        position: "absolute",
        right: 0,
        top: 0,
    },
    heading: { flex: 1, gap: 4 },
    history: { alignItems: "center", gap: 2, minWidth: 44 },
    historyLabel: { fontSize: 10 },
    input: { flex: 1, fontSize: 16, maxHeight: 120, minHeight: 44, paddingHorizontal: 12, paddingVertical: 12 },
    inputRow: { alignItems: "flex-end", borderRadius: 26, borderWidth: 1, flexDirection: "row", padding: 5 },
    list: { flex: 1 },
    message: { marginBottom: 18, maxWidth: "90%" },
    messageText: { fontSize: 16, lineHeight: 24 },
    overlay: { bottom: 0, left: 0, position: "absolute", right: 0 },
    role: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 8, marginLeft: 4 },
    screen: { flex: 1 },
    send: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
    subtitle: { fontSize: 11 },
    title: { fontSize: 16, fontWeight: "600" },
    toolbar: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
    userMessage: { alignSelf: "flex-end" },
});
