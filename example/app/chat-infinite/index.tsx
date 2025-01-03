import { LegendList } from "@legendapp/list";
import { useState } from "react";
import { Button, KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from "react-native";
import { RefreshControl } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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
        text: "Hi, I have a question",
        sender: "user",
        timeStamp: Date.now() - MS_PER_SECOND * 5,
    },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "Are we there yet?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 4 },
    { id: String(idCounter++), text: "How can I help you?", sender: "bot", timeStamp: Date.now() - MS_PER_SECOND * 3 },
];

// TODO: under construction
const ChatExample = () => {
    const [messages, setMessages] = useState<Message[]>(defaultChatMessages);
    const [inputText, setInputText] = useState("");

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
                        text: `Previous message${(initialIndex - i - 1).toString()}`,
                        sender: "user" as MessageSide,
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
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <KeyboardAvoidingView style={styles.container} behavior="padding">
                <LegendList
                    data={messages}
                    contentContainerStyle={styles.contentContainer}
                    keyExtractor={(item) => item.id}
                    estimatedItemSize={80}
                    maintainScrollAtEnd
                    maintainVisibleContentPosition
                    alignItemsAtEnd
                    onStartReachedThreshold={0.2}
                    onStartReached={(props) => {
                        console.log("onStartReached", props);
                        onRefresh();
                    }}
                    recycleItems={true}
                    ListHeaderComponent={<View style={{ height: top }} />}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} tintColor={"#000000"} progressViewOffset={40} />
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
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message"
                    />
                    <Button title="Send" onPress={sendMessage} />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
