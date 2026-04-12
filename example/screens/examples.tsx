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

import { LegendList, type LegendListRef, type LegendListRenderItemProps, useRecyclingState } from "@legendapp/list/react-native";
import {
    buildAiConversation,
    buildAssistantReply,
    buildChatMessages,
    type AiMessage,
    type ChatAttachment,
    type ChatMessage,
} from "../../examples-shared/chat";
import {
    buildCalendarMonthRange,
    buildCalendarMonths,
    getCalendarMonthId,
    shiftCalendarMonthId,
    type CalendarMonth,
} from "../../examples-shared/calendar";
import {
    appendActivityItems,
    buildActivityHistoryRows,
    buildActivityItems,
    buildFeedCards,
    buildGalleryItems,
    buildInboxNotifications,
    buildProductShelf,
    prependActivityItems,
    settlePendingActivityItems,
    type ActivityHistoryRow,
    type FeedCard,
    type GalleryItem,
    type InboxNotification,
    type ProductCard,
    type ProductShelfSection,
} from "../../examples-shared/commerce";
import {
    buildDirectoryPeople,
    buildSectionedDirectoryRows,
    type DirectoryPerson,
    type SectionedDirectoryRow,
} from "../../examples-shared/directory";
import { buildMediaRails, buildVideoFeed, type MediaRail, type VideoClip } from "../../examples-shared/media";

type ShelfRow =
    | { id: string; subtitle: string; title: string; type: "header" }
    | ({ badge: string; type: "product" } & ProductCard);

type CalendarMode = "horizontal" | "vertical";
const CALENDAR_INITIAL_SPAN = 12;
const CALENDAR_PAGE_SIZE = 6;
const AI_SUGGESTIONS = [
    {
        label: "Stable anchors",
        prompt: "Summarize why stable anchors matter for chat UIs.",
    },
    {
        label: "Mixed heights",
        prompt: "Explain how mixed row heights affect virtualization.",
    },
    {
        label: "Visible content",
        prompt: "Describe when to use maintainVisibleContentPosition.",
    },
] as const;

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

function prependCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[0]!.id, -count);
    return [...buildCalendarMonthRange(startMonthId, count, today), ...months];
}

function appendCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[months.length - 1]!.id, 1);
    return [...months, ...buildCalendarMonthRange(startMonthId, count, today)];
}

function Shell({ children }: { children: React.ReactNode }) {
    return <View style={styles.shell}>{children}</View>;
}

