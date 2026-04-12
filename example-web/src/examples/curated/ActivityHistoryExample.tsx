import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import {
    appendActivityItems,
    buildActivityHistoryRows,
    buildActivityItems,
    prependActivityItems,
    settlePendingActivityItems,
    type ActivityHistoryRow,
} from "@examples/commerce";
import { buttonStyle, cardStyle, listViewportStyle, Shell } from "./shared";

export function ActivityHistoryExample() {
    const [items, setItems] = React.useState(() => buildActivityItems());
    const [expandedIds, setExpandedIds] = React.useState<string[]>([]);
    const [isLive, setIsLive] = React.useState(true);
    const [isMaintainingAtEnd, setIsMaintainingAtEnd] = React.useState(true);
    const listRef = React.useRef<LegendListRef | null>(null);
    const timeline = React.useMemo(() => buildActivityHistoryRows(items), [items]);
    const pendingCount = React.useMemo(() => items.filter((item) => item.status === "pending").length, [items]);

    const toggleExpanded = React.useCallback((id: string) => {
        setExpandedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
    }, []);

    const updateMaintainAtEndState = React.useCallback(() => {
        const next = listRef.current?.getState().isAtEnd;
        if (next === undefined) {
            return;
        }
        setIsMaintainingAtEnd((current) => (current === next ? current : next));
    }, []);

    React.useEffect(() => {
        if (!isLive) {
            return;
        }

        const appendTimer = window.setInterval(() => {
            setItems((current) => appendActivityItems(current, 1));
        }, 2400);
        const settleTimer = window.setInterval(() => {
            setItems((current) => settlePendingActivityItems(current, 1));
        }, 1600);

        return () => {
            window.clearInterval(appendTimer);
            window.clearInterval(settleTimer);
        };
    }, [isLive]);

    React.useEffect(() => {
        updateMaintainAtEndState();
    }, [items, updateMaintainAtEndState]);

    return (
        <Shell title="Activity History">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                    <button
                        onClick={() => setIsLive((current) => !current)}
                        style={buttonStyle(isLive)}
                        type="button"
                    >
                        {isLive ? "Pause live" : "Resume live"}
                    </button>
                    <div style={{ alignSelf: "center", color: "#64748b", fontSize: 13 }}>
                        {isLive ? "Posting every 2.4s" : "Live feed paused"} · {pendingCount} pending ·
                        {" "}
                        {isMaintainingAtEnd ? "Maintaining at end" : "Not maintaining at end"} · Scroll up to load older
                    </div>
                </div>
                <LegendList
                    contentContainerStyle={{ padding: 8 }}
                    data={timeline.rows}
                    estimatedItemSize={116}
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
                            <div
                                style={{
                                    background: "#E2E8F0",
                                    border: "1px solid #CBD5E1",
                                    borderRadius: 0,
                                    marginBottom: 8,
                                    padding: "10px 12px",
                                }}
                            >
                                <div style={{ fontSize: 15, fontWeight: 800 }}>{item.title}</div>
                                <div style={{ color: "#475569", fontSize: 12, marginTop: 3 }}>
                                    {item.totalLabel}
                                    {item.pendingCount > 0 ? ` · ${item.pendingCount} pending` : ""}
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => toggleExpanded(item.item.id)}
                                style={{
                                    ...cardStyle(),
                                    borderColor:
                                        item.item.status === "pending"
                                            ? "#F59E0B"
                                            : item.item.status === "reversed"
                                              ? "#FCA5A5"
                                              : item.item.kind === "credit"
                                                ? "#86EFAC"
                                                : "#E5E7EB",
                                    cursor: "pointer",
                                    marginBottom: 12,
                                    textAlign: "left",
                                    width: "100%",
                                }}
                                type="button"
                            >
                                <div style={{ alignItems: "center", display: "flex", gap: 12, justifyContent: "space-between" }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 800 }}>{item.item.summary}</div>
                                        <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                                            {item.item.merchant} · {item.item.categoryLabel} · {item.item.timeLabel}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            color: item.item.kind === "credit" ? "#0F766E" : "#9A3412",
                                            fontWeight: 800,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {item.item.amountLabel}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                    <div
                                        style={{
                                            background:
                                                item.item.status === "pending"
                                                    ? "#FEF3C7"
                                                    : item.item.status === "reversed"
                                                      ? "#FEE2E2"
                                                      : "#DCFCE7",
                                            borderRadius: 999,
                                            color:
                                                item.item.status === "pending"
                                                    ? "#92400E"
                                                    : item.item.status === "reversed"
                                                      ? "#991B1B"
                                                      : "#166534",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            padding: "6px 10px",
                                            textTransform: "capitalize",
                                        }}
                                    >
                                        {item.item.status}
                                    </div>
                                    <div style={{ color: "#64748b", fontSize: 12, padding: "6px 0" }}>
                                        {expandedIds.includes(item.item.id) ? "Hide details" : "Show details"}
                                    </div>
                                </div>
                                {expandedIds.includes(item.item.id) ? (
                                    <div style={{ color: "#334155", display: "grid", gap: 8, lineHeight: 1.55, marginTop: 12 }}>
                                        {item.item.detailLines.map((line, index) => (
                                            <div key={`${item.item.id}-${index}`}>{line}</div>
                                        ))}
                                    </div>
                                ) : null}
                            </button>
                        )
                    }
                    stickyHeaderIndices={timeline.stickyHeaderIndices}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}
