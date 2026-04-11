import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildChatMessages, type ChatMessage } from "@examples/chat";
import { cardStyle, ChatAttachmentCard, listViewportStyle, Shell } from "./shared";

export function ChatExample() {
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
                            marginLeft: item.sender === "self" ? "auto" : 0,
                            maxWidth: "82%",
                            width: "fit-content",
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
