import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";

// Reproduces a freeze when capping a chat list by trimming the OLDEST messages
// from the FRONT of the data array while the list is pinned to the bottom.
//
// High-throughput chats (e.g. a livestream chat) often cap the list to a fixed
// window to bound memory over long sessions. Until the cap (MAX) is reached this
// is append-only and maintainScrollAtEnd follows the newest message perfectly.
// Once trimming starts, the live flow breaks:
//   - maintainVisibleContentPosition data:false -> the viewport visibly JUMPS on
//     every trim (the removed top content is not compensated)
//   - data:true (used below)                     -> the removal is compensated so
//     there is no jump, but maintainScrollAtEnd stops following: after the anchor
//     adjustment isWithinMaintainScrollAtEndThreshold flips to false, so the
//     newest messages stay just below the fold = "freeze".
//
// What to watch: "latest #N" in the header should always equal the number on the
// message at the very bottom of the list. They match while append-only; once
// trimming kicks in (count reaches MAX) they DIVERGE — the list no longer stays
// pinned to the newest message, and a real app would have to scroll manually.

type Message = { id: string; text: string };

const MAX = 40; // cap; intentionally small so trimming starts within a few seconds

const LINES = [
    "short message",
    "a slightly longer chat message here",
    "an even longer message that wraps onto multiple lines so row heights vary",
];

let idCounter = 0;
const makeMessage = (): Message => {
    idCounter += 1;
    return { id: String(idCounter), text: `#${idCounter}  ${LINES[idCounter % LINES.length]}` };
};

const ChatTrim = () => {
    const [messages, setMessages] = useState<Message[]>(() => Array.from({ length: 10 }, makeMessage));

    useEffect(() => {
        const interval = setInterval(() => {
            setMessages((prev) => {
                // Append a small batch to simulate throughput / batched updates.
                const batchSize = 1 + (idCounter % 3); // 1..3 per tick
                const next = [...prev, ...Array.from({ length: batchSize }, makeMessage)];
                // Cap memory by trimming the OLDEST messages from the FRONT:
                return next.length > MAX ? next.slice(next.length - MAX) : next;
            });
        }, 250);
        return () => clearInterval(interval);
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.header}>
                count: {messages.length} / cap {MAX} — latest is #{idCounter}
            </Text>
            <LegendList
                alignItemsAtEnd
                contentContainerStyle={styles.content}
                data={messages}
                estimatedItemSize={48}
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainScrollAtEndThreshold={0.1}
                maintainVisibleContentPosition={{ data: true }}
                recycleItems
                renderItem={({ item }) => (
                    <View style={styles.bubble}>
                        <Text style={styles.text}>{item.text}</Text>
                    </View>
                )}
                style={styles.list}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    bubble: {
        backgroundColor: "#222",
        borderRadius: 8,
        marginVertical: 3,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    container: {
        backgroundColor: "#111",
        flex: 1,
    },
    content: {
        paddingHorizontal: 10,
    },
    header: {
        color: "#0f0",
        padding: 8,
    },
    list: {
        flex: 1,
    },
    text: {
        color: "#fff",
    },
});

export default ChatTrim;
