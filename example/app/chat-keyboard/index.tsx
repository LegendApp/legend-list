import { LegendList } from "@legendapp/list/keyboard-controller";
import { AnimatedLegendList } from "@legendapp/list/reanimated";
import { useHeaderHeight } from "@react-navigation/elements";
import { useState } from "react";
import { Button, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView, KeyboardProvider } from "react-native-keyboard-controller";

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
        text: "Hi, I have a question about your product",
        sender: "user",
        timeStamp: Date.now() - MS_PER_SECOND * 5,
    },
    {
        id: String(idCounter++),
        text: "Hello there! How can I assist you today?",
        sender: "bot",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "I'm looking for information about pricing plans",
        sender: "user",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "We offer several pricing tiers based on your needs",
        sender: "bot",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "Our basic plan starts at $9.99 per month",
        sender: "bot",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "Do you offer any discounts for annual billing?",
        sender: "user",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "Yes! You can save 20% with our annual billing option",
        sender: "bot",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "That sounds great. What features are included?",
        sender: "user",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "The basic plan includes all core features plus 10GB storage",
        sender: "bot",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "Premium plans include priority support and additional tools",
        sender: "bot",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "I think the basic plan would work for my needs",
        sender: "user",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "Perfect! I can help you get set up with that",
        sender: "bot",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "Thanks for your help so far",
        sender: "user",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        text: "You're welcome! Is there anything else I can assist with today?",
        sender: "bot",
        timeStamp: Date.now() - MS_PER_SECOND * 3,
    },
];

const ChatExample = () => {
    const [messages, setMessages] = useState<Message[]>(defaultChatMessages);
    const [inputText, setInputText] = useState("");
    const headerHeight = Platform.OS === "ios" ? useHeaderHeight() : 56;

    const sendMessage = () => {
        const text = inputText || "Empty message";
        if (text.trim()) {
            setMessages((messages) => [
                ...messages,
                { id: String(idCounter++), text: text, sender: "user", timeStamp: Date.now() },
            ]);
            setInputText("");
            setTimeout(() => {
                setMessages((messages) => [
                    ...messages,
                    {
                        id: String(idCounter++),
                        text: `Answer: ${text.toUpperCase()}`,
                        sender: "bot",
                        timeStamp: Date.now(),
                    },
                ]);
            }, 300);
        }
    };

    // Note: There's something weird with the SafeAreaView interacting with the KeyboardAvoidingView here I think,
    // so there's some weird margins going on...

    return (
        <KeyboardProvider>
            <KeyboardAvoidingView
                style={styles.container}
                behavior="position"
                contentContainerStyle={{ flex: 1 }}
                keyboardVerticalOffset={headerHeight}
            >
                <LegendList
                    data={messages}
                    contentContainerStyle={styles.contentContainer}
                    keyExtractor={(item) => item.id}
                    estimatedItemSize={80}
                    LegendList={AnimatedLegendList}
                    maintainScrollAtEnd
                    alignItemsAtEnd
                    initialScrollIndex={messages.length - 1}
                    maintainVisibleContentPosition
                    renderItem={({ item }) => (
                        <>
                            <View
                                style={[
                                    styles.messageContainer,
                                    item.sender === "bot" ? styles.botMessageContainer : styles.userMessageContainer,
                                    item.sender === "bot" ? styles.botStyle : styles.userStyle,
                                ]}
                            >
                                <Text style={[styles.messageText, item.sender === "user" && styles.userMessageText]}>
                                    {item.text}
                                </Text>
                            </View>
                            <View
                                style={[styles.timeStamp, item.sender === "bot" ? styles.botStyle : styles.userStyle]}
                            >
                                <Text style={styles.timeStampText}>
                                    {new Date(item.timeStamp).toLocaleTimeString()}
                                </Text>
                            </View>
                        </>
                    )}
                />
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message"
                    />
                    <Button title="Send" onPress={sendMessage} />
                </View>
            </KeyboardAvoidingView>
        </KeyboardProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    contentContainer: {
        paddingHorizontal: 16,
    },
    messageContainer: {
        padding: 16,
        borderRadius: 16,
        marginVertical: 4,
    },
    messageText: {
        fontSize: 16,
    },
    userMessageText: {
        color: "white",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        borderTopWidth: 1,
        borderColor: "#ccc",
    },
    botMessageContainer: {
        backgroundColor: "#f1f1f1",
    },
    userMessageContainer: {
        backgroundColor: "#007AFF",
    },
    botStyle: {
        maxWidth: "75%",
        alignSelf: "flex-start",
    },
    userStyle: {
        maxWidth: "75%",
        alignSelf: "flex-end",
        alignItems: "flex-end",
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 5,
        padding: 10,
        marginRight: 10,
    },
    timeStamp: {
        marginVertical: 5,
    },
    timeStampText: {
        fontSize: 12,
        color: "#888",
    },
});

export default ChatExample;
