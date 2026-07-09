import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardGestureArea, KeyboardProvider, KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareLegendList } from "@legendapp/list/keyboard";

type Message = {
    id: string;
    sender: "user" | "bot";
    text: string;
    timeStamp: number;
};

let idCounter = 1;

const initialMessages: Message[] = [
    {
        id: "initial-message",
        sender: "bot",
        text: "This is the only chat message.",
        timeStamp: Date.now(),
    },
];

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

export default function ChatKeyboardSingleMessage() {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [inputText, setInputText] = useState("");
    const insets = useSafeAreaInsets();

    const sendMessage = () => {
        const text = inputText || "New single-message test reply";

        if (text.trim()) {
            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    id: String(idCounter++),
                    sender: "user",
                    text,
                    timeStamp: Date.now(),
                },
            ]);
            setInputText("");
        }
    };

    const resetMessages = () => {
        setMessages(initialMessages);
        setInputText("");
    };

    return (
        <KeyboardProvider>
            <SafeAreaView edges={["bottom"]} style={styles.container}>
                <KeyboardGestureArea interpolator="ios" offset={60} style={styles.container}>
                    <KeyboardAwareLegendList
                        alignItemsAtEnd
                        contentContainerStyle={styles.contentContainer}
                        data={messages}
                        estimatedItemSize={80}
                        initialScrollAtEnd
                        keyboardDismissMode="interactive"
                        keyboardOffset={insets.bottom}
                        keyExtractor={(item) => item.id}
                        maintainScrollAtEnd
                        maintainVisibleContentPosition
                        recycleItems
                        renderItem={(props) => <ChatMessage {...props} />}
                        style={styles.list}
                    />
                </KeyboardGestureArea>
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            onChangeText={setInputText}
                            placeholder="Type a message"
                            style={styles.input}
                            value={inputText}
                        />
                        <Button onPress={sendMessage} title="Send" />
                        <Button onPress={resetMessages} title="Reset" />
                    </View>
                </KeyboardStickyView>
            </SafeAreaView>
        </KeyboardProvider>
    );
}

const styles = StyleSheet.create({
    botMessageContainer: {
        backgroundColor: "#f1f1f1",
    },
    botStyle: {
        alignSelf: "flex-start",
        maxWidth: "75%",
    },
    container: {
        backgroundColor: "#fff",
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
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
    list: {
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
    timeStamp: {
        marginVertical: 5,
    },
    timeStampText: {
        color: "#888",
        fontSize: 12,
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
        maxWidth: "75%",
    },
});
