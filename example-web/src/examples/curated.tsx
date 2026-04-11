import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { ExampleSlug } from "@examples/types";
import { buildActivityItems, buildFeedCards, buildGalleryItems, buildInboxNotifications, buildProductShelf, type ActivityItem, type FeedCard, type GalleryItem, type InboxNotification, type ProductShelfSection } from "@examples/commerce";
import { buildAiConversation, buildChatMessages, type AiMessage, type ChatMessage } from "@examples/chat";
import { buildCalendarMonths, type CalendarMonth } from "@examples/calendar";
import { buildDirectoryPeople, buildSectionedDirectoryRows, type DirectoryPerson, type SectionedDirectoryRow } from "@examples/directory";
import { buildMediaRails, buildVideoFeed, type MediaRail, type VideoClip } from "@examples/media";

const directoryPeople = buildDirectoryPeople();
const sectionedDirectory = buildSectionedDirectoryRows(directoryPeople);
const productShelfSections = buildProductShelf();
const feedCards = buildFeedCards();
const mediaRails = buildMediaRails();
const videoClips = buildVideoFeed();
const initialInboxItems = buildInboxNotifications();
const galleryItems = buildGalleryItems();

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
            <h1 style={{ fontSize: 34, margin: 0 }}>{title}</h1>
            <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
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

function ChatExample() {
    const items = React.useMemo(() => buildChatMessages(), []);
    return (
        <Shell title="Chat">
            <LegendList
                alignItemsAtEnd
                contentContainerStyle={{ padding: 8 }}
                data={items}
                estimatedItemSize={72}
                initialScrollIndex={items.length - 1}
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                renderItem={({ item }: { item: ChatMessage }) => (
                    <div
                        style={{
                            ...cardStyle(item.sender === "self" ? "#DBEAFE" : "#FFFFFF"),
                            alignSelf: item.sender === "self" ? "flex-end" : "flex-start",
                            maxWidth: "82%",
                        }}
                    >
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{item.senderName}</div>
                        <div>{item.text}</div>
                        <div style={{ color: "#64748b", fontSize: 11, marginTop: 8 }}>{item.timestampLabel}</div>
                    </div>
                )}
            />
        </Shell>
    );
}

function AiChatExample() {
    const { initialMessages, prompt, reply } = React.useMemo(() => buildAiConversation(), []);
    const [messages, setMessages] = React.useState<AiMessage[]>(initialMessages);

    React.useEffect(() => {
        const words = reply.split(" ");
        let currentWordIndex = 0;
        const interval = window.setInterval(() => {
            currentWordIndex += 1;
            const nextText = words.slice(0, currentWordIndex).join(" ");
            setMessages((current) =>
                current.map((message) =>
                    message.isPlaceholder
                        ? {
                              id: "ai-assistant-live",
                              sender: "assistant",
                              text: nextText || prompt,
                              timestampLabel: "Now",
                          }
                        : message,
                ),
            );

            if (currentWordIndex >= words.length) {
                window.clearInterval(interval);
            }
        }, 40);

        return () => window.clearInterval(interval);
    }, [prompt, reply]);

    return (
        <Shell title="AI Chat">
            <LegendList
                contentContainerStyle={{ padding: 8 }}
                data={messages}
                estimatedItemSize={110}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                renderItem={({ item }: { item: AiMessage }) => (
                    <div
                        style={{
                            ...cardStyle(item.sender === "user" ? "#111827" : "#FFFFFF"),
                            color: item.sender === "user" ? "#FFFFFF" : "#111827",
                        }}
                    >
                        {item.text || "Thinking..."}
                    </div>
                )}
                style={{ flex: 1, minHeight: 0 }}
            />
        </Shell>
    );
}

function DirectoryExample() {
    const [query, setQuery] = React.useState("");
    const filtered = React.useMemo(() => {
        const q = query.toLowerCase();
        return directoryPeople.filter((person) => person.name.toLowerCase().includes(q) || person.department.toLowerCase().includes(q));
    }, [query]);

    return (
        <Shell title="Directory">
            <input
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people or team..."
                style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, marginBottom: 12, padding: "12px 14px" }}
                value={query}
            />
            <LegendList
                data={filtered}
                estimatedItemSize={72}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: DirectoryPerson }) => (
                    <div style={{ ...cardStyle(), alignItems: "center", display: "flex", gap: 12 }}>
                        <div style={{ alignItems: "center", background: item.accent, borderRadius: 999, color: "#fff", display: "flex", fontWeight: 800, height: 42, justifyContent: "center", width: 42 }}>
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
            />
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
                        <div style={{ ...cardStyle("#E2E8F0"), fontWeight: 800, marginBottom: 8, padding: "10px 12px" }}>{item.title}</div>
                    ) : (
                        <div style={{ ...cardStyle(), alignItems: "center", display: "flex", gap: 12 }}>
                            <div style={{ alignItems: "center", background: item.accent, borderRadius: 999, color: "#fff", display: "flex", fontWeight: 800, height: 42, justifyContent: "center", width: 42 }}>
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
            />
        </Shell>
    );
}

