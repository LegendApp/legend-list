import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import {
    buildCalendarMonths,
    type CalendarMonth,
    getCalendarMonthId,
    shiftCalendarMonthId,
} from "../../../examples-shared/calendar";
import {
    appendCalendarMonths,
    CALENDAR_INITIAL_SPAN,
    CALENDAR_PAGE_SIZE,
    type CalendarMode,
    monthIndex,
    prependCalendarMonths,
} from "./shared";

const styles = StyleSheet.create({
    controls: {
        flexDirection: "row",
        gap: 10,
    },
    controlsContainer: {
        gap: 10,
        paddingBottom: 12,
        paddingHorizontal: 20,
        paddingTop: 18,
    },
    dayCell: {
        alignItems: "center",
        borderRadius: 12,
        flex: 1,
        justifyContent: "center",
        minHeight: 42,
    },
    dayCellMuted: {
        opacity: 0.45,
    },
    dayCellToday: {
        backgroundColor: "#111827",
    },
    dayText: {
        color: "#111827",
        fontWeight: "700",
    },
    dayTextMuted: {
        color: "#6B7280",
    },
    listContent: {
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    modePill: {
        backgroundColor: "#E5E7EB",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    modePillActive: {
        backgroundColor: "#111827",
    },
    modeText: {
        color: "#111827",
        fontWeight: "700",
        textTransform: "capitalize",
    },
    modeTextActive: {
        color: "#FFFFFF",
    },
    monthCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        marginBottom: 16,
        padding: 18,
    },
    monthCardHorizontal: {
        marginRight: 16,
        width: 320,
    },
    monthTitle: {
        color: "#111827",
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 16,
    },
    navPill: {
        backgroundColor: "#FFFFFF",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    navText: {
        color: "#111827",
        fontWeight: "700",
    },
    safeArea: {
        backgroundColor: "#F3F4F6",
        flex: 1,
    },
    weekRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8,
    },
});

export function InfiniteCalendarExample() {
    const today = useMemo(() => new Date(), []);
    const todayMonthId = useMemo(() => getCalendarMonthId(today), [today]);
    const [months, setMonths] = useState(() => buildCalendarMonths(today, CALENDAR_INITIAL_SPAN, today));
    const [mode, setMode] = useState<CalendarMode>("vertical");
    const [activeMonthId, setActiveMonthId] = useState(todayMonthId);
    const listRef = useRef<LegendListRef>(null);
    const pendingScrollTargetRef = useRef<string | null>(null);
    const activeIndex = monthIndex(months, activeMonthId);

    useEffect(() => {
        pendingScrollTargetRef.current = activeMonthId;
    }, [mode]);

    useEffect(() => {
        const pendingTarget = pendingScrollTargetRef.current;
        if (!pendingTarget) {
            return;
        }

        const index = monthIndex(months, pendingTarget);
        const frame = requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0 });
            pendingScrollTargetRef.current = null;
        });

        return () => cancelAnimationFrame(frame);
    }, [activeMonthId, mode, months]);

    const ensureMonthVisible = (targetMonthId: string) => {
        pendingScrollTargetRef.current = targetMonthId;
        setMonths((current) => {
            let next = current;

            while (targetMonthId < next[0]!.id) {
                next = prependCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
            }

            while (targetMonthId > next[next.length - 1]!.id) {
                next = appendCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
            }

            return next;
        });
        setActiveMonthId(targetMonthId);
    };

    const loadOlder = () => {
        setMonths((current) => prependCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    };

    const loadNewer = () => {
        setMonths((current) => appendCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    };

    return (
        <View style={styles.safeArea}>
            <View style={styles.controlsContainer}>
                <View style={styles.controls}>
                    {(["vertical", "horizontal"] as const).map((value) => (
                        <Pressable
                            key={value}
                            onPress={() => setMode(value)}
                            style={[styles.modePill, mode === value && styles.modePillActive]}
                        >
                            <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value}</Text>
                        </Pressable>
                    ))}
                </View>
                <View style={styles.controls}>
                    <Pressable
                        onPress={() => ensureMonthVisible(shiftCalendarMonthId(activeMonthId, -1))}
                        style={styles.navPill}
                    >
                        <Text style={styles.navText}>Prev</Text>
                    </Pressable>
                    <Pressable onPress={() => ensureMonthVisible(todayMonthId)} style={styles.navPill}>
                        <Text style={styles.navText}>Today</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => ensureMonthVisible(shiftCalendarMonthId(activeMonthId, 1))}
                        style={styles.navPill}
                    >
                        <Text style={styles.navText}>Next</Text>
                    </Pressable>
                </View>
            </View>
            <LegendList
                contentContainerStyle={styles.listContent}
                data={months}
                estimatedItemSize={mode === "horizontal" ? 360 : 420}
                horizontal={mode === "horizontal"}
                initialScrollIndex={activeIndex}
                key={mode}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                onEndReached={loadNewer}
                onEndReachedThreshold={0.25}
                onStartReached={loadOlder}
                onStartReachedThreshold={0.25}
                onViewableItemsChanged={({ viewableItems }) => {
                    const nextActive = viewableItems[0]?.item as CalendarMonth | undefined;
                    if (nextActive?.id && pendingScrollTargetRef.current == null) {
                        setActiveMonthId((current) => (current === nextActive.id ? current : nextActive.id));
                    }
                }}
                pagingEnabled={false}
                ref={listRef}
                renderItem={({ item }) => (
                    <View style={[styles.monthCard, mode === "horizontal" && styles.monthCardHorizontal]}>
                        <Text style={styles.monthTitle}>{item.label}</Text>
                        {item.weeks.map((week, weekIndex) => (
                            <View key={`${item.id}-${weekIndex}`} style={styles.weekRow}>
                                {week.map((day) => (
                                    <View
                                        key={day.dateKey}
                                        style={[
                                            styles.dayCell,
                                            !day.isCurrentMonth && styles.dayCellMuted,
                                            day.isToday && styles.dayCellToday,
                                        ]}
                                    >
                                        <Text style={[styles.dayText, !day.isCurrentMonth && styles.dayTextMuted]}>
                                            {day.dayNumber}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                )}
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
            />
        </View>
    );
}
