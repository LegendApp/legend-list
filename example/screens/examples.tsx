import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    type LayoutChangeEvent,
} from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { buildAiConversation, buildChatMessages, type AiMessage, type ChatMessage } from "@examples/chat";
import { buildCalendarMonths, type CalendarMonth } from "@examples/calendar";
import {
    buildActivityItems,
    buildFeedCards,
    buildGalleryItems,
    buildInboxNotifications,
    buildProductShelf,
    type ActivityItem,
    type FeedCard,
    type GalleryItem,
    type InboxNotification,
    type ProductCard,
    type ProductShelfSection,
} from "@examples/commerce";
import {
    buildDirectoryPeople,
    buildSectionedDirectoryRows,
    type DirectoryPerson,
    type SectionedDirectoryRow,
} from "@examples/directory";
import { buildMediaRails, buildVideoFeed, type MediaRail, type VideoClip } from "@examples/media";

type ShelfRow =
    | { id: string; subtitle: string; title: string; type: "header" }
    | ({ badge: string; type: "product" } & ProductCard);

type CalendarMode = "horizontal" | "vertical";

function buildShelfRows(sections: ProductShelfSection[]) {
    const rows: ShelfRow[] = [];
    const stickyHeaderIndices: number[] = [];

    for (const section of sections) {
        stickyHeaderIndices.push(rows.length);
        rows.push({
            id: `${section.id}-header`,
            subtitle: `${section.items.length} curated picks`,
            title: section.title,
            type: "header",
        });

        for (const [index, item] of section.items.entries()) {
            rows.push({
                ...item,
                badge: index % 2 === 0 ? "Ready to ship" : "Popular",
                type: "product",
            });
        }
    }

    return { rows, stickyHeaderIndices };
}

function monthIndex(months: CalendarMonth[], activeMonthId: string) {
    const index = months.findIndex((month) => month.id === activeMonthId);
    return index === -1 ? 0 : index;
}

function Shell({ children }: { children: React.ReactNode }) {
    return <View style={styles.shell}>{children}</View>;
}

