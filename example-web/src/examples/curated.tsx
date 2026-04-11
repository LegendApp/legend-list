import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import type { ExampleSlug } from "@examples/types";
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
    buildAiConversation,
    buildAssistantReply,
    buildChatMessages,
    type AiMessage,
    type ChatAttachment,
    type ChatMessage,
} from "@examples/chat";
import {
    buildCalendarMonthRange,
    buildCalendarMonths,
    getCalendarMonthId,
    shiftCalendarMonthId,
    type CalendarMonth,
} from "@examples/calendar";
import {
    buildDirectoryPeople,
    buildSectionedDirectoryRows,
    type DirectoryPerson,
    type SectionedDirectoryRow,
} from "@examples/directory";
import { buildMediaRails, buildVideoFeed, type MediaPoster, type MediaRail, type VideoClip } from "@examples/media";

const directoryPeople = buildDirectoryPeople();
const sectionedDirectory = buildSectionedDirectoryRows(directoryPeople);
const productShelfSections = buildProductShelf();
const feedCards = buildFeedCards();
const mediaRails = buildMediaRails();
const videoClips = buildVideoFeed();
const initialInboxItems = buildInboxNotifications();
const galleryItems = buildGalleryItems();
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

type ShelfRow =
    | { id: string; subtitle: string; title: string; type: "header" }
    | ({ badge: string; type: "product" } & ProductCard);

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 16, minHeight: 0, minWidth: 0 }}>
            <h1 style={{ fontSize: 34, margin: 0 }}>{title}</h1>
            <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0 }}>{children}</div>
        </div>
    );
}

function cardStyle(color = "#fff"): React.CSSProperties {
    return {
        background: color,
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        marginBottom: 12,
        padding: 16,
    };
}

function buttonStyle(active = false): React.CSSProperties {
    return {
        background: active ? "#111827" : "#fff",
        border: "1px solid #d1d5db",
        borderRadius: 999,
        color: active ? "#fff" : "#111827",
        cursor: "pointer",
        fontWeight: 700,
        padding: "10px 14px",
    };
}

const listViewportStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
};

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

function ChatAttachmentCard({ attachment }: { attachment: ChatAttachment }) {
    return (
        <div
            style={{
                alignItems: "flex-start",
                background: attachment.accent,
                borderRadius: 16,
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                height: attachment.height,
                justifyContent: "flex-end",
                marginBottom: 10,
                overflow: "hidden",
                padding: 12,
                width: 220,
            }}
        >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, opacity: 0.88, textTransform: "uppercase" }}>
                {attachment.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{attachment.subtitle}</div>
        </div>
    );
}

function ChatExample() {
    const items = React.useMemo(() => buildChatMessages(), []);
    return (
        <Shell title="Chat">
            <LegendList
                alignItemsAtEnd
                contentContainerStyle={{ padding: 8 }}
                data={items}
                estimatedItemSize={168}
                initialScrollIndex={items.length - 1}
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                renderItem={({ item }: { item: ChatMessage }) => (
                    <div
                        style={{
                            ...cardStyle(item.sender === "self" ? "#DBEAFE" : "#FFFFFF"),
                            maxWidth: "82%",
                            width: "fit-content",
                            marginLeft: item.sender === "self" ? "auto" : 0,
                        }}
                    >
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{item.senderName}</div>
                        {item.attachment ? <ChatAttachmentCard attachment={item.attachment} /> : null}
                        <div style={{ whiteSpace: "pre-wrap" }}>{item.text}</div>
                        <div style={{ color: "#64748b", fontSize: 11, marginTop: 8 }}>{item.timestampLabel}</div>
                    </div>
                )}
                style={listViewportStyle}
            />
        </Shell>
    );
}

