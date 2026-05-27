import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardGestureArea, KeyboardProvider, KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareLegendList } from "@legendapp/list/keyboard";

type Message = {
    id: string;
    text: string;
    sender: "user" | "bot";
    timeStamp: number;
};

type MessageTemplate = {
    sender: Message["sender"];
    text: string;
    repeatCount: number;
    secondsAgo: number;
};

let idCounter = 0;
const MS_PER_SECOND = 1000;
const CONVERSATION_REPEAT_COUNT = 13;

const repeatText = (text: string, count: number) => Array.from({ length: count }, () => text).join(" ");

const conversationTemplate: MessageTemplate[] = [
    { repeatCount: 2, secondsAgo: 5, sender: "user", text: "Hi, I have a question about your product" },
    { repeatCount: 11, secondsAgo: 4, sender: "bot", text: "Hello there! How can I assist you today?" },
    { repeatCount: 2, secondsAgo: 4, sender: "user", text: "I'm looking for information about pricing plans" },
    { repeatCount: 11, secondsAgo: 4, sender: "bot", text: "We offer several pricing tiers based on your needs" },
    { repeatCount: 11, secondsAgo: 4, sender: "bot", text: "Our basic plan starts at $9.99 per month" },
    { repeatCount: 2, secondsAgo: 4, sender: "user", text: "Do you offer any discounts for annual billing?" },
    { repeatCount: 11, secondsAgo: 4, sender: "bot", text: "Yes! You can save 20% with our annual billing option" },
    { repeatCount: 2, secondsAgo: 4, sender: "user", text: "That sounds great. What features are included?" },
    {
        repeatCount: 11,
        secondsAgo: 4,
        sender: "bot",
        text: "The basic plan includes all core features plus 10GB storage",
    },
    {
        repeatCount: 11,
        secondsAgo: 4,
        sender: "bot",
        text: "Premium plans include priority support and additional tools",
    },
    { repeatCount: 2, secondsAgo: 4, sender: "user", text: "I think the basic plan would work for my needs" },
    { repeatCount: 11, secondsAgo: 4, sender: "bot", text: "Perfect! I can help you get set up with that" },
    { repeatCount: 2, secondsAgo: 4, sender: "user", text: "Thanks for your help so far" },
    {
        repeatCount: 11,
        secondsAgo: 3,
        sender: "bot",
        text: "You're welcome! Is there anything else I can assist with today?",
    },
];

const defaultChatMessages: Message[] = Array.from(
    { length: CONVERSATION_REPEAT_COUNT },
    () => conversationTemplate,
).flatMap((conversation) =>
    conversation.map(({ sender, text, repeatCount, secondsAgo }) => ({
        id: String(idCounter++),
        sender,
        text: repeatText(text, repeatCount),
        timeStamp: Date.now() - MS_PER_SECOND * secondsAgo,
    })),
);

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

const ChatKeyboardBig = () => {
    const [messages, setMessages] = useState<Message[]>(defaultChatMessages);
    const [inputText, setInputText] = useState("");
    const insets = useSafeAreaInsets();

    const sendMessage = () => {
        const text = inputText || repeatText("Empty message", 45);
        if (text.trim()) {
            setMessages((prevMessages) => [
                ...prevMessages,
                { id: String(idCounter++), sender: "user", text, timeStamp: Date.now() },
            ]);
            setInputText("");
            setTimeout(() => {
                setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                        id: String(idCounter++),
                        sender: "bot",
                        text: `Answer: ${text.toUpperCase()} `,
                        timeStamp: Date.now(),
                    },
                ]);
            }, 300);
        }
    };

    return (
        <KeyboardProvider>
            <SafeAreaView edges={["bottom"]} style={[styles.container]}>
                <KeyboardGestureArea interpolator="ios" offset={60} style={styles.container}>
                    <KeyboardAwareLegendList
                        alignItemsAtEnd
                        contentContainerStyle={styles.contentContainer}
                        data={messages}
                        estimatedItemSize={80}
                        initialScrollAtEnd
                        keyboardOffset={insets.bottom}
                        keyExtractor={(item) => item.id}
                        maintainScrollAtEnd
                        maintainVisibleContentPosition
                        renderItem={ChatMessage}
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
                    </View>
                </KeyboardStickyView>
            </SafeAreaView>
        </KeyboardProvider>
    );
};

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
        // flexGrow: 1,
        paddingBottom: 10,
        paddingHorizontal: 20,
        paddingTop: 96,
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

export default ChatKeyboardBig;
