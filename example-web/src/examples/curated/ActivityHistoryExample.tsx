import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import {
    type ActivityHistoryRow,
    appendActivityItems,
    buildActivityHistoryRows,
    buildActivityItems,
    prependActivityItems,
    settlePendingActivityItems,
} from "@examples/commerce";
import { buttonStyle, CARD_CLASS, cardStyle, listViewportStyle, Shell } from "./shared";

export function ActivityHistoryExample() {
    const [items, setItems] = React.useState(() => buildActivityItems());
    const [expandedIds, setExpandedIds] = React.useState<string[]>([]);
    const [isLive, setIsLive] = React.useState(true);
    const [isMaintainingAtEnd, setIsMaintainingAtEnd] = React.useState(true);
    const listRef = React.useRef<LegendListRef | null>(null);
    const timeline = React.useMemo(() => buildActivityHistoryRows(items), [items]);
    const pendingCount = React.useMemo(() => items.filter((item) => item.status === "pending").length, [items]);

    const toggleExpanded = React.useCallback((id: string) => {
        setExpandedIds((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
        );
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
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex flex-wrap gap-3">
                    <button
                        className={buttonStyle(isLive)}
                        onClick={() => setIsLive((current) => !current)}
                        type="button"
                    >
                        {isLive ? "Pause live" : "Resume live"}
                    </button>
                    <div className="self-center text-[13px] text-slate-500">
                        {isLive ? "Posting every 2.4s" : "Live feed paused"} · {pendingCount} pending ·{" "}
                        {isMaintainingAtEnd ? "Maintaining at end" : "Not maintaining at end"}
                    </div>
                </div>
                <LegendList
                    contentContainerStyle={{ padding: 8 }}
                    data={timeline.rows}
                    estimatedItemSize={116}
                    initialScrollIndex={timeline.rows.length - 1}
                    keyExtractor={(item) => item.id}
                    recycleItems
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
                                className="mb-2 rounded-none border border-slate-300 bg-slate-200 px-3 py-[10px]"
                                style={{
                                    borderRadius: 0,
                                }}
                            >
                                <div className="text-[15px] font-extrabold">{item.title}</div>
                                <div className="mt-[3px] text-xs text-slate-600">
                                    {item.totalLabel}
                                    {item.pendingCount > 0 ? ` · ${item.pendingCount} pending` : ""}
                                </div>
                            </div>
                        ) : (
                            <button
                                className={`${CARD_CLASS} mb-3 w-full cursor-pointer text-left`}
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
                                }}
                                type="button"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-extrabold">{item.item.summary}</div>
                                        <div className="mt-1 text-[13px] text-slate-500">
                                            {item.item.merchant} · {item.item.categoryLabel} · {item.item.timeLabel}
                                        </div>
                                    </div>
                                    <div
                                        className="whitespace-nowrap font-extrabold"
                                        style={{
                                            color: item.item.kind === "credit" ? "#0F766E" : "#9A3412",
                                        }}
                                    >
                                        {item.item.amountLabel}
                                    </div>
                                </div>
                                <div className="mt-[10px] flex gap-2">
                                    <div
                                        className="rounded-full px-[10px] py-1.5 text-xs font-bold capitalize"
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
                                        }}
                                    >
                                        {item.item.status}
                                    </div>
                                    <div className="py-1.5 text-xs text-slate-500">
                                        {expandedIds.includes(item.item.id) ? "Hide details" : "Show details"}
                                    </div>
                                </div>
                                {expandedIds.includes(item.item.id) ? (
                                    <div className="mt-3 grid gap-2 leading-[1.55] text-slate-700">
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
