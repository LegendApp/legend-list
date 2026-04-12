import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildInboxNotifications, type InboxNotification } from "@examples/commerce";
import { buttonStyle, CARD_CLASS, cardStyle, listViewportStyle, Shell } from "./shared";

const initialInboxItems = buildInboxNotifications();

export function NotificationsInboxExample() {
    const [items, setItems] = React.useState(initialInboxItems);

    return (
        <Shell title="Notifications Inbox">
            <div className="flex min-h-0 flex-1 flex-col">
                <button
                    className={`${buttonStyle()} mb-3 w-fit`}
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
                            className={CARD_CLASS}
                            style={{
                                ...cardStyle(),
                                border: item.isUnread ? "1px solid #1d4ed8" : "1px solid transparent",
                            }}
                        >
                            <div className="font-extrabold">{item.title}</div>
                            <div className="mt-1.5">{item.body}</div>
                            <div className="mt-2 text-slate-500">{item.timeLabel}</div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}
