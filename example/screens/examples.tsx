import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import { buildAiConversation, buildChatMessages } from "@examples/chat";
import { buildCalendarMonths } from "@examples/calendar";
import {
    buildActivityItems,
    buildFeedCards,
    buildGalleryItems,
    buildInboxNotifications,
    buildProductShelf,
} from "@examples/commerce";
import { buildDirectoryPeople, buildSectionedDirectoryRows } from "@examples/directory";
import { buildMediaRails, buildVideoFeed } from "@examples/media";

function Shell({ children }: { children: React.ReactNode }) {
    return <View style={styles.shell}>{children}</View>;
}

export function ChatExample() {
    const items = useMemo(() => buildChatMessages(), []);
    return (
        <Shell>
            <LegendList
                alignItemsAtEnd
                contentContainerStyle={styles.list}
                data={items}
                estimatedItemSize={72}
                initialScrollIndex={items.length - 1}
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                renderItem={({ item }: { item: any }) => (
                    <View style={[styles.bubble, item.sender === "self" ? styles.selfBubble : styles.otherBubble]}>
                        <Text style={styles.sender}>{item.senderName}</Text>
                        <Text style={styles.body}>{item.text}</Text>
                    </View>
                )}
            />
        </Shell>
    );
}

export function AiChatExample() {
    const conversation = useMemo(() => buildAiConversation(), []);
    const [reply, setReply] = useState("");

    useEffect(() => {
        const words = conversation.reply.split(" ");
        let index = 0;
        const timer = setInterval(() => {
            index += 1;
            setReply(words.slice(0, index).join(" "));
            if (index >= words.length) clearInterval(timer);
        }, 35);
        return () => clearInterval(timer);
    }, [conversation.reply]);

    return (
        <Shell>
            <View style={{ gap: 12, padding: 16 }}>
                <View style={[styles.bubble, styles.selfBubble, { alignSelf: "flex-end", maxWidth: "84%" }]}>
                    <Text style={styles.body}>{conversation.prompt}</Text>
                </View>
                <View style={[styles.bubble, styles.otherBubble, { maxWidth: "84%" }]}>
                    <Text style={styles.body}>{reply || "Thinking..."}</Text>
                </View>
            </View>
        </Shell>
    );
}

export function DirectoryExample() {
    const people = useMemo(() => buildDirectoryPeople(), []);
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return people.filter((person) => person.name.toLowerCase().includes(q) || person.department.toLowerCase().includes(q));
    }, [people, query]);

    return (
        <Shell>
            <TextInput
                onChangeText={setQuery}
                placeholder="Search people or team"
                style={styles.search}
                value={query}
            />
            <LegendList
                contentContainerStyle={styles.list}
                data={filtered}
                estimatedItemSize={72}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: any }) => (
                    <View style={styles.personRow}>
                        <View style={[styles.avatar, { backgroundColor: item.accent }]}>
                            <Text style={styles.avatarText}>{item.initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.personName}>{item.name}</Text>
                            <Text style={styles.personMeta}>
                                {item.title} · {item.city}
                            </Text>
                        </View>
                    </View>
                )}
            />
        </Shell>
    );
}

export function SectionedDirectoryExample() {
    const people = useMemo(() => buildDirectoryPeople(), []);
    const { rows, stickyHeaderIndices } = useMemo(() => buildSectionedDirectoryRows(people), [people]);
    return (
        <Shell>
            <LegendList
                contentContainerStyle={styles.list}
                data={rows}
                estimatedItemSize={72}
                keyExtractor={(item) => item.id}
                stickyHeaderIndices={stickyHeaderIndices}
                renderItem={({ item }: { item: any }) =>
                    item.type === "header" ? (
                        <View style={styles.headerRow}>
                            <Text style={styles.headerText}>{item.title}</Text>
                        </View>
                    ) : (
                        <View style={styles.personRow}>
                            <View style={[styles.avatar, { backgroundColor: item.accent }]}>
                                <Text style={styles.avatarText}>{item.initials}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.personName}>{item.name}</Text>
                                <Text style={styles.personMeta}>
                                    {item.title} · {item.city}
                                </Text>
                            </View>
                        </View>
                    )
                }
            />
        </Shell>
    );
}

