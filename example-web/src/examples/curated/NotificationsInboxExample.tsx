import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildInboxNotifications, type InboxNotification } from "@examples/commerce";
import { buttonStyle, cardStyle, listViewportStyle, Shell } from "./shared";

const initialInboxItems = buildInboxNotifications();

export function NotificationsInboxExample() {
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
                    type="button"
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
