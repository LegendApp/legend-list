import { useState } from "react";
import { Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegendList } from "@legendapp/list/react-native";
import { buildInboxNotifications, type InboxNotification } from "../../../examples-shared/commerce";

export default function NotificationsInboxScreen() {
    const [items, setItems] = useState(() => buildInboxNotifications());

    const addBatch = () => {
        const nextIndex = items.length;
        setItems((current) => [
            ...current,
            ...buildInboxNotifications(12).map((item, index) => ({
                ...item,
                id: `notification-live-${nextIndex + index}`,
                isUnread: true,
                timeLabel: "Now",
            })),
        ]);
    };

    return (
        <>
            <Stack.Screen options={{ headerTitle: "Notifications Inbox", headerTransparent: false }} />
            <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
                <View style={styles.actions}>
                    <Pressable onPress={addBatch} style={styles.button}>
                        <Text style={styles.buttonText}>Add Batch</Text>
                    </Pressable>
                </View>
                <LegendList<InboxNotification>
                    contentContainerStyle={styles.listContent}
                    data={items}
                    estimatedItemSize={92}
                    keyExtractor={(item) => item.id}
                    maintainScrollAtEnd
                    renderItem={({ item }) => (
                        <View style={[styles.card, item.isUnread && styles.cardUnread]}>
                            <View style={styles.row}>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.cardTime}>{item.timeLabel}</Text>
                            </View>
                            <Text style={styles.cardBody}>{item.body}</Text>
                        </View>
                    )}
                />
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    actions: {
        alignItems: "flex-end",
        paddingBottom: 12,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    button: {
        backgroundColor: "#111827",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    buttonText: {
        color: "#FFFFFF",
        fontWeight: "700",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        marginBottom: 12,
        padding: 16,
    },
    cardBody: {
        color: "#4B5563",
        fontSize: 14,
        lineHeight: 20,
        marginTop: 6,
    },
    cardTime: {
        color: "#6B7280",
        fontWeight: "600",
    },
    cardTitle: {
        color: "#111827",
        fontSize: 16,
        fontWeight: "700",
    },
    cardUnread: {
        borderColor: "#C4B5FD",
        borderWidth: 1,
    },
    listContent: {
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    row: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    safeArea: {
        backgroundColor: "#F5F3FF",
        flex: 1,
    },
});