function MonthCard({ month }: { month: CalendarMonth }) {
    return (
        <View style={styles.calendarCard}>
            <Text style={styles.sectionTitle}>{month.label}</Text>
            {month.weeks.map((week, weekIndex) => (
                <View key={`${month.id}-${weekIndex}`} style={styles.weekRow}>
                    {week.map((day) => (
                        <View
                            key={day.dateKey}
                            style={[
                                styles.dayCell,
                                !day.isCurrentMonth && styles.dayCellMuted,
                                day.isToday && styles.dayCellToday,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.dayText,
                                    !day.isCurrentMonth && styles.dayTextMuted,
                                    day.isToday && styles.dayTextToday,
                                ]}
                            >
                                {day.dayNumber}
                            </Text>
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
}

export function ChatExample() {
    const items = useMemo(() => buildChatMessages(), []);

    return (
        <Shell>
            <LegendList
                alignItemsAtEnd
                contentContainerStyle={styles.list}
                data={items}
                estimatedItemSize={76}
                initialScrollIndex={items.length - 1}
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                renderItem={({ item }: { item: ChatMessage }) => (
                    <View style={[styles.bubble, item.sender === "self" ? styles.selfBubble : styles.otherBubble]}>
                        <Text style={styles.sender}>{item.senderName}</Text>
                        <Text style={styles.body}>{item.text}</Text>
                        <Text style={styles.timestamp}>{item.timestampLabel}</Text>
                    </View>
                )}
            />
        </Shell>
    );
}

export function AiChatExample() {
    const conversation = useMemo(() => buildAiConversation(), []);
    const [messages, setMessages] = useState<AiMessage[]>(conversation.initialMessages);

    useEffect(() => {
        const words = conversation.reply.split(" ");
        let index = 0;
        const timer = setInterval(() => {
            index += 1;
            const nextReply = words.slice(0, index).join(" ");
            setMessages((current) =>
                current.map((message) =>
                    message.isPlaceholder
                        ? {
                              id: "assistant-live",
                              sender: "assistant",
                              text: nextReply,
                              timestampLabel: "Now",
                          }
                        : message,
                ),
            );

            if (index >= words.length) {
                clearInterval(timer);
            }
        }, 35);

        return () => clearInterval(timer);
    }, [conversation.reply]);

    return (
        <Shell>
            <LegendList
                contentContainerStyle={styles.list}
                data={messages}
                estimatedItemSize={120}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                renderItem={({ item }: { item: AiMessage }) => (
                    <View style={[styles.bubble, item.sender === "user" ? styles.promptBubble : styles.responseBubble]}>
                        <Text style={[styles.body, item.sender === "user" && styles.promptText]}>
                            {item.text || "Thinking..."}
                        </Text>
                        <Text style={[styles.timestamp, item.sender === "user" && styles.promptText]}>{item.timestampLabel}</Text>
                    </View>
                )}
            />
        </Shell>
    );
}

export function DirectoryExample() {
    const people = useMemo(() => buildDirectoryPeople(), []);
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const lowered = query.toLowerCase();
        return people.filter(
            (person) =>
                person.name.toLowerCase().includes(lowered) ||
                person.department.toLowerCase().includes(lowered) ||
                person.city.toLowerCase().includes(lowered),
        );
    }, [people, query]);

    return (
        <Shell>
            <TextInput
                onChangeText={setQuery}
                placeholder="Search people, team, or city"
                placeholderTextColor="#94A3B8"
                style={styles.search}
                value={query}
            />
            <LegendList
                contentContainerStyle={styles.list}
                data={filtered}
                estimatedItemSize={76}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: DirectoryPerson }) => (
                    <View style={styles.personRow}>
                        <View style={[styles.avatar, { backgroundColor: item.accent }]}>
                            <Text style={styles.avatarText}>{item.initials}</Text>
                        </View>
                        <View style={styles.personCopy}>
                            <Text style={styles.personName}>{item.name}</Text>
                            <Text style={styles.personMeta}>
                                {item.title} · {item.department}
                            </Text>
                            <Text style={styles.personMeta}>{item.city}</Text>
                        </View>
                    </View>
                )}
            />
        </Shell>
    );
}

export function SectionedDirectoryExample() {
    const people = useMemo(() => buildDirectoryPeople(), []);
    const sectioned = useMemo(() => buildSectionedDirectoryRows(people), [people]);

    return (
        <Shell>
            <LegendList
                contentContainerStyle={styles.list}
                data={sectioned.rows}
                estimatedItemSize={74}
                keyExtractor={(item) => item.id}
                stickyHeaderIndices={sectioned.stickyHeaderIndices}
                renderItem={({ item }: { item: SectionedDirectoryRow }) =>
                    item.type === "header" ? (
                        <View style={styles.headerRow}>
                            <Text style={styles.headerText}>{item.title}</Text>
                        </View>
                    ) : (
                        <View style={styles.personRow}>
                            <View style={[styles.avatar, { backgroundColor: item.accent }]}>
                                <Text style={styles.avatarText}>{item.initials}</Text>
                            </View>
                            <View style={styles.personCopy}>
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
    const { rows, stickyHeaderIndices } = useMemo(() => buildShelfRows(sections), [sections]);

    return (
        <Shell>
            <LegendList
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.list}
                data={rows}
                estimatedItemSize={150}
                getEstimatedItemSize={(item) => (item.type === "header" ? 56 : 150)}
                keyExtractor={(item) => item.id}
                numColumns={2}
                overrideItemLayout={(layout, item) => {
                    if (item.type === "header") {
                        layout.span = 2;
                    }
                }}
                renderItem={({ item }: { item: ShelfRow }) =>
                    item.type === "header" ? (
                        <View style={styles.shelfHeader}>
                            <Text style={styles.sectionTitle}>{item.title}</Text>
                            <Text style={styles.personMeta}>{item.subtitle}</Text>
                        </View>
                    ) : (
                        <View style={[styles.productCard, { backgroundColor: item.color }]}>
                            <View>
                                <Text style={styles.productTitle}>{item.title}</Text>
                                <Text style={styles.productPrice}>{item.priceLabel}</Text>
                            </View>
                            <Text style={styles.productBadge}>{item.badge}</Text>
                        </View>
                    )
                }
                stickyHeaderConfig={{ offset: 0 }}
                stickyHeaderIndices={stickyHeaderIndices}
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
                estimatedItemSize={210}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: FeedCard }) => (
                    <View style={styles.feedCard}>
                        <View style={styles.feedHeader}>
                            <View style={styles.feedAvatar}>
                                <Text style={styles.feedAvatarText}>{item.author.slice(0, 1)}</Text>
                            </View>
                            <View style={styles.personCopy}>
                                <Text style={styles.personName}>{item.author}</Text>
                                <Text style={styles.personMeta}>Updated 2m ago</Text>
                            </View>
                        </View>
                        <Text style={styles.sectionTitle}>{item.title}</Text>
                        <Text style={styles.body}>{item.body}</Text>
                        <Text style={styles.personMeta}>{item.reactionCount} reactions</Text>
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
            <LegendList
                contentContainerStyle={styles.list}
                data={rails}
                estimatedItemSize={240}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: MediaRail }) => (
                    <View style={styles.railSection}>
                        <Text style={styles.sectionTitle}>{item.title}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {item.posters.map((poster) => (
                                <View key={poster.id} style={[styles.posterCard, { backgroundColor: poster.color }]}>
                                    <Text style={styles.posterTitle}>{poster.title}</Text>
                                    <Text style={styles.posterSubtitle}>{poster.subtitle}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}
            />
        </Shell>
    );
}

export function VideoFeedExample() {
    const [clips, setClips] = useState(() => buildVideoFeed());
    const [height, setHeight] = useState(0);

    const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
        setHeight(nativeEvent.layout.height);
    };

    return (
        <Shell>
            <View onLayout={onLayout} style={styles.videoShell}>
                {!!height && (
                    <LegendList
                        data={clips}
                        decelerationRate="fast"
                        estimatedItemSize={height}
                        keyExtractor={(item) => item.id}
                        onEndReached={() => {
                            setClips((current) => buildVideoFeed(current.length + 6).slice(0, current.length + 6));
                        }}
                        pagingEnabled
                        renderItem={({ item }: { item: VideoClip }) => (
                            <View style={[styles.videoSlide, { backgroundColor: item.color, height }]}>
                                <Text style={styles.videoCreator}>{item.creator}</Text>
                                <Text style={styles.videoTitle}>{item.title}</Text>
                                <Text style={styles.videoBody}>Swipe to the next clip</Text>
                            </View>
                        )}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </Shell>
    );
}

export function NotificationsInboxExample() {
    const [items, setItems] = useState(() => buildInboxNotifications());

    return (
        <Shell>
            <View style={styles.toolbar}>
                <Pressable
                    onPress={() =>
                        setItems((current) => [
                            {
                                body: "A fresh summary just landed.",
                                id: `notification-${current.length + 1}`,
                                isUnread: true,
                                timeLabel: "Now",
                                title: "New summary",
                            },
                            ...current,
                        ])
                    }
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>Add notification</Text>
                </Pressable>
            </View>
            <LegendList
                contentContainerStyle={styles.list}
                data={items}
                estimatedItemSize={84}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: InboxNotification }) => (
                    <View style={[styles.feedCard, item.isUnread && styles.unread]}>
                        <Text style={styles.sectionTitle}>{item.title}</Text>
                        <Text style={styles.body}>{item.body}</Text>
                        <Text style={styles.personMeta}>{item.timeLabel}</Text>
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
            <View style={styles.toolbar}>
                <Pressable
                    onPress={() => setItems((current) => [...buildActivityItems(current.length + 1, 6), ...current])}
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>Load older</Text>
                </Pressable>
                <Pressable
                    onPress={() => setItems((current) => [...current, ...buildActivityItems(current.length + 1, 6)])}
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>Load newer</Text>
                </Pressable>
            </View>
            <LegendList
                contentContainerStyle={styles.list}
                data={items}
                estimatedItemSize={88}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: ActivityItem }) => (
                    <View style={styles.feedCard}>
                        <Text style={styles.sectionTitle}>{item.summary}</Text>
                        <Text style={styles.personMeta}>
                            {item.timeLabel} · {item.kind === "credit" ? "Credit" : "Debit"}
                        </Text>
                        <Text style={styles.activityAmount}>{item.amountLabel}</Text>
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
            <View style={styles.toolbar}>
                <Pressable onPress={() => setColumns(2)} style={[styles.button, columns === 2 && styles.buttonActive]}>
                    <Text style={[styles.buttonText, columns === 2 && styles.buttonTextActive]}>2 columns</Text>
                </Pressable>
                <Pressable onPress={() => setColumns(3)} style={[styles.button, columns === 3 && styles.buttonActive]}>
                    <Text style={[styles.buttonText, columns === 3 && styles.buttonTextActive]}>3 columns</Text>
                </Pressable>
            </View>
            <LegendList
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.list}
                data={items}
                estimatedItemSize={152}
                keyExtractor={(item) => item.id}
                numColumns={columns}
                renderItem={({ item }: { item: GalleryItem }) => (
                    <View style={[styles.galleryCard, { backgroundColor: item.color }]}>
                        <Text style={styles.posterTitle}>{item.title}</Text>
                        <Text style={styles.posterSubtitle}>{item.tone}</Text>
                    </View>
                )}
            />
        </Shell>
    );
}

export function InfiniteCalendarExample() {
    const months = useMemo(() => buildCalendarMonths(new Date(), 10), []);
    const [mode, setMode] = useState<CalendarMode>("vertical");
    const [activeMonthId, setActiveMonthId] = useState(months[10]?.id ?? months[0]!.id);
    const listRef = useRef<LegendListRef>(null);

    useEffect(() => {
        const index = monthIndex(months, activeMonthId);
        requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0 });
        });
    }, [activeMonthId, mode, months]);

    return (
        <Shell>
            <View style={styles.toolbar}>
                <Pressable
                    onPress={() => setMode("vertical")}
                    style={[styles.button, mode === "vertical" && styles.buttonActive]}
                >
                    <Text style={[styles.buttonText, mode === "vertical" && styles.buttonTextActive]}>Vertical</Text>
                </Pressable>
                <Pressable
                    onPress={() => setMode("horizontal")}
                    style={[styles.button, mode === "horizontal" && styles.buttonActive]}
                >
                    <Text style={[styles.buttonText, mode === "horizontal" && styles.buttonTextActive]}>Horizontal</Text>
                </Pressable>
                <Pressable onPress={() => setActiveMonthId(months[10]!.id)} style={styles.button}>
                    <Text style={styles.buttonText}>Today</Text>
                </Pressable>
            </View>
            <LegendList
                contentContainerStyle={styles.list}
                data={months}
                estimatedItemSize={mode === "horizontal" ? 360 : 420}
                horizontal={mode === "horizontal"}
                keyExtractor={(item) => item.id}
                pagingEnabled={mode === "horizontal"}
                ref={listRef}
                renderItem={({ item }: { item: CalendarMonth }) => (
                    <View style={mode === "horizontal" ? styles.calendarCardHorizontal : undefined}>
                        <MonthCard month={item} />
                    </View>
                )}
                showsHorizontalScrollIndicator={false}
            />
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
    activityAmount: {
        color: "#1D4ED8",
        fontWeight: "700",
        marginTop: 8,
    },
    avatar: {
        alignItems: "center",
        borderRadius: 999,
        height: 42,
        justifyContent: "center",
        width: 42,
    },
    avatarText: {
        color: "#fff",
        fontWeight: "800",
    },
    body: {
        color: "#111827",
        lineHeight: 20,
    },
    bubble: {
        borderRadius: 18,
        marginBottom: 12,
        maxWidth: "84%",
        padding: 14,
    },
    button: {
        backgroundColor: "#FFFFFF",
        borderColor: "#CBD5E1",
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    buttonActive: {
        backgroundColor: "#111827",
        borderColor: "#111827",
    },
    buttonText: {
        color: "#111827",
        fontWeight: "700",
    },
    buttonTextActive: {
        color: "#FFFFFF",
    },
    calendarCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        marginBottom: 16,
        padding: 18,
    },
    calendarCardHorizontal: {
        marginRight: 16,
        width: 320,
    },
    columnWrapper: {
        gap: 12,
    },
    dayCell: {
        alignItems: "center",
        backgroundColor: "#E5E7EB",
        borderRadius: 10,
        flex: 1,
        justifyContent: "center",
        minHeight: 42,
    },
    dayCellMuted: {
        opacity: 0.45,
    },
    dayCellToday: {
        backgroundColor: "#111827",
    },
    dayText: {
        color: "#111827",
        fontWeight: "700",
    },
    dayTextMuted: {
        color: "#6B7280",
    },
    dayTextToday: {
        color: "#FFFFFF",
    },
    feedAvatar: {
        alignItems: "center",
        backgroundColor: "#DBEAFE",
        borderRadius: 999,
        height: 36,
        justifyContent: "center",
        width: 36,
    },
    feedAvatarText: {
        color: "#1D4ED8",
        fontWeight: "800",
    },
    feedCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        marginBottom: 12,
        padding: 16,
    },
    feedHeader: {
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
    },
    galleryCard: {
        borderRadius: 18,
        justifyContent: "flex-end",
        marginBottom: 12,
        minHeight: 140,
        padding: 14,
    },
    headerRow: {
        backgroundColor: "#E2E8F0",
        borderRadius: 12,
        marginBottom: 8,
        padding: 10,
    },
    headerText: {
        color: "#111827",
        fontWeight: "800",
    },
    list: {
        padding: 16,
    },
    otherBubble: {
        alignSelf: "flex-start",
        backgroundColor: "#FFFFFF",
    },
    personCopy: {
        flex: 1,
        gap: 2,
    },
    personMeta: {
        color: "#64748B",
        fontSize: 13,
    },
    personName: {
        color: "#111827",
        fontWeight: "800",
    },
    personRow: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
        padding: 14,
    },
    posterCard: {
        borderRadius: 18,
        height: 180,
        justifyContent: "flex-end",
        marginRight: 12,
        padding: 14,
        width: 130,
    },
    posterSubtitle: {
        color: "#FFFFFF",
        opacity: 0.85,
    },
    posterTitle: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "800",
    },
    productBadge: {
        color: "#111827",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    productCard: {
        borderRadius: 18,
        flex: 1,
        justifyContent: "space-between",
        marginBottom: 12,
        minHeight: 140,
        padding: 14,
    },
    productPrice: {
        color: "#111827",
        fontWeight: "700",
        marginTop: 4,
    },
    productTitle: {
        color: "#111827",
        fontWeight: "800",
    },
    promptBubble: {
        alignSelf: "flex-end",
        backgroundColor: "#111827",
    },
    promptText: {
        color: "#FFFFFF",
    },
    railSection: {
        marginBottom: 20,
    },
    responseBubble: {
        alignSelf: "flex-start",
        backgroundColor: "#FFFFFF",
    },
    search: {
        backgroundColor: "#FFFFFF",
        borderColor: "#E5E7EB",
        borderRadius: 16,
        borderWidth: 1,
        color: "#111827",
        fontSize: 14,
        margin: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    sectionTitle: {
        color: "#111827",
        fontSize: 18,
        fontWeight: "800",
        marginBottom: 8,
    },
    selfBubble: {
        alignSelf: "flex-end",
        backgroundColor: "#DBEAFE",
    },
    sender: {
        color: "#111827",
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 4,
    },
    shelfHeader: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        marginBottom: 12,
        padding: 14,
    },
    shell: {
        backgroundColor: "#F6F3EE",
        flex: 1,
        minHeight: 0,
    },
    timestamp: {
        color: "#64748B",
        fontSize: 12,
        marginTop: 8,
    },
    toolbar: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    unread: {
        borderColor: "#C7D2FE",
        borderWidth: 1,
    },
    videoBody: {
        color: "#FFFFFF",
        fontSize: 16,
        opacity: 0.9,
    },
    videoCreator: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 8,
        opacity: 0.85,
    },
    videoShell: {
        flex: 1,
    },
    videoSlide: {
        justifyContent: "flex-end",
        padding: 24,
    },
    videoTitle: {
        color: "#FFFFFF",
        fontSize: 32,
        fontWeight: "800",
        marginBottom: 8,
    },
    weekRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8,
    },
});
