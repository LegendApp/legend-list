import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { buildActivityItems, type ActivityItem } from "@examples/commerce";
import { buttonStyle, cardStyle, listViewportStyle, Shell } from "./shared";

export function ActivityHistoryExample() {
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
