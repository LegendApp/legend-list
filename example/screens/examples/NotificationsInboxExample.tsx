import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list/react-native";
import { buildInboxNotifications, type InboxNotification } from "../../../examples-shared/commerce";

const INITIAL_UNREAD_COUNT = 18;
const notificationTitles = ["Fraud check", "Payment summary", "Activity alert", "Team update"] as const;
const notificationBodies = [
    "A new payout settled, and the summary row expanded without shifting the visible window.",
    "Three new reactions arrived on the shared release checklist while the unread badge stayed anchored.",
    "A fresh audit note landed above the current viewport, so this surface now tests prepend stability too.",
    "Someone mentioned the inbox demo in a thread about maintainVisibleContentPosition behaving correctly on live inserts.",
] as const;

const initialInboxItems = buildInboxNotifications().map((item, index) => ({
    ...item,
    isUnread: index < INITIAL_UNREAD_COUNT,
}));

function buildLiveNotifications(start: number, count: number): InboxNotification[] {
    return Array.from({ length: count }, (_, offset) => {
        const sequence = start + offset;

        return {
            body: notificationBodies[sequence % notificationBodies.length]!,
            id: `notification-live-${sequence}`,
            isUnread: true,
            timeLabel: offset === 0 ? "Now" : `${offset}m`,
            title: notificationTitles[sequence % notificationTitles.length]!,
        };
    });
}

const styles = StyleSheet.create({
    actionHint: {
        color: "#475569",
        fontSize: 13,
        lineHeight: 18,
    },
    actions: {
        alignItems: "flex-start",
        gap: 10,
        marginTop: 8,
    },
    badge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    badgeRead: {
        backgroundColor: "#E2E8F0",
    },
    badgeText: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    badgeTextRead: {
        color: "#475569",
    },
    badgeTextUnread: {
        color: "#FFFFFF",
    },
    badgeUnread: {
        backgroundColor: "#2563EB",
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
        borderColor: "#E2E8F0",
        borderRadius: 18,
        borderWidth: 1,
        marginBottom: 12,
        padding: 16,
    },
    cardBody: {
        color: "#334155",
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
    },
    cardTime: {
        color: "#64748B",
        fontSize: 12,
        marginTop: 10,
    },
    cardTitle: {
        color: "#111827",
        flex: 1,
        fontSize: 16,
        fontWeight: "800",
        marginRight: 12,
    },
    cardUnread: {
        backgroundColor: "#EFF6FF",
        borderColor: "#2563EB",
    },
    header: {
        backgroundColor: "#FFFFFF",
        borderColor: "#DDD6FE",
        borderRadius: 24,
        borderWidth: 1,
        marginBottom: 12,
        marginHorizontal: 20,
        marginTop: 20,
        padding: 18,
    },
    listContent: {
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    metaRow: {
        alignItems: "center",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 10,
    },
    metaText: {
        color: "#475569",
        fontSize: 13,
    },
    row: {
        alignItems: "flex-start",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    safeArea: {
        backgroundColor: "#F5F3FF",
        flex: 1,
    },
    summary: {
        color: "#64748B",
        fontSize: 13,
        lineHeight: 19,
        marginTop: 10,
    },
    title: {
        color: "#111827",
        fontSize: 18,
        fontWeight: "800",
    },
    titleEyebrow: {
        color: "#6D28D9",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    unreadPill: {
        backgroundColor: "#2563EB",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    unreadPillText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "800",
    },
});

export function NotificationsInboxExample() {
    const [items, setItems] = useState(() => initialInboxItems);
    const nextNotificationRef = useRef(1);

    const unreadCount = useMemo(() => items.filter((item) => item.isUnread).length, [items]);
    const readCount = items.length - unreadCount;

    const prependNotifications = useCallback((count: number) => {
        const nextBatch = buildLiveNotifications(nextNotificationRef.current, count);
        nextNotificationRef.current += count;
        setItems((current) => [...nextBatch, ...current]);
    }, []);

    const handleViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: Array<{ item: InboxNotification }> }) => {
            const visibleIds = new Set(viewableItems.map((token) => token.item.id));
            if (visibleIds.size === 0) {
                return;
            }

            setItems((current) => {
                let didChange = false;
                const nextItems = current.map((item) => {
                    if (!item.isUnread || !visibleIds.has(item.id)) {
                        return item;
                    }

                    didChange = true;
                    return { ...item, isUnread: false };
                });

                return didChange ? nextItems : current;
            });
        },
        [],
    );

    return (
        <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
            <View style={styles.header}>
                <Text style={styles.titleEyebrow}>Unread Inbox</Text>
                <Text style={styles.title}>Notifications Inbox</Text>
                <View style={styles.metaRow}>
                    <View style={styles.unreadPill}>
                        <Text style={styles.unreadPillText}>{unreadCount} unread</Text>
                    </View>
                    <Text style={styles.metaText}>{readCount} marked read after entering view</Text>
                </View>
                <Text style={styles.summary}>
                    Notifications flip to read once they are mostly visible, and prepending new rows keeps the current
                    viewport anchored.
                </Text>
                <View style={styles.actions}>
                    <Text style={styles.actionHint}>Use this to exercise prepend stability on mobile.</Text>
                    <Pressable onPress={() => prependNotifications(3)} style={styles.button}>
                        <Text style={styles.buttonText}>Add 3 newer</Text>
                    </Pressable>
                </View>
            </View>
            <LegendList<InboxNotification>
                contentContainerStyle={styles.listContent}
                data={items}
                estimatedItemSize={108}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                onViewableItemsChanged={handleViewableItemsChanged}
                style={{ flex: 1 }}
                renderItem={({ item }) => (
                    <View style={[styles.card, item.isUnread && styles.cardUnread]}>
                        <View style={styles.row}>
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <View style={[styles.badge, item.isUnread ? styles.badgeUnread : styles.badgeRead]}>
                                <Text
                                    style={[
                                        styles.badgeText,
                                        item.isUnread ? styles.badgeTextUnread : styles.badgeTextRead,
                                    ]}
                                >
                                    {item.isUnread ? "Unread" : "Read"}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.cardBody}>{item.body}</Text>
                        <Text style={styles.cardTime}>{item.timeLabel}</Text>
                    </View>
                )}
                viewabilityConfig={{
                    id: "notifications-inbox-read",
                    itemVisiblePercentThreshold: 60,
                    minimumViewTime: 120,
                }}
            />
        </SafeAreaView>
    );
}
