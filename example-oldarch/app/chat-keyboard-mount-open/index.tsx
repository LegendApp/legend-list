import { useRef, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardGestureArea, KeyboardProvider, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAvoidingLegendList } from "@legendapp/list/keyboard-legacy";

type Message = {
    id: string;
    sender: "user" | "bot";
    text: string;
    timeStamp: number;
};

let idCounter = 0;
const MS_PER_SECOND = 1000;

const createDefaultMessages = () =>
    Array.from({ length: 24 }, (_, index) => {
        const sender = index % 2 === 0 ? "user" : "bot";
        return {
            id: String(idCounter++),
            sender,
            text:
                sender === "user"
                    ? `User message ${index + 1}: keep the latest item visible while the keyboard moves.`
                    : `Bot reply ${index + 1}: this screen mounts the list only after the keyboard is already open.`,
            timeStamp: Date.now() - (24 - index) * MS_PER_SECOND,
        } as Message;
    });

function ChatMessage({ item }: { item: Message }) {
    return (
        <>
            <View
                style={[
                    styles.messageContainer,
                    item.sender === "bot" ? styles.botMessageContainer : styles.userMessageContainer,
                    item.sender === "bot" ? styles.botStyle : styles.userStyle,
                ]}
            >
                <Text style={[styles.messageText, item.sender === "user" && styles.userMessageText]}>{item.text}</Text>
            </View>
            <View style={[styles.timeStamp, item.sender === "bot" ? styles.botStyle : styles.userStyle]}>
                <Text style={styles.timeStampText}>{new Date(item.timeStamp).toLocaleTimeString()}</Text>
            </View>
        </>
    );
}

export default function ChatKeyboardMountOpen() {
    const insets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);
    const [messages, setMessages] = useState<Message[]>(() => createDefaultMessages());
    const [inputText, setInputText] = useState("");
    const [showList, setShowList] = useState(false);
    const [listKey, setListKey] = useState(0);

    const focusInput = () => {
        inputRef.current?.focus();
    };

    const mountListWhileOpen = () => {
        focusInput();
        setShowList(true);
        setListKey((prev) => prev + 1);
    };

    const unmountList = () => {
        focusInput();
        setShowList(false);
    };

    const resetMessages = () => {
        focusInput();
        setMessages(createDefaultMessages());
    };

    const sendMessage = () => {
        const text = inputText.trim() || "Empty message";
        setMessages((prev) => [...prev, { id: String(idCounter++), sender: "user", text, timeStamp: Date.now() }]);
        setInputText("");
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                {
                    id: String(idCounter++),
                    sender: "bot",
                    text: `Echo: ${text}`,
                    timeStamp: Date.now(),
                },
            ]);
        }, 300);
    };

    return (
        <KeyboardProvider>
            <View style={[styles.container, { paddingBottom: insets.bottom, paddingTop: insets.top }]}>
                <View style={styles.headerCard}>
                    <Text style={styles.title}>Keyboard mount-open repro</Text>
                    <Text style={styles.instructions}>1. Focus the input so the keyboard is open.</Text>
                    <Text style={styles.instructions}>2. Tap "Mount list while open" or "Remount while open".</Text>
                    <Text style={styles.instructions}>
                        3. Dismiss the keyboard, then focus again and watch the jump.
                    </Text>
                    <View style={styles.buttonRow}>
                        <Button
                            onPress={mountListWhileOpen}
                            title={showList ? "Remount while open" : "Mount list while open"}
                        />
                    </View>
                    <View style={styles.buttonRow}>
                        <Button onPress={unmountList} title="Unmount list" />
                        <Button onPress={resetMessages} title="Reset messages" />
                    </View>
                </View>
                <KeyboardGestureArea interpolator="ios" offset={60} style={styles.listContainer}>
                    {showList ? (
                        <KeyboardAvoidingLegendList
                            alignItemsAtEnd
                            contentContainerStyle={styles.contentContainer}
                            data={messages}
                            estimatedItemSize={80}
                            initialScrollAtEnd
                            key={listKey}
                            keyExtractor={(item) => item.id}
                            maintainScrollAtEnd
                            maintainVisibleContentPosition
                            renderItem={ChatMessage}
                            safeAreaInsetBottom={insets.bottom}
                            style={styles.list}
                        />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.placeholderTitle}>List is not mounted yet.</Text>
                            <Text style={styles.placeholderText}>Open the keyboard first, then mount the list.</Text>
                        </View>
                    )}
                </KeyboardGestureArea>
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            autoFocus
                            onChangeText={setInputText}
                            placeholder="Keep this focused before mounting the list"
                            ref={inputRef}
                            style={styles.input}
                            value={inputText}
                        />
                        <Button onPress={sendMessage} title="Send" />
                    </View>
                </KeyboardStickyView>
            </View>
        </KeyboardProvider>
    );
}

const styles = StyleSheet.create({
    botMessageContainer: {
        backgroundColor: "#f1f1f1",
    },
    botStyle: {
        alignSelf: "flex-start",
        maxWidth: "80%",
    },
    buttonRow: {
        flexDirection: "row",
        gap: 12,
        justifyContent: "space-between",
        marginTop: 8,
    },
    container: {
        backgroundColor: "#fff",
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
    },
    headerCard: {
        backgroundColor: "#f6f8fb",
        borderBottomColor: "#d5dbe5",
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 2,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    input: {
        borderColor: "#ccc",
        borderRadius: 5,
        borderWidth: 1,
        flex: 1,
        marginRight: 10,
        padding: 10,
    },
    inputContainer: {
        alignItems: "center",
        backgroundColor: "white",
        borderColor: "#ccc",
        borderTopWidth: 1,
        flexDirection: "row",
        padding: 10,
    },
    instructions: {
        color: "#445068",
        fontSize: 13,
    },
    list: {
        flex: 1,
    },
    listContainer: {
        flex: 1,
    },
    messageContainer: {
        borderRadius: 16,
        marginVertical: 4,
        padding: 16,
    },
    messageText: {
        fontSize: 16,
    },
    placeholder: {
        alignItems: "center",
        flex: 1,
        justifyContent: "center",
        padding: 24,
    },
    placeholderText: {
        color: "#667085",
        fontSize: 14,
        marginTop: 8,
        textAlign: "center",
    },
    placeholderTitle: {
        color: "#1f2937",
        fontSize: 17,
        fontWeight: "600",
    },
    timeStamp: {
        marginVertical: 5,
    },
    timeStampText: {
        color: "#888",
        fontSize: 12,
    },
    title: {
        color: "#111827",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 4,
    },
    userMessageContainer: {
        backgroundColor: "#007AFF",
    },
    userMessageText: {
        color: "white",
    },
    userStyle: {
        alignItems: "flex-end",
        alignSelf: "flex-end",
        maxWidth: "80%",
    },
});