export function ProductShelfExample() {
    const sections = useMemo(() => buildProductShelf(), []);
    return (
        <Shell>
            <LegendList
                contentContainerStyle={styles.list}
                data={sections}
                estimatedItemSize={360}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: any }) => (
                    <View style={{ marginBottom: 18 }}>
                        <Text style={styles.sectionTitle}>{item.title}</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                            {item.items.map((card: any) => (
                                <View key={card.id} style={[styles.productCard, { backgroundColor: card.color }]}>
                                    <Text style={styles.productTitle}>{card.title}</Text>
                                    <Text style={styles.productPrice}>{card.priceLabel}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            />
        </Shell>
    );
}

export function CardsFeedExample() {
    const feed = useMemo(() => buildFeedCards(), []);
    return (
        <Shell>
            <LegendList
                contentContainerStyle={styles.list}
                data={feed}
                estimatedItemSize={180}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: any }) => (
                    <View style={styles.feedCard}>
                        <Text style={styles.sectionTitle}>{item.title}</Text>
                        <Text style={styles.personMeta}>{item.author}</Text>
                        <Text style={styles.body}>{item.body}</Text>
                    </View>
                )}
            />
        </Shell>
    );
}

export function MediaRailsExample() {
    const rails = useMemo(() => buildMediaRails(), []);
    return (
        <Shell>
            <ScrollView contentContainerStyle={styles.list}>
                {rails.map((rail: any) => (
                    <View key={rail.id} style={{ marginBottom: 20 }}>
                        <Text style={styles.sectionTitle}>{rail.title}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                            {rail.posters.map((poster: any) => (
                                <View key={poster.id} style={[styles.posterCard, { backgroundColor: poster.color }]}>
                                    <Text style={styles.posterTitle}>{poster.title}</Text>
                                    <Text style={styles.posterSubtitle}>{poster.subtitle}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ))}
            </ScrollView>
        </Shell>
    );
}

export function VideoFeedExample() {
    const videos = useMemo(() => buildVideoFeed(), []);
    return (
        <Shell>
            <FlatList
                data={videos}
                keyExtractor={(item) => item.id}
                pagingEnabled
                renderItem={({ item }: { item: any }) => (
                    <View style={[styles.videoSlide, { backgroundColor: item.color }]}>
                        <Text style={styles.videoTitle}>{item.title}</Text>
                        <Text style={styles.videoBody}>{item.creator}</Text>
                    </View>
                )}
            />
        </Shell>
    );
}

export function NotificationsInboxExample() {
    const [items, setItems] = useState(() => buildInboxNotifications());
    return (
        <Shell>
            <Pressable
                onPress={() =>
                    setItems((prev) => [
                        {
                            body: "A fresh summary just landed.",
                            id: `notification-${prev.length + 1}`,
                            isUnread: true,
                            timeLabel: "Now",
                            title: "New summary",
                        },
                        ...prev,
                    ])
                }
                style={styles.button}
            >
                <Text style={styles.buttonText}>Add notification</Text>
            </Pressable>
            <LegendList
                contentContainerStyle={styles.list}
                data={items}
                estimatedItemSize={84}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: any }) => (
                    <View style={[styles.feedCard, item.isUnread ? styles.unread : null]}>
                        <Text style={styles.sectionTitle}>{item.title}</Text>
                        <Text style={styles.body}>{item.body}</Text>
                    </View>
                )}
            />
        </Shell>
    );
}

