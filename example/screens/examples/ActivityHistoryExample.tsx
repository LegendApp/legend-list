import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import {
    type ActivityHistoryRow,
    appendActivityItems,
    buildActivityHistoryRows,
    buildActivityItems,
    prependActivityItems,
    settlePendingActivityItems,
} from "../../../examples-shared/commerce";

const styles = StyleSheet.create({
    amount: {
        fontSize: 16,
        fontWeight: "700",
    },
    badgeRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
        marginTop: 10,
    },
    button: {
        backgroundColor: "#FFFFFF",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    buttonActive: {
        backgroundColor: "#111827",
    },
    buttonText: {
        color: "#111827",
        fontSize: 13,
        fontWeight: "700",
    },
    buttonTextActive: {
        color: "#FFFFFF",
    },
    credit: {
        color: "#0F766E",
    },
    debit: {
        color: "#7C2D12",
    },
    details: {
        gap: 8,
        marginTop: 12,
    },
    detailText: {
        color: "#334155",
        lineHeight: 20,
    },
    expandLabel: {
        color: "#64748B",
        fontSize: 12,
        fontWeight: "600",
    },
    headerMeta: {
        color: "#475569",
        fontSize: 12,
        marginTop: 4,
    },
    headerRow: {
        backgroundColor: "#E2E8F0",
        borderColor: "#CBD5E1",
        borderRadius: 0,
        borderWidth: 1,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    headerTitle: {
        color: "#0F172A",
        fontSize: 15,
        fontWeight: "800",
    },
    listContent: {
        padding: 20,
    },
    liveSummary: {
        color: "#64748B",
        flexShrink: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    row: {
        backgroundColor: "#FFFFFF",
        borderColor: "#E5E7EB",
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        padding: 16,
    },
    rowCopy: {
        flex: 1,
        marginRight: 12,
    },
    rowCredit: {
        borderColor: "#86EFAC",
    },
    rowHeader: {
        alignItems: "flex-start",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    rowMeta: {
        color: "#64748B",
        marginTop: 4,
    },
    rowPending: {
        borderColor: "#F59E0B",
    },
    rowReversed: {
        borderColor: "#FCA5A5",
    },
    rowTitle: {
        color: "#1C1917",
        fontSize: 16,
        fontWeight: "600",
    },
    safeArea: {
        backgroundColor: "#F6F1EA",
        flex: 1,
    },
    statusBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: "700",
        textTransform: "capitalize",
    },
    statusPending: {
        backgroundColor: "#FEF3C7",
    },
    statusPendingText: {
        color: "#92400E",
    },
    statusPosted: {
        backgroundColor: "#DCFCE7",
    },
    statusPostedText: {
        color: "#166534",
    },
    statusReversed: {
        backgroundColor: "#FEE2E2",
    },
    statusReversedText: {
        color: "#991B1B",
    },
    toolbar: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        paddingBottom: 16,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
});

export function ActivityHistoryExample() {
    const [items, setItems] = useState(() => buildActivityItems());
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const [isLive, setIsLive] = useState(true);
    const [isMaintainingAtEnd, setIsMaintainingAtEnd] = useState(true);
    const listRef = useRef<LegendListRef>(null);
    const timeline = useMemo(() => buildActivityHistoryRows(items), [items]);
    const pendingCount = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);

    const updateMaintainAtEndState = useCallback(() => {
        const next = listRef.current?.getState().isAtEnd;
        if (next === undefined) {
            return;
        }
        setIsMaintainingAtEnd((current) => (current === next ? current : next));
    }, []);

    useEffect(() => {
        if (!isLive) {
            return;
        }

        const appendTimer = setInterval(() => {
            setItems((current) => appendActivityItems(current, 1));
        }, 2400);
        const settleTimer = setInterval(() => {
            setItems((current) => settlePendingActivityItems(current, 1));
        }, 1600);

        return () => {
            clearInterval(appendTimer);
            clearInterval(settleTimer);
        };
    }, [isLive]);

    useEffect(() => {
        updateMaintainAtEndState();
    }, [items, updateMaintainAtEndState]);

    return (
        <View style={styles.safeArea}>
            <View style={styles.toolbar}>
                <Pressable
                    onPress={() => setIsLive((current) => !current)}
                    style={[styles.button, isLive && styles.buttonActive]}
                >
                    <Text style={[styles.buttonText, isLive && styles.buttonTextActive]}>
                        {isLive ? "Pause live" : "Resume live"}
                    </Text>
                </Pressable>
                <Text style={styles.liveSummary}>
                    {isLive ? "Posting every 2.4s" : "Live feed paused"} · {pendingCount} pending ·{" "}
                    {isMaintainingAtEnd ? "Maintaining at end" : "Not maintaining at end"}
                </Text>
            </View>
            <LegendList<ActivityHistoryRow>
                contentContainerStyle={styles.listContent}
                data={timeline.rows}
                estimatedItemSize={118}
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                maintainVisibleContentPosition
                onLoad={updateMaintainAtEndState}
                onScroll={updateMaintainAtEndState}
                onStartReached={() => setItems((current) => prependActivityItems(current, 12))}
                onStartReachedThreshold={0.2}
                ref={listRef}
                renderItem={({ item }) =>
                    item.type === "header" ? (
                        <View style={styles.headerRow}>
                            <Text style={styles.headerTitle}>{item.title}</Text>
                            <Text style={styles.headerMeta}>
                                {item.totalLabel}
                                {item.pendingCount > 0 ? ` · ${item.pendingCount} pending` : ""}
                            </Text>
                        </View>
                    ) : (
                        <Pressable
                            onPress={() =>
                                setExpandedIds((current) =>
                                    current.includes(item.item.id)
                                        ? current.filter((value) => value !== item.item.id)
                                        : [...current, item.item.id],
                                )
                            }
                            style={[
                                styles.row,
                                item.item.status === "pending"
                                    ? styles.rowPending
                                    : item.item.status === "reversed"
                                      ? styles.rowReversed
                                      : item.item.kind === "credit"
                                        ? styles.rowCredit
                                        : undefined,
                            ]}
                        >
                            <View style={styles.rowHeader}>
                                <View style={styles.rowCopy}>
                                    <Text style={styles.rowTitle}>{item.item.summary}</Text>
                                    <Text style={styles.rowMeta}>
                                        {item.item.merchant} · {item.item.categoryLabel} · {item.item.timeLabel}
                                    </Text>
                                </View>
                                <Text
                                    style={[styles.amount, item.item.kind === "credit" ? styles.credit : styles.debit]}
                                >
                                    {item.item.amountLabel}
                                </Text>
                            </View>
                            <View style={styles.badgeRow}>
                                <View
                                    style={[
                                        styles.statusBadge,
                                        item.item.status === "pending"
                                            ? styles.statusPending
                                            : item.item.status === "reversed"
                                              ? styles.statusReversed
                                              : styles.statusPosted,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusBadgeText,
                                            item.item.status === "pending"
                                                ? styles.statusPendingText
                                                : item.item.status === "reversed"
                                                  ? styles.statusReversedText
                                                  : styles.statusPostedText,
                                        ]}
                                    >
                                        {item.item.status}
                                    </Text>
                                </View>
                                <Text style={styles.expandLabel}>
                                    {expandedIds.includes(item.item.id) ? "Hide details" : "Show details"}
                                </Text>
                            </View>
                            {expandedIds.includes(item.item.id) ? (
                                <View style={styles.details}>
                                    {item.item.detailLines.map((line, index) => (
                                        <Text key={`${item.item.id}-${index}`} style={styles.detailText}>
                                            {line}
                                        </Text>
                                    ))}
                                </View>
                            ) : null}
                        </Pressable>
                    )
                }
                stickyHeaderIndices={timeline.stickyHeaderIndices}
                style={{ flex: 1 }}
            />
        </View>
    );
}