function ChatAttachmentCard({ attachment, dark }: { attachment: ChatAttachment; dark?: boolean }) {
    return (
        <View
            style={[
                styles.chatAttachment,
                {
                    backgroundColor: attachment.accent,
                    height: attachment.height,
                },
            ]}
        >
            <View style={styles.chatAttachmentScrim} />
            <Text style={[styles.chatAttachmentLabel, dark && styles.chatAttachmentLabelDark]}>{attachment.label}</Text>
            <Text style={[styles.chatAttachmentSubtitle, dark && styles.chatAttachmentSubtitleDark]}>
                {attachment.subtitle}
            </Text>
        </View>
    );
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
    const [messages, setMessages] = useState<ChatMessage[]>(() => buildChatMessages());
    const [input, setInput] = useState("");
    const nextIdRef = useRef(messages.length);
    const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearReplyTimer = () => {
        if (replyTimerRef.current) {
            clearTimeout(replyTimerRef.current);
            replyTimerRef.current = null;
        }
    };

    const sendMessage = (draft: string) => {
        const trimmedDraft = draft.trim();
        if (!trimmedDraft) {
            return;
        }

        clearReplyTimer();

        const baseId = nextIdRef.current++;
        const timeStamp = new Date();
        const timeLabel = timeStamp.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });

        setMessages((current) => [
            ...current,
            {
                id: `message-${baseId}`,
                sender: "self",
                senderName: "You",
                text: trimmedDraft,
                timestampLabel: timeLabel,
            },
        ]);
        setInput("");

        replyTimerRef.current = setTimeout(() => {
            const replyId = nextIdRef.current++;
            setMessages((current) => [
                ...current,
                {
                    attachment:
                        replyId % 4 === 0
                            ? {
                                  accent: "#38BDF8",
                                  height: 136,
                                  label: "Preview",
                                  subtitle: "Latest thread capture",
                              }
                            : undefined,
                    id: `message-${replyId}`,
                    sender: "other",
                    senderName: "Nina",
                    text:
                        trimmedDraft.length < 36
                            ? `Received: ${trimmedDraft}\n\nI added it to the running thread so we can watch the anchored viewport hold while the newest rows arrive.`
                            : `Received: ${trimmedDraft}\n\nThis is the kind of longer follow-up that makes the example more credible, because it changes the row height enough to show whether the list keeps the bottom edge stable while the conversation continues.`,
                    timestampLabel: "Now",
                },
            ]);
            replyTimerRef.current = null;
        }, 300);
    };

    useEffect(() => clearReplyTimer, []);

    return (
        <Shell>
            <LegendList
                alignItemsAtEnd
                contentContainerStyle={styles.list}
                data={messages}
                estimatedItemSize={168}
                initialScrollIndex={messages.length - 1}
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                renderItem={({ item }: { item: ChatMessage }) => (
                    <View style={[styles.bubble, item.sender === "self" ? styles.selfBubble : styles.otherBubble]}>
                        <Text style={styles.sender}>{item.senderName}</Text>
                        {item.attachment ? <ChatAttachmentCard attachment={item.attachment} /> : null}
                        <Text style={styles.body}>{item.text}</Text>
                        <Text style={styles.timestamp}>{item.timestampLabel}</Text>
                    </View>
                )}
            />
            <View style={styles.composerRow}>
                <TextInput
                    onChangeText={setInput}
                    placeholder="Type a message"
                    placeholderTextColor="#94A3B8"
                    style={styles.composerInput}
                    value={input}
                />
                <Pressable onPress={() => sendMessage(input)} style={[styles.button, styles.buttonActive]}>
                    <Text style={[styles.buttonText, styles.buttonTextActive]}>Send</Text>
                </Pressable>
            </View>
        </Shell>
    );
}

export function AiChatExample() {
    const conversation = useMemo(() => buildAiConversation(), []);
    const [messages, setMessages] = useState<AiMessage[]>(() => conversation.initialMessages);
    const [input, setInput] = useState("");
    const nextIdRef = useRef(conversation.initialMessages.length);
    const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopStreaming = () => {
        if (streamTimerRef.current) {
            clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
        }
    };

    const sendPrompt = (prompt: string) => {
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt) {
            return;
        }

        stopStreaming();
        const words = buildAssistantReply(trimmedPrompt, nextIdRef.current).split(/(\s+)/);
        const placeholderId = `assistant-${nextIdRef.current++}`;

        setMessages((current) => [
            ...current,
            {
                id: `user-${nextIdRef.current++}`,
                sender: "user",
                text: trimmedPrompt,
                timestampLabel: "Now",
            },
            {
                id: placeholderId,
                sender: "assistant",
                text: "",
                timestampLabel: "Now",
                isPlaceholder: true,
            },
        ]);
        setInput("");

        let index = 0;
        streamTimerRef.current = setInterval(() => {
            index += 1;
            const nextReply = words.slice(0, index).join("");
            setMessages((current) =>
                current.map((message) =>
                    message.id === placeholderId
                        ? {
                              ...message,
                              isPlaceholder: index < words.length,
                              text: nextReply,
                          }
                        : message,
                ),
            );

            if (index >= words.length) {
                stopStreaming();
            }
        }, 40);
    };

    useEffect(() => stopStreaming, []);

    return (
        <Shell>
            <View style={styles.toolbar}>
                {AI_SUGGESTIONS.map((suggestion) => (
                    <Pressable
                        key={suggestion.label}
                        onPress={() => sendPrompt(suggestion.prompt)}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.secondaryButtonText}>{suggestion.label}</Text>
                    </Pressable>
                ))}
            </View>
            <LegendList
                contentContainerStyle={styles.list}
                data={messages}
                estimatedItemSize={520}
                initialScrollIndex={messages.length - 1}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                renderItem={({ item }: { item: AiMessage }) => (
                    <View style={[styles.bubble, item.sender === "user" ? styles.promptBubble : styles.responseBubble]}>
                        <Text style={[styles.body, item.sender === "user" && styles.promptText]}>
                            {item.text || "Thinking..."}
                        </Text>
                        <Text style={[styles.timestamp, item.sender === "user" && styles.promptText]}>
                            {item.isPlaceholder ? "Streaming..." : item.timestampLabel}
                        </Text>
                    </View>
                )}
            />
            <View style={styles.composerRow}>
                <TextInput
                    onChangeText={setInput}
                    placeholder="Ask about list behavior"
                    placeholderTextColor="#94A3B8"
                    style={styles.composerInput}
                    value={input}
                />
                <Pressable onPress={() => sendPrompt(input)} style={[styles.button, styles.buttonActive]}>
                    <Text style={[styles.buttonText, styles.buttonTextActive]}>Send</Text>
                </Pressable>
            </View>
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

