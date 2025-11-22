import { Fragment, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list";
import { useHeaderHeight } from "@react-navigation/elements";

type Message = {
    id: string;
    text: string;
    sender: "user" | "bot";
    timeStamp: number;
};

let idCounter = 0;
const MS_PER_SECOND = 1000;

const defaultChatMessages: Message[] = [
    {
        id: String(idCounter++),
        sender: "user",
        text: "Hi, I have a question about your product",
        timeStamp: Date.now() - MS_PER_SECOND * 5,
    },
    {
        id: String(idCounter++),
        sender: "bot",
        text: "Hello there! How can I assist you today?",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "user",
        text: "I'm looking for information about pricing plans",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "bot",
        text: "We offer several pricing tiers based on your needs",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "bot",
        text: "Our basic plan starts at $9.99 per month",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "user",
        text: "Do you offer any discounts for annual billing?",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "bot",
        text: "Yes! You can save 20% with our annual billing option",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "user",
        text: "That sounds great. What features are included?",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "bot",
        text: "The basic plan includes all core features plus 10GB storage",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "bot",
        text: "Premium plans include priority support and additional tools",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "user",
        text: "I think the basic plan would work for my needs",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "bot",
        text: "Perfect! I can help you get set up with that",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "user",
        text: "Thanks for your help so far",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: "bot",
        text: "You're welcome! Is there anything else I can assist with today?",
        timeStamp: Date.now() - MS_PER_SECOND * 3,
    },
];

const ChatResizeOuter = () => {
    const [messages, setMessages] = useState<Message[]>(defaultChatMessages);
    const [inputText, setInputText] = useState("");
    const headerHeight = Platform.OS === "ios" ? useHeaderHeight() : 80;
    const [buttonHeight, setButtonHeight] = useState(40);

    const _sendMessage = () => {
        const text = inputText || "Empty message";
        if (text.trim()) {
            setMessages((messages) => [
                ...messages,
                { id: String(idCounter++), sender: "user", text: text, timeStamp: Date.now() },
            ]);
            setInputText("");
            setTimeout(() => {
                setMessages((messages) => [
                    ...messages,
                    {
                        id: String(idCounter++),
                        sender: "bot",
                        text: `Answer: ${text.toUpperCase()}`,
                        timeStamp: Date.now(),
                    },
                ]);
            }, 300);
        }
    };

    return (
        <SafeAreaView edges={["bottom"]} style={styles.container}>
            <KeyboardAvoidingView
                behavior="padding"
                contentContainerStyle={{ flex: 1 }}
                keyboardVerticalOffset={headerHeight}
                style={styles.container}
            >
                <LegendList
                    alignItemsAtEnd
                    contentContainerStyle={styles.contentContainer}
                    data={messages}
                    estimatedItemSize={10} // A size that's way too small to check the behavior is correct
                    initialScrollIndex={messages.length - 1}
                    keyExtractor={(item) => item.id}
                    maintainScrollAtEnd
                    maintainScrollAtEndThreshold={0.1}
                    maintainVisibleContentPosition
                    renderItem={renderItem}
                />
            </KeyboardAvoidingView>
            <Pressable
                onPress={() => {
                    setButtonHeight(buttonHeight === 40 ? 300 : 40);
                }}
                style={{
                    alignItems: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.1)",
                    height: buttonHeight,
                    justifyContent: "center",
                }}
            >
                <Text style={{ fontSize: 16, fontWeight: "medium" }}>Resize</Text>
            </Pressable>
        </SafeAreaView>
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
        borderColor: "#ccc",
        borderTopWidth: 1,
        flexDirection: "row",
        padding: 10,
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

export default ChatResizeOuter;

const renderItem = ({ item }: { item: Message }) => {
    return (
        <Fragment>
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
        </Fragment>
    );
};