export function ActivityHistoryExample() {
    const [items, setItems] = useState(() => buildActivityItems());
    return (
        <Shell>
            <View style={{ flexDirection: "row", gap: 12, padding: 16 }}>
                <Pressable onPress={() => setItems((prev) => [...buildActivityItems(prev.length + 1, 6), ...prev])} style={styles.button}>
                    <Text style={styles.buttonText}>Load older</Text>
                </Pressable>
                <Pressable onPress={() => setItems((prev) => [...prev, ...buildActivityItems(prev.length + 1, 6)])} style={styles.button}>
                    <Text style={styles.buttonText}>Load newer</Text>
                </Pressable>
            </View>
            <LegendList
                contentContainerStyle={styles.list}
                data={items}
                estimatedItemSize={84}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: any }) => (
                    <View style={styles.feedCard}>
                        <Text style={styles.sectionTitle}>{item.summary}</Text>
                        <Text style={styles.body}>{item.timeLabel}</Text>
                        <Text style={styles.personMeta}>{item.amountLabel}</Text>
                    </View>
                )}
            />
        </Shell>
    );
}

export function GalleryGridExample() {
    const items = useMemo(() => buildGalleryItems(), []);
    const [columns, setColumns] = useState<2 | 3>(3);
    return (
        <Shell>
            <View style={{ flexDirection: "row", gap: 12, padding: 16 }}>
                <Pressable onPress={() => setColumns(2)} style={styles.button}>
                    <Text style={styles.buttonText}>2 columns</Text>
                </Pressable>
                <Pressable onPress={() => setColumns(3)} style={styles.button}>
                    <Text style={styles.buttonText}>3 columns</Text>
                </Pressable>
            </View>
            <LegendList
                columnWrapperStyle={{ gap: 12 }}
                contentContainerStyle={styles.list}
                data={items}
                estimatedItemSize={140}
                keyExtractor={(item) => item.id}
                numColumns={columns}
                renderItem={({ item }: { item: any }) => (
                    <View style={[styles.productCard, { backgroundColor: item.color, minHeight: 140 }]}>
                        <Text style={styles.productTitle}>{item.title}</Text>
                        <Text style={styles.productPrice}>{item.tone}</Text>
                    </View>
                )}
            />
        </Shell>
    );
}