function ProductShelfExample() {
    return (
        <Shell title="Product Shelf">
            <LegendList
                data={productShelfSections}
                estimatedItemSize={360}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: ProductShelfSection }) => (
                    <div style={{ marginBottom: 18 }}>
                        <h2 style={{ margin: "0 0 10px" }}>{item.title}</h2>
                        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                            {item.items.map((product) => (
                                <div key={product.id} style={{ ...cardStyle(product.color), minHeight: 120 }}>
                                    <div style={{ fontWeight: 800 }}>{product.title}</div>
                                    <div style={{ marginTop: 6 }}>{product.priceLabel}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
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
            />
        </Shell>
    );
}

function MediaRailsExample() {
    return (
        <Shell title="Media Rails">
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {mediaRails.map((rail) => (
                    <div key={rail.id}>
                        <h2 style={{ margin: "0 0 10px" }}>{rail.title}</h2>
                        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
                            {rail.posters.map((poster) => (
                                <div key={poster.id} style={{ ...cardStyle(poster.color), color: "#fff", flex: "0 0 120px", height: 170 }}>
                                    <div style={{ fontWeight: 800 }}>{poster.title}</div>
                                    <div style={{ marginTop: 6, opacity: 0.8 }}>{poster.subtitle}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Shell>
    );
}

function VideoFeedExample() {
    const [selectedId, setSelectedId] = React.useState(videoClips[0]?.id);
    return (
        <Shell title="Video Feed">
            <LegendList
                data={videoClips}
                estimatedItemSize={420}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: VideoClip }) => (
                    <div
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            ...cardStyle(item.color),
                            color: "#fff",
                            cursor: "pointer",
                            height: 360,
                            justifyContent: "flex-end",
                        }}
                    >
                        <div style={{ opacity: 0.8 }}>{item.creator}</div>
                        <div style={{ fontSize: 26, fontWeight: 800 }}>{item.title}</div>
                        <div style={{ marginTop: 8, opacity: 0.85 }}>{selectedId === item.id ? "Playing" : "Tap to focus"}</div>
                    </div>
                )}
            />
        </Shell>
    );
}

function NotificationsInboxExample() {
    const [items, setItems] = React.useState(initialInboxItems);
    return (
        <Shell title="Notifications Inbox">
            <button
                onClick={() =>
                    setItems((prev) => [
                        ...prev,
                        {
                            body: "A new payment summary arrived.",
                            id: `notification-${prev.length + 1}`,
                            isUnread: true,
                            timeLabel: "Now",
                            title: "Payment",
                        },
                    ])
                }
                style={buttonStyle()}
            >
                Add notification
            </button>
            <LegendList
                data={items}
                estimatedItemSize={76}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: InboxNotification }) => (
                    <div style={{ ...cardStyle(), border: item.isUnread ? "1px solid #1d4ed8" : "1px solid transparent" }}>
                        <div style={{ fontWeight: 800 }}>{item.title}</div>
                        <div style={{ marginTop: 6 }}>{item.body}</div>
                        <div style={{ color: "#64748b", marginTop: 8 }}>{item.timeLabel}</div>
                    </div>
                )}
            />
        </Shell>
    );
}

function ActivityHistoryExample() {
    const [items, setItems] = React.useState(() => buildActivityItems());
    return (
        <Shell title="Activity History">
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <button onClick={() => setItems((prev) => [...buildActivityItems(prev.length + 1, 6), ...prev])} style={buttonStyle()}>
                    Load older
                </button>
                <button onClick={() => setItems((prev) => [...prev, ...buildActivityItems(prev.length + 1, 6)])} style={buttonStyle()}>
                    Load newer
                </button>
            </div>
            <LegendList
                data={items}
                estimatedItemSize={72}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: ActivityItem }) => (
                    <div style={cardStyle()}>
                        <div style={{ fontWeight: 800 }}>{item.summary}</div>
                        <div style={{ color: "#64748b", marginTop: 4 }}>
                            {item.timeLabel} · {item.kind === "credit" ? "Credit" : "Debit"}
                        </div>
                        <div style={{ color: "#1d4ed8", fontWeight: 800, marginTop: 8 }}>{item.amountLabel}</div>
                    </div>
                )}
            />
        </Shell>
    );
}

function GalleryGridExample() {
    const [columns, setColumns] = React.useState<2 | 3>(3);
    return (
        <Shell title="Gallery Grid">
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
            />
        </Shell>
    );
}

function InfiniteCalendarExample() {
    const months = React.useMemo(() => buildCalendarMonths(), []);
    const [mode, setMode] = React.useState<"vertical" | "horizontal">("vertical");
    return (
        <Shell title="Infinite Calendar">
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <button onClick={() => setMode("vertical")} style={buttonStyle(mode === "vertical")}>
                    Vertical
                </button>
                <button onClick={() => setMode("horizontal")} style={buttonStyle(mode === "horizontal")}>
                    Horizontal
                </button>
            </div>
            {mode === "vertical" ? (
                <LegendList
                    data={months}
                    estimatedItemSize={340}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: { item: CalendarMonth }) => (
                        <div style={cardStyle()}>
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
                    )}
                />
            ) : (
                <div style={{ display: "flex", overflowX: "auto" }}>
                    {months.map((month) => (
                        <div key={month.id} style={{ minWidth: 320, paddingRight: 12 }}>
                            <div style={cardStyle()}>
                                <h2 style={{ marginTop: 0 }}>{month.label}</h2>
                                {month.weeks.map((week, weekIndex) => (
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
                    ))}
                </div>
            )}
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