function AiChatExample() {
    const conversation = React.useMemo(() => buildAiConversation(), []);
    const [messages, setMessages] = React.useState<AiMessage[]>(() => conversation.initialMessages);
    const [input, setInput] = React.useState("");
    const nextIdRef = React.useRef(conversation.initialMessages.length);
    const streamTimerRef = React.useRef<number | null>(null);

    const stopStreaming = React.useCallback(() => {
        if (streamTimerRef.current !== null) {
            window.clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
        }
    }, []);

    const sendPrompt = React.useCallback(
        (nextPrompt: string) => {
            const trimmedPrompt = nextPrompt.trim();
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
            streamTimerRef.current = window.setInterval(() => {
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
        },
        [stopStreaming],
    );

    React.useEffect(() => stopStreaming, [stopStreaming]);

    return (
        <Shell title="AI Chat">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {AI_SUGGESTIONS.map((suggestion) => (
                        <button
                            key={suggestion.label}
                            onClick={() => sendPrompt(suggestion.prompt)}
                            style={buttonStyle()}
                            type="button"
                        >
                            {suggestion.label}
                        </button>
                    ))}
                </div>
                <LegendList
                    contentContainerStyle={{ padding: 8 }}
                    data={messages}
                    estimatedItemSize={520}
                    initialScrollIndex={messages.length - 1}
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition
                    renderItem={({ item }: { item: AiMessage }) => (
                        <div
                            style={{
                                ...cardStyle(item.sender === "user" ? "#111827" : "#FFFFFF"),
                                color: item.sender === "user" ? "#FFFFFF" : "#111827",
                                maxWidth: "82%",
                                width: "fit-content",
                                marginLeft: item.sender === "user" ? "auto" : 0,
                            }}
                        >
                            <div style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{item.text || "Thinking..."}</div>
                            <div style={{ fontSize: 12, marginTop: 8, opacity: 0.75 }}>
                                {item.isPlaceholder ? "Streaming..." : item.timestampLabel}
                            </div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <input
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Ask about list behavior"
                        style={{
                            background: "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: 16,
                            flex: 1,
                            padding: "12px 14px",
                        }}
                        value={input}
                    />
                    <button
                        onClick={() => sendPrompt(input)}
                        style={buttonStyle(true)}
                        type="button"
                    >
                        Send
                    </button>
                </div>
            </div>
        </Shell>
    );
}

function DirectoryExample() {
    const [query, setQuery] = React.useState("");
    const filtered = React.useMemo(() => {
        const q = query.toLowerCase();
        return directoryPeople.filter(
            (person) => person.name.toLowerCase().includes(q) || person.department.toLowerCase().includes(q),
        );
    }, [query]);

    return (
        <Shell title="Directory">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <input
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people or team..."
                    style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        marginBottom: 12,
                        padding: "12px 14px",
                    }}
                    value={query}
                />
                <LegendList
                    data={filtered}
                    estimatedItemSize={72}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: { item: DirectoryPerson }) => (
                        <div style={{ ...cardStyle(), alignItems: "center", display: "flex", gap: 12 }}>
                            <div
                                style={{
                                    alignItems: "center",
                                    background: item.accent,
                                    borderRadius: 999,
                                    color: "#fff",
                                    display: "flex",
                                    fontWeight: 800,
                                    height: 42,
                                    justifyContent: "center",
                                    width: 42,
                                }}
                            >
                                {item.initials}
                            </div>
                            <div>
                                <div style={{ fontWeight: 800 }}>{item.name}</div>
                                <div style={{ color: "#64748b" }}>
                                    {item.title} · {item.department} · {item.city}
                                </div>
                            </div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}

function SectionedDirectoryExample() {
    return (
        <Shell title="Sectioned Directory">
            <LegendList
                data={sectionedDirectory.rows}
                estimatedItemSize={62}
                keyExtractor={(item) => item.id}
                stickyHeaderIndices={sectionedDirectory.stickyHeaderIndices}
                renderItem={({ item }: { item: SectionedDirectoryRow }) =>
                    item.type === "header" ? (
                        <div
                            style={{
                                ...cardStyle("#E2E8F0"),
                                fontWeight: 800,
                                marginBottom: 8,
                                padding: "10px 12px",
                            }}
                        >
                            {item.title}
                        </div>
                    ) : (
                        <div style={{ ...cardStyle(), alignItems: "center", display: "flex", gap: 12 }}>
                            <div
                                style={{
                                    alignItems: "center",
                                    background: item.accent,
                                    borderRadius: 999,
                                    color: "#fff",
                                    display: "flex",
                                    fontWeight: 800,
                                    height: 42,
                                    justifyContent: "center",
                                    width: 42,
                                }}
                            >
                                {item.initials}
                            </div>
                            <div>
                                <div style={{ fontWeight: 800 }}>{item.name}</div>
                                <div style={{ color: "#64748b" }}>
                                    {item.title} · {item.city}
                                </div>
                            </div>
                        </div>
                    )
                }
                style={listViewportStyle}
            />
        </Shell>
    );
}

function ProductShelfExample() {
    const shelf = React.useMemo(() => buildShelfRows(productShelfSections), []);

    return (
        <Shell title="Product Shelf">
            <LegendList
                columnWrapperStyle={{ gap: 12 }}
                data={shelf.rows}
                estimatedItemSize={160}
                getEstimatedItemSize={(item) => (item.type === "header" ? 60 : 160)}
                keyExtractor={(item) => item.id}
                numColumns={2}
                overrideItemLayout={(layout, item) => {
                    if (item.type === "header") {
                        layout.span = 2;
                    }
                }}
                renderItem={({ item }: { item: ShelfRow }) =>
                    item.type === "header" ? (
                        <div
                            style={{
                                background: "#EEF2FF",
                                border: "1px solid #CBD5E1",
                                borderRadius: 14,
                                marginBottom: 10,
                                padding: "10px 12px",
                            }}
                        >
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title}</div>
                            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{item.subtitle}</div>
                        </div>
                    ) : (
                        <div style={{ ...cardStyle(item.color), minHeight: 132 }}>
                            <div style={{ fontWeight: 800 }}>{item.title}</div>
                            <div style={{ marginTop: 6 }}>{item.priceLabel}</div>
                            <div style={{ color: "#475569", fontSize: 13, marginTop: 12 }}>{item.badge}</div>
                        </div>
                    )
                }
                style={listViewportStyle}
                stickyHeaderIndices={shelf.stickyHeaderIndices}
            />
        </Shell>
    );
}

function CardsFeedExample() {
    return (
        <Shell title="Cards Feed">
            <LegendList
                data={feedCards}
                estimatedItemSize={180}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: FeedCard }) => (
                    <div style={cardStyle()}>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title}</div>
                        <div style={{ color: "#64748b", marginTop: 6 }}>{item.author}</div>
                        <div style={{ marginTop: 10 }}>{item.body}</div>
                        <div style={{ color: "#64748b", marginTop: 10 }}>{item.reactionCount} reactions</div>
                    </div>
                )}
                style={listViewportStyle}
            />
        </Shell>
    );
}

