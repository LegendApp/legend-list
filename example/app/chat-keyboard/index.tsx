import { LegendList } from "@legendapp/list";
import { useHeaderHeight } from "@react-navigation/elements";
import { useState } from "react";
import { Button, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
        text: "Hi, I have a question",
        sender: "user",
        timeStamp: Date.now() - MS_PER_SECOND * 5,
    },
    { id: String(idCounter++), text: "Hello", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "How can I help you?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 3 },
];

const ChatExample = () => {
    const [messages, setMessages] = useState<Message[]>(defaultChatMessages);
    const [inputText, setInputText] = useState("");
    const headerHeight = Platform.OS === "ios" ? useHeaderHeight() : 0;

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

    return (
        <KeyboardProvider>
            <SafeAreaView style={styles.container} edges={["bottom"]}>

                <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={headerHeight}>
                    <LegendList
                        data={messages}
                        contentContainerStyle={styles.contentContainer}
                        keyExtractor={(item) => item.id}
                        estimatedItemSize={80}
                        maintainScrollAtEnd
                        alignItemsAtEnd
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
            </SafeAreaView>
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