export function InfiniteCalendarExample() {
    const months = useMemo(() => buildCalendarMonths(new Date(2026, 3, 1), 4), []);
    const [mode, setMode] = useState<"vertical" | "horizontal">("vertical");

    return (
        <Shell>
            <View style={{ flexDirection: "row", gap: 12, padding: 16 }}>
                <Pressable onPress={() => setMode("vertical")} style={styles.button}>
                    <Text style={styles.buttonText}>Vertical</Text>
                </Pressable>
                <Pressable onPress={() => setMode("horizontal")} style={styles.button}>
                    <Text style={styles.buttonText}>Horizontal</Text>
                </Pressable>
            </View>
            {mode === "vertical" ? (
                <LegendList
                    contentContainerStyle={styles.list}
                    data={months}
                    estimatedItemSize={320}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: { item: any }) => (
                        <View style={styles.feedCard}>
                            <Text style={styles.sectionTitle}>{item.label}</Text>
                            {item.weeks.map((week: any, weekIndex: number) => (
                                <View key={weekIndex} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                                    {week.map((day: any) => (
                                        <View
                                            key={day.dateKey}
                                            style={{
                                                backgroundColor: day.isToday ? "#111827" : "#e5e7eb",
                                                borderRadius: 10,
                                                flex: 1,
                                                opacity: day.isCurrentMonth ? 1 : 0.35,
                                                paddingVertical: 10,
                                            }}
                                        >
                                            <Text style={{ color: day.isToday ? "#fff" : "#111827", textAlign: "center" }}>
                                                {day.dayNumber}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </View>
                    )}
                />
            ) : (
                <ScrollView horizontal pagingEnabled>
                    {months.map((month: any) => (
                        <View key={month.id} style={{ minWidth: 320, padding: 16 }}>
                            <View style={styles.feedCard}>
                                <Text style={styles.sectionTitle}>{month.label}</Text>
                                {month.weeks.map((week: any, weekIndex: number) => (
                                    <View key={weekIndex} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                                        {week.map((day: any) => (
                                            <View
                                                key={day.dateKey}
                                                style={{
                                                    backgroundColor: day.isToday ? "#111827" : "#e5e7eb",
                                                    borderRadius: 10,
                                                    flex: 1,
                                                    opacity: day.isCurrentMonth ? 1 : 0.35,
                                                    paddingVertical: 10,
                                                }}
                                            >
                                                <Text style={{ color: day.isToday ? "#fff" : "#111827", textAlign: "center" }}>
                                                    {day.dayNumber}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </Shell>
    );
}

export function renderCuratedExample(slug: string) {
    switch (slug) {
        case "chat":
            return <ChatExample />;
        case "ai-chat":
            return <AiChatExample />;
        case "directory":
            return <DirectoryExample />;
        case "sectioned-directory":
            return <SectionedDirectoryExample />;
        case "product-shelf":
            return <ProductShelfExample />;
        case "cards-feed":
            return <CardsFeedExample />;
        case "media-rails":
            return <MediaRailsExample />;
        case "video-feed":
            return <VideoFeedExample />;
        case "notifications-inbox":
            return <NotificationsInboxExample />;
        case "activity-history":
            return <ActivityHistoryExample />;
        case "gallery-grid":
            return <GalleryGridExample />;
        case "infinite-calendar":
            return <InfiniteCalendarExample />;
        default:
            return (
                <Shell>
                    <Text>Unknown example: {slug}</Text>
                </Shell>
            );
    }
}

const styles = StyleSheet.create({
    avatar: { alignItems: "center", borderRadius: 999, height: 42, justifyContent: "center", width: 42 },
    avatarText: { color: "#fff", fontWeight: "800" },
    body: { color: "#111827", lineHeight: 20 },
    bubble: { borderRadius: 18, marginBottom: 12, maxWidth: "82%", padding: 14 },
    button: { backgroundColor: "#111827", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
    buttonText: { color: "#fff", fontWeight: "700" },
    feedCard: { backgroundColor: "#fff", borderRadius: 18, marginBottom: 12, padding: 16 },
    headerRow: { backgroundColor: "#e2e8f0", borderRadius: 12, marginBottom: 8, padding: 10 },
    headerText: { color: "#111827", fontWeight: "800" },
    list: { padding: 16 },
    otherBubble: { alignSelf: "flex-start", backgroundColor: "#fff" },
    personMeta: { color: "#64748b", fontSize: 13 },
    personName: { fontWeight: "800" },
    personRow: {
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 18,
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
        padding: 14,
    },
    posterCard: { borderRadius: 18, height: 180, justifyContent: "flex-end", marginRight: 12, padding: 14, width: 120 },
    posterSubtitle: { color: "#fff", fontSize: 12, opacity: 0.85 },
    posterTitle: { color: "#fff", fontWeight: "800" },
    productCard: {
        borderRadius: 18,
        flexBasis: "31%",
        justifyContent: "flex-end",
        marginBottom: 12,
        minHeight: 120,
        padding: 14,
    },
    productPrice: { color: "#111827", fontWeight: "700", marginTop: 4 },
    productTitle: { color: "#111827", fontWeight: "800" },
    search: {
        backgroundColor: "#fff",
        borderColor: "#e5e7eb",
        borderRadius: 16,
        borderWidth: 1,
        fontSize: 14,
        margin: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    selfBubble: { alignSelf: "flex-end", backgroundColor: "#dbeafe" },
    sender: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
    sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "800", marginBottom: 10 },
    shell: { backgroundColor: "#f6f3ee", flex: 1, minHeight: 0 },
    unread: { borderColor: "#c7d2fe", borderWidth: 1 },
    videoBody: { color: "#fff", fontSize: 18, opacity: 0.9 },
    videoSlide: { height: 580, justifyContent: "flex-end", padding: 24 },
    videoTitle: { color: "#fff", fontSize: 36, fontWeight: "800", marginBottom: 8 },
});