function getFeedPollVotes(optionId: string, selectedOptionId: string | null, votes: number) {
    return votes + (selectedOptionId === optionId ? 1 : 0);
}

function FeedCardItem({ item, extraData }: LegendListRenderItemProps<FeedCard>) {
    const [isExpandedValue, setExpanded] = extraData?.recycleState ? useRecyclingState(() => false) : useState(false);
    const [isLikedValue, setLiked] = extraData?.recycleState ? useRecyclingState(() => false) : useState(false);
    const [selectedOptionIdValue, setSelectedOptionId] = extraData?.recycleState
        ? useRecyclingState<string | null>(() => null)
        : useState<string | null>(null);

    const isExpanded = Boolean(isExpandedValue);
    const isLiked = Boolean(isLikedValue);
    const selectedOptionId = selectedOptionIdValue ?? null;

    return (
        <View style={styles.feedCard}>
            <View style={styles.feedHeader}>
                <View style={[styles.feedAvatar, { backgroundColor: item.accentColor }]}>
                    <Text style={styles.feedAvatarText}>{item.author.slice(0, 1)}</Text>
                </View>
                <View style={styles.personCopy}>
                    <Text style={styles.personName}>{item.author}</Text>
                    <Text style={styles.personMeta}>{item.timestampLabel}</Text>
                </View>
                <View style={styles.feedKindBadge}>
                    <Text style={styles.feedKindBadgeText}>{item.kind}</Text>
                </View>
            </View>

            {item.kind === "story" ? (
                <>
                    <View style={styles.feedCategoryChip}>
                        <Text style={styles.feedCategoryChipText}>{item.categoryLabel}</Text>
                    </View>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                </>
            ) : null}

            {item.kind === "photo" ? (
                <>
                    <View style={[styles.feedMediaCard, { backgroundColor: item.accentColor, height: item.mediaHeight }]}>
                        <Text style={styles.feedMediaLabel}>{item.mediaLabel}</Text>
                        <Text style={styles.feedMediaTitle}>{item.title}</Text>
                        <Text style={styles.feedMediaSubtitle}>{item.mediaSubtitle}</Text>
                    </View>
                    <Text style={styles.body}>{item.body}</Text>
                </>
            ) : null}

            {item.kind === "poll" ? (
                <>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                    <View style={styles.feedPollList}>
                        {item.pollOptions.map((option) => {
                            const isSelected = selectedOptionId === option.id;
                            return (
                                <Pressable
                                    key={option.id}
                                    onPress={() => {
                                        if (!isSelected) {
                                            setSelectedOptionId(option.id);
                                        }
                                    }}
                                    style={[styles.feedPollOption, isSelected && styles.feedPollOptionSelected]}
                                >
                                    <Text style={styles.feedPollOptionLabel}>{option.label}</Text>
                                    <Text style={styles.feedPollOptionVotes}>{getFeedPollVotes(option.id, selectedOptionId, option.votes)} votes</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </>
            ) : null}

            {item.kind === "quote" ? (
                <>
                    <View style={[styles.feedQuoteCard, { borderLeftColor: item.accentColor }]}>
                        <Text style={styles.feedQuoteText}>"{item.quote}"</Text>
                        <Text style={styles.personMeta}>{item.source}</Text>
                    </View>
                    <Text style={styles.body}>{item.body}</Text>
                </>
            ) : null}

            {item.kind === "event" ? (
                <>
                    <View style={styles.feedEventBadgeRow}>
                        <View style={styles.feedEventBadge}>
                            <Text style={styles.feedEventBadgeText}>{item.highlight}</Text>
                        </View>
                        <View style={styles.feedCategoryChip}>
                            <Text style={styles.feedCategoryChipText}>{item.attendeesLabel}</Text>
                        </View>
                    </View>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                    <Text style={styles.personMeta}>{item.location}</Text>
                </>
            ) : null}

            {item.kind !== "poll" && isExpanded ? <Text style={styles.feedExpandedBody}>{item.expandedBody}</Text> : null}

            <View style={styles.feedActionRow}>
                <Pressable onPress={() => setLiked((current) => !current)} style={[styles.button, isLiked && styles.buttonActive]}>
                    <Text style={[styles.buttonText, isLiked && styles.buttonTextActive]}>
                        {isLiked ? "Liked" : "Like"} · {item.reactionCount + (isLiked ? 1 : 0)}
                    </Text>
                </Pressable>
                <Text style={styles.personMeta}>{item.commentCount} comments</Text>
                {item.kind !== "poll" ? (
                    <Pressable onPress={() => setExpanded((current) => !current)} style={styles.button}>
                        <Text style={styles.buttonText}>{isExpanded ? "Collapse" : "Expand"}</Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

export function CardsFeedExample() {
    const feed = useMemo(() => buildFeedCards(), []);

    return (
        <Shell>
            <LegendList
                contentContainerStyle={styles.list}
                data={feed}
                estimatedItemSize={286}
                extraData={{ recycleState: true }}
                keyExtractor={(item) => item.id}
                renderItem={FeedCardItem}
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
                        <LegendList
                            contentContainerStyle={styles.railContent}
                            data={item.posters}
                            estimatedItemSize={152}
                            horizontal
                            keyExtractor={(poster) => poster.id}
                            renderItem={({ item: poster }) => (
                                <View key={poster.id} style={[styles.posterCard, { backgroundColor: poster.color }]}>
                                    <Text style={styles.posterTitle}>{poster.title}</Text>
                                    <Text style={styles.posterSubtitle}>{poster.subtitle}</Text>
                                </View>
                            )}
                            showsHorizontalScrollIndicator={false}
                        />
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
                            setClips((current) => buildVideoFeed(current.length + 12).slice(0, current.length + 12));
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
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const [isLive, setIsLive] = useState(true);
    const [isMaintainingAtEnd, setIsMaintainingAtEnd] = useState(true);
    const listRef = useRef<LegendListRef>(null);
    const timeline = useMemo(() => buildActivityHistoryRows(items), [items]);
    const pendingCount = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);

    const updateMaintainAtEndState = React.useCallback(() => {
        const next = listRef.current?.getState().isAtEnd;
        if (next === undefined) {
            return;
        }
        setIsMaintainingAtEnd((current) => (current === next ? current : next));
    }, []);

    useEffect(() => {
        if (!isLive) {
            return;
        }

        const appendTimer = setInterval(() => {
            setItems((current) => appendActivityItems(current, 1));
        }, 2400);
        const settleTimer = setInterval(() => {
            setItems((current) => settlePendingActivityItems(current, 1));
        }, 1600);

        return () => {
            clearInterval(appendTimer);
            clearInterval(settleTimer);
        };
    }, [isLive]);

    useEffect(() => {
        updateMaintainAtEndState();
    }, [items, updateMaintainAtEndState]);

    return (
        <Shell>
            <View style={styles.toolbar}>
                <Pressable
                    onPress={() => setIsLive((current) => !current)}
                    style={[styles.button, isLive && styles.buttonActive]}
                >
                    <Text style={[styles.buttonText, isLive && styles.buttonTextActive]}>
                        {isLive ? "Pause live" : "Resume live"}
                    </Text>
                </Pressable>
                <Text style={styles.activityLiveSummary}>
                    {isLive ? "Posting every 2.4s" : "Live feed paused"} · {pendingCount} pending ·{" "}
                    {isMaintainingAtEnd ? "Maintaining at end" : "Not maintaining at end"} · Scroll up to load older
                </Text>
            </View>
            <LegendList
                contentContainerStyle={styles.list}
                data={timeline.rows}
                estimatedItemSize={118}
                initialScrollIndex={timeline.rows.length - 1}
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                onLoad={updateMaintainAtEndState}
                onScroll={updateMaintainAtEndState}
                onStartReached={() => setItems((current) => prependActivityItems(current, 12))}
                onStartReachedThreshold={0.2}
                ref={listRef}
                renderItem={({ item }: { item: ActivityHistoryRow }) =>
                    item.type === "header" ? (
                        <View style={styles.activityHeader}>
                            <Text style={styles.activityHeaderTitle}>{item.title}</Text>
                            <Text style={styles.activityHeaderMeta}>
                                {item.totalLabel}
                                {item.pendingCount > 0 ? ` · ${item.pendingCount} pending` : ""}
                            </Text>
                        </View>
                    ) : (
                        <Pressable
                            onPress={() =>
                                setExpandedIds((current) =>
                                    current.includes(item.item.id)
                                        ? current.filter((value) => value !== item.item.id)
                                        : [...current, item.item.id],
                                )
                            }
                            style={[
                                styles.feedCard,
                                item.item.status === "pending"
                                    ? styles.activityPending
                                    : item.item.status === "reversed"
                                      ? styles.activityReversed
                                      : item.item.kind === "credit"
                                        ? styles.activityCreditCard
                                        : undefined,
                            ]}
                        >
                            <View style={styles.activityRowHeader}>
                                <View style={styles.activityRowCopy}>
                                    <Text style={styles.sectionTitle}>{item.item.summary}</Text>
                                    <Text style={styles.personMeta}>
                                        {item.item.merchant} · {item.item.categoryLabel} · {item.item.timeLabel}
                                    </Text>
                                </View>
                                <Text style={[styles.activityAmount, item.item.kind === "credit" ? styles.creditText : styles.debitText]}>
                                    {item.item.amountLabel}
                                </Text>
                            </View>
                            <View style={styles.activityBadgeRow}>
                                <View
                                    style={[
                                        styles.activityStatusBadge,
                                        item.item.status === "pending"
                                            ? styles.activityStatusPending
                                            : item.item.status === "reversed"
                                              ? styles.activityStatusReversed
                                              : styles.activityStatusPosted,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.activityStatusText,
                                            item.item.status === "pending"
                                                ? styles.activityStatusPendingText
                                                : item.item.status === "reversed"
                                                  ? styles.activityStatusReversedText
                                                  : styles.activityStatusPostedText,
                                        ]}
                                    >
                                        {item.item.status}
                                    </Text>
                                </View>
                                <Text style={styles.personMeta}>
                                    {expandedIds.includes(item.item.id) ? "Hide details" : "Show details"}
                                </Text>
                            </View>
                            {expandedIds.includes(item.item.id) ? (
                                <View style={styles.activityDetails}>
                                    {item.item.detailLines.map((line, index) => (
                                        <Text key={`${item.item.id}-${index}`} style={styles.activityDetailText}>
                                            {line}
                                        </Text>
                                    ))}
                                </View>
                            ) : null}
                        </Pressable>
                    )
                }
                stickyHeaderIndices={timeline.stickyHeaderIndices}
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
    const today = useMemo(() => new Date(), []);
    const todayMonthId = useMemo(() => getCalendarMonthId(today), [today]);
    const [months, setMonths] = useState(() => buildCalendarMonths(today, CALENDAR_INITIAL_SPAN, today));
    const [mode, setMode] = useState<CalendarMode>("vertical");
    const [activeMonthId, setActiveMonthId] = useState(todayMonthId);
    const listRef = useRef<LegendListRef>(null);
    const pendingScrollTargetRef = useRef<string | null>(null);
    const activeIndex = monthIndex(months, activeMonthId);

    useEffect(() => {
        pendingScrollTargetRef.current = activeMonthId;
    }, [mode]);

    useEffect(() => {
        const pendingTarget = pendingScrollTargetRef.current;
        if (!pendingTarget) {
            return;
        }

        const index = monthIndex(months, pendingTarget);
        const frame = requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0 });
            pendingScrollTargetRef.current = null;
        });

        return () => cancelAnimationFrame(frame);
    }, [activeMonthId, mode, months]);

    const ensureMonthVisible = (targetMonthId: string) => {
        pendingScrollTargetRef.current = targetMonthId;
        setMonths((current) => {
            let next = current;

            while (targetMonthId < next[0]!.id) {
                next = prependCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
            }

            while (targetMonthId > next[next.length - 1]!.id) {
                next = appendCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
            }

            return next;
        });
        setActiveMonthId(targetMonthId);
    };

    const loadOlder = () => {
        setMonths((current) => prependCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    };

    const loadNewer = () => {
        setMonths((current) => appendCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    };

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
                <Pressable onPress={() => ensureMonthVisible(shiftCalendarMonthId(activeMonthId, -1))} style={styles.button}>
                    <Text style={styles.buttonText}>Prev</Text>
                </Pressable>
                <Pressable onPress={() => ensureMonthVisible(todayMonthId)} style={styles.button}>
                    <Text style={styles.buttonText}>Today</Text>
                </Pressable>
                <Pressable onPress={() => ensureMonthVisible(shiftCalendarMonthId(activeMonthId, 1))} style={styles.button}>
                    <Text style={styles.buttonText}>Next</Text>
                </Pressable>
            </View>
            <LegendList
                contentContainerStyle={styles.list}
                data={months}
                estimatedItemSize={mode === "horizontal" ? 360 : 420}
                horizontal={mode === "horizontal"}
                initialScrollIndex={activeIndex}
                key={mode}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                onEndReached={loadNewer}
                onEndReachedThreshold={0.25}
                onStartReached={loadOlder}
                onStartReachedThreshold={0.25}
                onViewableItemsChanged={({ viewableItems }) => {
                    const nextActive = viewableItems[0]?.item as CalendarMonth | undefined;
                    if (nextActive?.id && pendingScrollTargetRef.current == null) {
                        setActiveMonthId((current) => (current === nextActive.id ? current : nextActive.id));
                    }
                }}
                pagingEnabled={false}
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
        fontWeight: "700",
    },
    activityBadgeRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
        marginTop: 10,
    },
    activityCreditCard: {
        borderColor: "#86EFAC",
        borderWidth: 1,
    },
    activityDetailText: {
        color: "#334155",
        lineHeight: 20,
    },
    activityDetails: {
        gap: 8,
        marginTop: 12,
    },
    activityHeader: {
        backgroundColor: "#E2E8F0",
        borderColor: "#CBD5E1",
        borderRadius: 0,
        borderWidth: 1,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    activityHeaderMeta: {
        color: "#475569",
        fontSize: 12,
        marginTop: 4,
    },
    activityHeaderTitle: {
        color: "#111827",
        fontSize: 15,
        fontWeight: "800",
    },
    activityLiveSummary: {
        color: "#64748B",
        flexShrink: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    activityPending: {
        borderColor: "#F59E0B",
        borderWidth: 1,
    },
    activityReversed: {
        borderColor: "#FCA5A5",
        borderWidth: 1,
    },
    activityRowCopy: {
        flex: 1,
        marginRight: 12,
    },
    activityRowHeader: {
        alignItems: "flex-start",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    activityStatusBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    activityStatusPending: {
        backgroundColor: "#FEF3C7",
    },
    activityStatusPendingText: {
        color: "#92400E",
    },
    activityStatusPosted: {
        backgroundColor: "#DCFCE7",
    },
    activityStatusPostedText: {
        color: "#166534",
    },
    activityStatusReversed: {
        backgroundColor: "#FEE2E2",
    },
    activityStatusReversedText: {
        color: "#991B1B",
    },
    activityStatusText: {
        fontSize: 12,
        fontWeight: "700",
        textTransform: "capitalize",
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
    chatAttachment: {
        borderRadius: 16,
        justifyContent: "flex-end",
        marginBottom: 10,
        overflow: "hidden",
        padding: 12,
        width: 220,
    },
    chatAttachmentLabel: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    chatAttachmentLabelDark: {
        color: "#E0F2FE",
    },
    chatAttachmentScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(15, 23, 42, 0.14)",
    },
    chatAttachmentSubtitle: {
        color: "#FFFFFF",
        fontSize: 20,
        fontWeight: "800",
        marginTop: 6,
    },
    chatAttachmentSubtitleDark: {
        color: "#F8FAFC",
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
    composerInput: {
        backgroundColor: "#FFFFFF",
        borderColor: "#CBD5E1",
        borderRadius: 16,
        borderWidth: 1,
        color: "#111827",
        flex: 1,
        minHeight: 44,
        paddingHorizontal: 14,
    },
    composerRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 16,
        paddingBottom: 16,
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
    debitText: {
        color: "#9A3412",
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
    feedActionRow: {
        alignItems: "center",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 16,
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
    feedCategoryChip: {
        alignSelf: "flex-start",
        backgroundColor: "#F8FAFC",
        borderRadius: 999,
        marginBottom: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    feedCategoryChipText: {
        color: "#334155",
        fontSize: 12,
        fontWeight: "700",
    },
    feedEventBadge: {
        backgroundColor: "#DCFCE7",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    feedEventBadgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
    },
    feedEventBadgeText: {
        color: "#166534",
        fontSize: 12,
        fontWeight: "700",
    },
    feedExpandedBody: {
        color: "#334155",
        lineHeight: 22,
        marginTop: 14,
    },
    feedKindBadge: {
        backgroundColor: "#EEF2FF",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    feedKindBadgeText: {
        color: "#4338CA",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "capitalize",
    },
    feedMediaCard: {
        borderRadius: 18,
        justifyContent: "flex-end",
        marginBottom: 12,
        padding: 14,
    },
    feedMediaLabel: {
        color: "#0F172A",
        fontSize: 12,
        fontWeight: "800",
        opacity: 0.72,
        textTransform: "uppercase",
    },
    feedMediaSubtitle: {
        color: "#0F172A",
        marginTop: 6,
        maxWidth: 260,
        opacity: 0.78,
    },
    feedMediaTitle: {
        color: "#0F172A",
        fontSize: 20,
        fontWeight: "800",
        marginTop: 6,
    },
    feedPollList: {
        gap: 10,
        marginTop: 14,
    },
    feedPollOption: {
        backgroundColor: "#F8FAFC",
        borderColor: "#E2E8F0",
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
    },
    feedPollOptionLabel: {
        color: "#0F172A",
        fontWeight: "700",
    },
    feedPollOptionSelected: {
        backgroundColor: "#DBEAFE",
        borderColor: "#60A5FA",
    },
    feedPollOptionVotes: {
        color: "#64748B",
        fontSize: 12,
        marginTop: 4,
    },
    feedQuoteCard: {
        backgroundColor: "#F8FAFC",
        borderLeftWidth: 4,
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
    },
    feedQuoteText: {
        color: "#0F172A",
        fontSize: 20,
        fontWeight: "700",
        lineHeight: 30,
        marginBottom: 10,
    },
    creditText: {
        color: "#0F766E",
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
        borderRadius: 0,
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
    railContent: {
        paddingRight: 16,
    },
    responseBubble: {
        alignSelf: "flex-start",
        backgroundColor: "#FFFFFF",
    },
    secondaryButton: {
        backgroundColor: "#E2E8F0",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    secondaryButtonText: {
        color: "#0F172A",
        fontSize: 12,
        fontWeight: "700",
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
        borderRadius: 0,
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
