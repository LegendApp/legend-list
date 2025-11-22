import { useEffect, useState } from "react";
import { Dimensions, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list";
import { useHeaderHeight } from "@react-navigation/elements";

type Message = {
    id: string;
    text: string;
    sender: "user" | "system";
    timeStamp: number;
    isPlaceholder?: boolean;
};

let idCounter = 0;

const AIChat = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const headerHeight = Platform.OS === "ios" ? useHeaderHeight() : 80;
    const screenHeight = Dimensions.get("window").height;
    const availableHeight = screenHeight - headerHeight; // Subtract header and some padding

    useEffect(() => {
        // After 1 second, add user message and system placeholder
        const timer1 = setTimeout(() => {
            setMessages([
                {
                    id: String(idCounter++),
                    sender: "user",
                    text: "Hey, can you help me understand how React Native virtualization works?",
                    timeStamp: Date.now(),
                },
                {
                    id: String(idCounter++),
                    isPlaceholder: true,
                    sender: "system",
                    text: "",
                    timeStamp: Date.now(),
                },
            ]);
        }, 500);

        // After 3 seconds total (2 seconds after the first), start streaming the message
        const fullText = `React Native virtualization is a performance optimization technique that's crucial for handling large lists efficiently. Here's how it works:

1. **Rendering Only Visible Items**: Instead of rendering all items in a list at once, virtualization only renders the items that are currently visible on screen, plus a small buffer of items just outside the visible area.

2. **Dynamic Item Creation/Destruction**: As you scroll, items that move out of view are removed from the DOM/native view hierarchy, and new items that come into view are created. This keeps memory usage constant regardless of list size.

3. **View Recycling**: Advanced virtualization systems reuse view components rather than creating new ones, which reduces garbage collection and improves performance.

4. **Estimated vs Actual Sizing**: The system uses estimated item sizes to calculate scroll positions and total content size, then adjusts as actual sizes are measured.

5. **Legend List Implementation**: Legend List enhances this by providing better handling of dynamic item sizes, bidirectional scrolling, and maintains scroll position more accurately than FlatList.

The key benefits are:
- Constant memory usage regardless of data size
- Smooth scrolling performance
- Better handling of dynamic content
- Reduced time to interactive

This makes it possible to scroll through thousands of items without performance degradation, which is essential for modern mobile apps dealing with large datasets like social media feeds, chat histories, or product catalogs.`;

        const words = fullText.split(" ");
        let currentWordIndex = 0;

        const timer2 = setTimeout(() => {
            // Replace placeholder with empty system message
            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg.isPlaceholder
                        ? {
                              id: String(idCounter++),
                              isPlaceholder: false,
                              sender: "system",
                              text: "",
                              timeStamp: Date.now(),
                          }
                        : msg,
                ),
            );

            // Start streaming words
            const streamInterval = setInterval(() => {
                if (currentWordIndex < words.length) {
                    const currentText = words.slice(0, currentWordIndex + 1).join(" ");
                    setMessages((prevMessages) =>
                        prevMessages.map((msg) =>
                            msg.sender === "system" && !msg.isPlaceholder && msg.text !== fullText
                                ? { ...msg, text: currentText }
                                : msg,
                        ),
                    );
                    currentWordIndex++;
                } else {
                    clearInterval(streamInterval);
                }
            }, 50); // Stream one word every 16ms
        }, 1500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    return (
        <SafeAreaView edges={["bottom"]} style={styles.container}>
            <KeyboardAvoidingView
                behavior="padding"
                contentContainerStyle={{ flex: 1 }}
                keyboardVerticalOffset={headerHeight}
                style={styles.container}
            >
                <LegendList
                    // alignItemsAtEnd
                    contentContainerStyle={styles.contentContainer}
                    data={messages}
                    estimatedItemSize={60}
                    keyExtractor={(item) => item.id}
                    // maintainScrollAtEnd
                    maintainVisibleContentPosition
                    renderItem={({ item }) => (
                        <>
                            {item.isPlaceholder ? (
                                <View
                                    style={[
                                        styles.systemMessageContainer,
                                        styles.systemStyle,
                                        { minHeight: availableHeight * 0.9 }, // Take up most of available space
                                    ]}
                                >
                                    <View style={[styles.placeholderContainer, styles.messageContainer]}>
                                        <View style={styles.typingIndicator}>
                                            <View style={[styles.dot, styles.dot1]} />
                                            <View style={[styles.dot, styles.dot2]} />
                                            <View style={[styles.dot, styles.dot3]} />
                                        </View>
                                        <Text style={styles.placeholderText}>AI is thinking...</Text>
                                    </View>
                                </View>
                            ) : (
                                <View
                                    style={[
                                        styles.messageContainer,
                                        item.sender === "system"
                                            ? styles.systemMessageContainer
                                            : styles.userMessageContainer,
                                        item.sender === "system" ? styles.systemStyle : styles.userStyle,
                                    ]}
                                >
                                    <Text
                                        style={[styles.messageText, item.sender === "user" && styles.userMessageText]}
                                    >
                                        {item.text}
                                    </Text>
                                    <View
                                        style={[
                                            styles.timeStamp,
                                            item.sender === "system" ? styles.systemStyle : styles.userStyle,
                                        ]}
                                    >
                                        <Text style={styles.timeStampText}>
                                            {new Date(item.timeStamp).toLocaleTimeString()}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#fff",
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
    },
    dot: {
        backgroundColor: "#007AFF",
        borderRadius: 4,
        height: 8,
        marginHorizontal: 2,
        width: 8,
    },
    dot1: {
        animationDelay: "0s",
        animationDuration: "1.4s",
        animationIterationCount: "infinite",
        animationName: "typing",
    },
    dot2: {
        animationDelay: "0.2s",
        animationDuration: "1.4s",
        animationIterationCount: "infinite",
        animationName: "typing",
    },
    dot3: {
        animationDelay: "0.4s",
        animationDuration: "1.4s",
        animationIterationCount: "infinite",
        animationName: "typing",
    },
    messageContainer: {
        borderRadius: 16,
        marginVertical: 4,
        padding: 16,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    placeholderContainer: {
        backgroundColor: "#f8f9fa",
        borderColor: "#e9ecef",
        borderWidth: 1,
    },
    placeholderText: {
        color: "#666",
        fontSize: 14,
        fontStyle: "italic",
    },
    systemMessageContainer: {},
    systemStyle: {
        alignSelf: "flex-start",
        maxWidth: "85%",
    },
    timeStamp: {
        marginVertical: 5,
    },
    timeStampText: {
        color: "#888",
        fontSize: 12,
    },
    typingIndicator: {
        alignItems: "center",
        flexDirection: "row",
        marginBottom: 12,
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

export default AIChat;
