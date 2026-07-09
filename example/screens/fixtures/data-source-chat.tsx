import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import { MutationDataSource } from "~/screens/fixtures/MutationDataSource";

type Message = { id: string; text: string };

export default function DataSourceChatFixture() {
    const nextId = useRef(1_000);
    const source = useMemo(
        () =>
            new MutationDataSource<Message>({
                generatedItemFactory: (index) => ({ id: `message-${index}`, text: `Message ${index + 1}` }),
                generatedKeyPrefix: "message-",
                length: 100,
            }),
        [],
    );
    const [, setRevision] = useState(0);
    const mutate = (callback: () => void) => {
        callback();
        setRevision(source.getRevision());
    };

    return (
        <View style={styles.container}>
            <View style={styles.controls}>
                <Pressable
                    onPress={() =>
                        mutate(() => {
                            const firstId = nextId.current;
                            nextId.current += 100;
                            source.splice(
                                0,
                                0,
                                Array.from({ length: 100 }, (_, index) => {
                                    const id = `older-${firstId + index}`;
                                    return { item: { id, text: `Older message ${firstId + index}` }, key: id };
                                }),
                            );
                        })
                    }
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>Prepend 100</Text>
                </Pressable>
                <Pressable
                    onPress={() =>
                        mutate(() => {
                            const id = `new-${nextId.current++}`;
                            source.splice(source.getLength(), 0, [
                                { item: { id, text: `New message ${id}` }, key: id },
                            ]);
                        })
                    }
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>Append</Text>
                </Pressable>
                <Text style={styles.metric}>{source.getLength()} messages</Text>
            </View>
            <LegendList<Message>
                alignItemsAtEnd
                dataSource={source}
                estimatedItemSize={62}
                initialScrollAtEnd
                maintainScrollAtEnd
                maintainVisibleContentPosition
                recycleItems
                renderItem={({ index, item }) => (
                    <View style={[styles.message, index % 2 === 0 && styles.alternateMessage]}>
                        <Text style={styles.messageText}>{item?.text ?? "Loading…"}</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    alternateMessage: { alignSelf: "flex-end", backgroundColor: "#2563eb" },
    button: { backgroundColor: "#111827", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
    buttonText: { color: "white", fontSize: 12, fontWeight: "700" },
    container: { backgroundColor: "#f1f5f9", flex: 1 },
    controls: { alignItems: "center", backgroundColor: "white", flexDirection: "row", gap: 8, padding: 10 },
    message: {
        alignSelf: "flex-start",
        backgroundColor: "#475569",
        borderRadius: 14,
        marginHorizontal: 12,
        marginVertical: 4,
        maxWidth: "78%",
        minHeight: 48,
        padding: 12,
    },
    messageText: { color: "white", fontSize: 14 },
    metric: { color: "#64748b", fontSize: 12, marginLeft: "auto" },
});