function MediaRailsExample() {
    return (
        <Shell title="Media Rails">
            <LegendList
                data={mediaRails}
                estimatedItemSize={240}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: MediaRail }) => (
                    <div style={{ marginBottom: 18, minWidth: 0 }}>
                        <h2 style={{ margin: "0 0 10px" }}>{item.title}</h2>
                        <LegendList
                            contentContainerStyle={{ paddingBottom: 8, paddingRight: 16 }}
                            data={item.posters}
                            estimatedItemSize={152}
                            horizontal
                            keyExtractor={(poster) => poster.id}
                            renderItem={({ item: poster }: { item: MediaPoster }) => (
                                <div
                                    key={poster.id}
                                    style={{
                                        ...cardStyle(poster.color),
                                        color: "#fff",
                                        height: 170,
                                        marginRight: 12,
                                        minWidth: 132,
                                        width: 132,
                                    }}
                                >
                                    <div style={{ fontWeight: 800 }}>{poster.title}</div>
                                    <div style={{ marginTop: 6, opacity: 0.8 }}>{poster.subtitle}</div>
                                </div>
                            )}
                            style={{ minHeight: 190, minWidth: 0 }}
                        />
                    </div>
                )}
                style={listViewportStyle}
            />
        </Shell>
    );
}

function VideoFeedExample() {
    const [clips, setClips] = React.useState(() => videoClips);
    const [selectedId, setSelectedId] = React.useState(videoClips[0]?.id);
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const [viewportHeight, setViewportHeight] = React.useState(0);

    React.useEffect(() => {
        const element = viewportRef.current;
        if (!element) {
            return;
        }

        const update = () => {
            setViewportHeight(Math.max(0, Math.floor(element.getBoundingClientRect().height)));
        };

        update();

        const observer = new ResizeObserver(update);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return (
        <Shell title="Video Feed">
            <div ref={viewportRef} style={{ display: "flex", flex: 1, minHeight: 0 }}>
                {viewportHeight > 0 ? (
                    <LegendList
                        data={clips}
                        estimatedItemSize={viewportHeight}
                        keyExtractor={(item) => item.id}
                        onEndReached={() => {
                            setClips((current) => buildVideoFeed(current.length + 12).slice(0, current.length + 12));
                        }}
                        renderItem={({ item }: { item: VideoClip }) => (
                            <div
                                style={{
                                    boxSizing: "border-box",
                                    height: viewportHeight,
                                    paddingBottom: 12,
                                }}
                            >
                                <div
                                    onClick={() => setSelectedId(item.id)}
                                    style={{
                                        ...cardStyle(item.color),
                                        color: "#fff",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        justifyContent: "flex-end",
                                        marginBottom: 0,
                                    }}
                                >
                                    <div style={{ opacity: 0.8 }}>{item.creator}</div>
                                    <div style={{ fontSize: 26, fontWeight: 800 }}>{item.title}</div>
                                    <div style={{ marginTop: 8, opacity: 0.85 }}>
                                        {selectedId === item.id ? "Playing" : "Tap to focus"}
                                    </div>
                                </div>
                            </div>
                        )}
                        style={{
                            ...listViewportStyle,
                            scrollSnapType: "y mandatory",
                        }}
                    />
                ) : null}
            </div>
        </Shell>
    );
}

function NotificationsInboxExample() {
    const [items, setItems] = React.useState(initialInboxItems);
    return (
        <Shell title="Notifications Inbox">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <button
                    onClick={() =>
                        setItems((prev) => [
                            {
                                body: "A new payment summary arrived.",
                                id: `notification-${prev.length + 1}`,
                                isUnread: true,
                                timeLabel: "Now",
                                title: "Payment",
                            },
                            ...prev,
                        ])
                    }
                    style={{ ...buttonStyle(), marginBottom: 12, width: "fit-content" }}
                >
                    Add notification
                </button>
                <LegendList
                    data={items}
                    estimatedItemSize={76}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: { item: InboxNotification }) => (
                        <div
                            style={{
                                ...cardStyle(),
                                border: item.isUnread ? "1px solid #1d4ed8" : "1px solid transparent",
                            }}
                        >
                            <div style={{ fontWeight: 800 }}>{item.title}</div>
                            <div style={{ marginTop: 6 }}>{item.body}</div>
                            <div style={{ color: "#64748b", marginTop: 8 }}>{item.timeLabel}</div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}

function ActivityHistoryExample() {
    const [items, setItems] = React.useState(() => buildActivityItems());
    const listRef = React.useRef<LegendListRef | null>(null);
    return (
        <Shell title="Activity History">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <button
                        onClick={() => setItems((prev) => [...buildActivityItems(prev.length + 1, 12), ...prev])}
                        style={buttonStyle()}
                    >
                        Load older
                    </button>
                    <button
                        onClick={() => {
                            setItems((prev) => [...prev, ...buildActivityItems(prev.length + 1, 12)]);

                            window.requestAnimationFrame(() => {
                                listRef.current?.scrollToEnd({ animated: true });
                            });
                        }}
                        style={buttonStyle()}
                    >
                        Load newer
                    </button>
                </div>
                <LegendList
                    data={items}
                    estimatedItemSize={72}
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition
                    ref={listRef}
                    renderItem={({ item }: { item: ActivityItem }) => (
                        <div style={cardStyle()}>
                            <div style={{ fontWeight: 800 }}>{item.summary}</div>
                            <div style={{ color: "#64748b", marginTop: 4 }}>
                                {item.timeLabel} · {item.kind === "credit" ? "Credit" : "Debit"}
                            </div>
                            <div style={{ color: "#1d4ed8", fontWeight: 800, marginTop: 8 }}>{item.amountLabel}</div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}

function GalleryGridExample() {
    const [columns, setColumns] = React.useState<2 | 3>(3);
    return (
        <Shell title="Gallery Grid">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <button onClick={() => setColumns(2)} style={buttonStyle(columns === 2)}>
                        2 columns
                    </button>
                    <button onClick={() => setColumns(3)} style={buttonStyle(columns === 3)}>
                        3 columns
                    </button>
                </div>
                <LegendList
                    columnWrapperStyle={{ gap: 12 }}
                    data={galleryItems}
                    estimatedItemSize={160}
                    keyExtractor={(item) => item.id}
                    numColumns={columns}
                    renderItem={({ item }: { item: GalleryItem }) => (
                        <div style={{ ...cardStyle(item.color), color: "#fff", minHeight: 140 }}>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title}</div>
                            <div style={{ marginTop: 6 }}>{item.tone}</div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}

function InfiniteCalendarExample() {
    const today = React.useMemo(() => new Date(), []);
    const todayMonthId = React.useMemo(() => getCalendarMonthId(today), [today]);
    const [months, setMonths] = React.useState(() => buildCalendarMonths(today, CALENDAR_INITIAL_SPAN, today));
    const [mode, setMode] = React.useState<"vertical" | "horizontal">("vertical");
    const [activeMonthId, setActiveMonthId] = React.useState(todayMonthId);
    const [monthWidth, setMonthWidth] = React.useState(0);
    const horizontalEndBoundaryRef = React.useRef<string | null>(null);
    const horizontalStartBoundaryRef = React.useRef<string | null>(null);
    const listRef = React.useRef<LegendListRef | null>(null);
    const pendingScrollTargetRef = React.useRef<string | null>(null);
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const activeIndex = monthIndex(months, activeMonthId);

    React.useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) {
            return;
        }

        const updateMonthWidth = () => {
            setMonthWidth(Math.max(0, Math.floor(viewport.getBoundingClientRect().width)));
        };

        updateMonthWidth();
        const observer = new ResizeObserver(() => {
            updateMonthWidth();
        });
        observer.observe(viewport);

        return () => {
            observer.disconnect();
        };
    }, []);

    React.useEffect(() => {
        pendingScrollTargetRef.current = activeMonthId;
    }, [mode]);

    React.useEffect(() => {
        const pendingTarget = pendingScrollTargetRef.current;
        if (!pendingTarget) {
            return;
        }

        if (mode === "horizontal" && monthWidth === 0) {
            return;
        }

        const index = monthIndex(months, pendingTarget);
        const frame = window.requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({
                animated: pendingTarget !== activeMonthId,
                index,
                viewPosition: 0,
            });
            pendingScrollTargetRef.current = null;
        });

        return () => window.cancelAnimationFrame(frame);
    }, [activeMonthId, mode, monthWidth, months]);

    const ensureMonthVisible = React.useCallback(
        (targetMonthId: string) => {
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
        },
        [today],
    );

    const loadOlder = React.useCallback(() => {
        setMonths((current) => prependCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    }, [today]);

    const loadNewer = React.useCallback(() => {
        setMonths((current) => appendCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    }, [today]);
    const horizontalPageWidth = mode === "horizontal" ? 320 : undefined;

    return (
        <Shell title="Infinite Calendar">
            <div ref={viewportRef} style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <button onClick={() => setMode("vertical")} style={buttonStyle(mode === "vertical")}>
                        Vertical
                    </button>
                    <button onClick={() => setMode("horizontal")} style={buttonStyle(mode === "horizontal")}>
                        Horizontal
                    </button>
                    <button onClick={() => ensureMonthVisible(shiftCalendarMonthId(activeMonthId, -1))} style={buttonStyle()}>
                        Prev
                    </button>
                    <button onClick={() => ensureMonthVisible(todayMonthId)} style={buttonStyle()}>
                        Today
                    </button>
                    <button onClick={() => ensureMonthVisible(shiftCalendarMonthId(activeMonthId, 1))} style={buttonStyle()}>
                        Next
                    </button>
                </div>
                <LegendList
                    data={months}
                    estimatedItemSize={mode === "horizontal" ? 332 : 340}
                    horizontal={mode === "horizontal"}
                    initialScrollIndex={activeIndex}
                    key={mode}
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition
                    onEndReached={mode === "horizontal" ? undefined : loadNewer}
                    onEndReachedThreshold={0.25}
                    onStartReached={mode === "horizontal" ? undefined : loadOlder}
                    onStartReachedThreshold={0.25}
                    onViewableItemsChanged={({ viewableItems }) => {
                        const visibleMonths = viewableItems
                            .map((viewableItem) => viewableItem.item as CalendarMonth | undefined)
                            .filter((month): month is CalendarMonth => Boolean(month));
                        const nextActive = visibleMonths[0];
                        if (nextActive?.id && pendingScrollTargetRef.current == null) {
                            setActiveMonthId((current) => (current === nextActive.id ? current : nextActive.id));
                        }

                        if (mode !== "horizontal" || visibleMonths.length === 0) {
                            return;
                        }

                        const firstVisibleIndex = monthIndex(months, visibleMonths[0]!.id);
                        const lastVisibleIndex = monthIndex(months, visibleMonths[visibleMonths.length - 1]!.id);
                        const startBoundaryId = months[0]?.id ?? null;
                        const endBoundaryId = months[months.length - 1]?.id ?? null;

                        if (firstVisibleIndex <= 1 && startBoundaryId && horizontalStartBoundaryRef.current !== startBoundaryId) {
                            horizontalStartBoundaryRef.current = startBoundaryId;
                            setMonths((current) => prependCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
                        } else if (firstVisibleIndex > 1) {
                            horizontalStartBoundaryRef.current = null;
                        }

                        if (
                            lastVisibleIndex >= months.length - 2 &&
                            endBoundaryId &&
                            horizontalEndBoundaryRef.current !== endBoundaryId
                        ) {
                            horizontalEndBoundaryRef.current = endBoundaryId;
                            setMonths((current) => appendCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
                        } else if (lastVisibleIndex < months.length - 2) {
                            horizontalEndBoundaryRef.current = null;
                        }
                    }}
                    ref={listRef}
                    renderItem={({ item }: { item: CalendarMonth }) => (
                        <div
                            style={{
                                boxSizing: "border-box",
                                flex: mode === "horizontal" ? "0 0 auto" : undefined,
                                paddingRight: mode === "horizontal" ? 12 : 0,
                                scrollSnapAlign: mode === "horizontal" ? "start" : undefined,
                                scrollSnapStop: mode === "horizontal" ? "always" : undefined,
                                width: horizontalPageWidth,
                            }}
                        >
                            <div
                                style={{
                                    ...cardStyle(),
                                    border: item.id === activeMonthId ? "1px solid #1d4ed8" : "1px solid #e5e7eb",
                                }}
                            >
                                <h2 style={{ marginTop: 0 }}>{item.label}</h2>
                                {item.weeks.map((week, weekIndex) => (
                                    <div key={weekIndex} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                        {week.map((day) => (
                                            <div
                                                key={day.dateKey}
                                                style={{
                                                    background: day.isToday ? "#111827" : "#e5e7eb",
                                                    borderRadius: 10,
                                                    color: day.isToday ? "#fff" : "#111827",
                                                    flex: 1,
                                                    opacity: day.isCurrentMonth ? 1 : 0.35,
                                                    padding: "10px 0",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {day.dayNumber}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    style={
                        mode === "horizontal"
                            ? {
                                  ...listViewportStyle,
                                  overscrollBehaviorX: "contain",
                                  scrollSnapType: "x mandatory",
                                  width: "100%",
                              }
                            : listViewportStyle
                    }
                />
            </div>
        </Shell>
    );
}

export function renderCuratedExample(slug: ExampleSlug) {
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
            return null;
    }
}
