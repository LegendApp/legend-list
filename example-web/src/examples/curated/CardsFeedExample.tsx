import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildFeedCards, type FeedCard } from "@examples/commerce";
import { cardStyle, listViewportStyle, Shell } from "./shared";

const feedCards = buildFeedCards();

export function CardsFeedExample() {
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
