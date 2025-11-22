import { useState } from "react";
import { Button, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { RefreshControl } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list";
import { useHeaderHeight } from "@react-navigation/elements";

type MessageSide = "user" | "bot";
type Message = {
    id: string;
    text: string;
    sender: MessageSide;
    timeStamp: number;
};

let idCounter = 0;
const MS_PER_SECOND = 1000;

const defaultChatMessages: Message[] = [
    {
        id: String(idCounter++),
        sender: "user",
        text: "Hi, I have a question",
        timeStamp: Date.now() - MS_PER_SECOND * 5,
    },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet1?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet2?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet3?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet4?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet5?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet6?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet7?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet8?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet9?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet10?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet11?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet12?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet13?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet14?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet15?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet16?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet17?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), sender: "bot", text: "Are we there yet18?", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    {
        id: String(idCounter++),
        sender: "bot",
        text: "LAST MESSAGE: How can I help you?",
        timeStamp: Date.now() - MS_PER_SECOND * 3,
    },
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

    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = () => {
        console.log("onRefresh");
        setRefreshing(true);
        setTimeout(() => {
            setMessages((prevData) => {
                const initialIndex = Number.parseInt(prevData[0].id);
                const newData = [
                    ...Array.from({ length: 5 }, (_, i) => ({
                        id: (initialIndex - i - 1).toString(),
                        sender: "user" as MessageSide,
                        text: `Previous message${(initialIndex - i - 1).toString()}`,
                        timeStamp: Date.now() - MS_PER_SECOND * 5,
                    })).reverse(),
                    ...prevData,
                ];
                return newData;
            });
            setRefreshing(false);
        }, 500);
    };

    // useEffect(() => {
    //     setInterval(() => {
    //         setMessages((prevData) => {
    //             const initialIndex = Number.parseInt(prevData[0].id);
    //             const newData = [
    //                 ...Array.from({ length: 1 }, (_, i) => ({
    //                     id: (initialIndex - i - 1).toString(),
    //                     text: `Previous message${(initialIndex - i - 1).toString()}`,
    //                     sender: "user" as MessageSide,
    //                     timeStamp: Date.now() - MS_PER_SECOND * 5,
    //                 })).reverse(),
    //                 ...prevData,
    //             ];
    //             return newData;
    //         });
    //         setRefreshing(false);
    //     }, 500);
    // }, []);

    const { top } = useSafeAreaInsets();

    return (
        <SafeAreaView edges={["bottom"]} style={styles.container}>
            <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.container}>
                <LegendList
                    alignItemsAtEnd
                    contentContainerStyle={styles.contentContainer}
                    data={messages}
                    estimatedItemSize={80}
                    initialScrollIndex={messages.length - 1}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={<View style={{ height: top }} />}
                    maintainScrollAtEnd
                    maintainVisibleContentPosition
                    recycleItems={true}
                    refreshControl={
                        <RefreshControl
                            onRefresh={onRefresh}
                            progressViewOffset={40}
                            refreshing={refreshing}
                            tintColor={"#000000"}
                        />
                    }
                    renderItem={({ item }) => (
                        <View>
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
                        </View>
                    )}
                />
                <View style={styles.inputContainer}>
                    <TextInput
                        onChangeText={setInputText}
                        placeholder="Type a message"
                        style={styles.input}
                        value={inputText}
                    />
                    <Button onPress={sendMessage} title="Send" />
                </View>
            </KeyboardAvoidingView>
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

export default ChatExample;
