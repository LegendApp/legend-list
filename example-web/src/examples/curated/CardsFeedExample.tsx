import React, { memo } from "react";

import { LegendList, type LegendListRenderItemProps, useRecyclingState } from "@legendapp/list/react";
import { buildFeedCards, type FeedCard, type FeedPollOption } from "@examples/commerce";
import { buttonStyle, cardStyle, listViewportStyle, Shell } from "./shared";

const feedCards = buildFeedCards();

function pollVotesForOption(optionId: string, option: FeedPollOption, selectedOptionId: string | null) {
    return option.votes + (selectedOptionId === optionId ? 1 : 0);
}

const FeedCardItem = memo(({ item, extraData }: LegendListRenderItemProps<FeedCard>) => {
    const [isExpandedValue, setExpanded] = extraData?.recycleState
        ? useRecyclingState(() => false)
        : React.useState(false);
    const [isLikedValue, setLiked] = extraData?.recycleState ? useRecyclingState(() => false) : React.useState(false);
    const [selectedOptionIdValue, setSelectedOptionId] = extraData?.recycleState
        ? useRecyclingState<string | null>(() => null)
        : React.useState<string | null>(null);

    const isExpanded = Boolean(isExpandedValue);
    const isLiked = Boolean(isLikedValue);
    const selectedOptionId = selectedOptionIdValue ?? null;

    return (
        <div style={cardStyle()}>
            <div style={{ alignItems: "center", display: "flex", gap: 12, marginBottom: 12 }}>
                <div
                    style={{
                        alignItems: "center",
                        background: item.accentColor,
                        borderRadius: 999,
                        color: "#0f172a",
                        display: "flex",
                        fontWeight: 800,
                        height: 40,
                        justifyContent: "center",
                        width: 40,
                    }}
                >
                    {item.author.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{item.author}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{item.timestampLabel}</div>
                </div>
                <div
                    style={{
                        background: "#eef2ff",
                        borderRadius: 999,
                        color: "#4338ca",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "6px 10px",
                        textTransform: "capitalize",
                    }}
                >
                    {item.kind}
                </div>
            </div>

            {item.kind === "story" ? (
                <>
                    <div
                        style={{
                            background: "#f8fafc",
                            borderRadius: 999,
                            color: "#334155",
                            display: "inline-block",
                            fontSize: 12,
                            fontWeight: 700,
                            marginBottom: 10,
                            padding: "6px 10px",
                        }}
                    >
                        {item.categoryLabel}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title}</div>
                    <div style={{ color: "#334155", lineHeight: 1.55, marginTop: 10 }}>{item.body}</div>
                </>
            ) : null}

            {item.kind === "photo" ? (
                <>
                    <div
                        style={{
                            background: item.accentColor,
                            borderRadius: 18,
                            color: "#0f172a",
                            display: "flex",
                            flexDirection: "column",
                            height: item.mediaHeight,
                            justifyContent: "flex-end",
                            marginBottom: 12,
                            padding: 14,
                        }}
                    >
                        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.72, textTransform: "uppercase" }}>
                            {item.mediaLabel}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{item.title}</div>
                        <div style={{ marginTop: 6, maxWidth: 260, opacity: 0.78 }}>{item.mediaSubtitle}</div>
                    </div>
                    <div style={{ color: "#334155", lineHeight: 1.55 }}>{item.body}</div>
                </>
            ) : null}

            {item.kind === "poll" ? (
                <>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title}</div>
                    <div style={{ color: "#334155", lineHeight: 1.55, marginTop: 10 }}>{item.body}</div>
                    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                        {item.pollOptions.map((option) => {
                            const votes = pollVotesForOption(option.id, option, selectedOptionId);
                            const totalVotes = item.totalVotes + (selectedOptionId ? 1 : 0);
                            const width = `${Math.max(18, Math.round((votes / totalVotes) * 100))}%`;
                            const isSelected = selectedOptionId === option.id;
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => {
                                        if (!isSelected) {
                                            setSelectedOptionId(option.id);
                                        }
                                    }}
                                    style={{
                                        background: isSelected ? "#dbeafe" : "#f8fafc",
                                        border: isSelected ? "1px solid #60a5fa" : "1px solid #e2e8f0",
                                        borderRadius: 16,
                                        cursor: "pointer",
                                        overflow: "hidden",
                                        padding: 0,
                                        textAlign: "left",
                                    }}
                                    type="button"
                                >
                                    <div
                                        style={{
                                            background: isSelected ? "#bfdbfe" : "#e2e8f0",
                                            height: "100%",
                                            minWidth: width,
                                            padding: "12px 14px",
                                        }}
                                    >
                                        <div style={{ fontWeight: 700 }}>{option.label}</div>
                                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                                            {votes} votes
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : null}

            {item.kind === "quote" ? (
                <>
                    <div
                        style={{
                            background: "#f8fafc",
                            borderLeft: `4px solid ${item.accentColor}`,
                            borderRadius: 16,
                            padding: 16,
                        }}
                    >
                        <div style={{ color: "#0f172a", fontSize: 20, fontWeight: 700, lineHeight: 1.5 }}>
                            "{item.quote}"
                        </div>
                        <div style={{ color: "#64748b", marginTop: 10 }}>{item.source}</div>
                    </div>
                    <div style={{ color: "#334155", lineHeight: 1.55, marginTop: 12 }}>{item.body}</div>
                </>
            ) : null}

            {item.kind === "event" ? (
                <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <div
                            style={{
                                background: "#dcfce7",
                                borderRadius: 999,
                                color: "#166534",
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "6px 10px",
                            }}
                        >
                            {item.highlight}
                        </div>
                        <div
                            style={{
                                background: "#f8fafc",
                                borderRadius: 999,
                                color: "#334155",
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "6px 10px",
                            }}
                        >
                            {item.attendeesLabel}
                        </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title}</div>
                    <div style={{ color: "#334155", lineHeight: 1.55, marginTop: 10 }}>{item.body}</div>
                    <div style={{ color: "#64748b", marginTop: 12 }}>{item.location}</div>
                </>
            ) : null}

            {item.kind !== "poll" && isExpanded ? (
                <div style={{ color: "#334155", lineHeight: 1.6, marginTop: 14 }}>{item.expandedBody}</div>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => setLiked((current) => !current)} style={buttonStyle(isLiked)} type="button">
                    {isLiked ? "Liked" : "Like"} · {item.reactionCount + (isLiked ? 1 : 0)}
                </button>
                <div
                    style={{
                        alignSelf: "center",
                        color: "#64748b",
                        fontSize: 13,
                    }}
                >
                    {item.commentCount} comments
                </div>
                {item.kind !== "poll" ? (
                    <button onClick={() => setExpanded((current) => !current)} style={buttonStyle()} type="button">
                        {isExpanded ? "Collapse" : "Expand"}
                    </button>
                ) : null}
            </div>
        </div>
    );
});

export function CardsFeedExample() {
    return (
        <Shell title="Cards Feed">
            <LegendList
                contentContainerStyle={{ padding: 8 }}
                data={feedCards}
                estimatedItemSize={286}
                extraData={{ recycleState: true }}
                keyExtractor={(item) => item.id}
                renderItem={FeedCardItem}
                style={listViewportStyle}
            />
        </Shell>
    );
}
