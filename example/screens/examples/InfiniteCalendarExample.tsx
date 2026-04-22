import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { buildCalendarMonths, getCalendarMonthId, shiftCalendarMonthId } from "../../../examples-shared/calendar";
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
    const listRef = useRef<LegendListRef>(null);
    const monthsRef = useRef(months);
    const activeIndex = monthIndex(months, todayMonthId);
    monthsRef.current = months;

    const scheduleScrollToMonth = (targetMonthId: string, animated: boolean) => {
        let attempts = 0;

        const run = () => {
            const currentMonths = monthsRef.current;
            const index = currentMonths.findIndex((month) => month.id === targetMonthId);
            if (!listRef.current || index === -1) {
                if (attempts < 12) {
                    attempts += 1;
                    requestAnimationFrame(run);
                }
                return;
            }

            listRef.current.scrollToIndex({
                animated,
                index,
                viewPosition: 0.5,
            });
        };

        requestAnimationFrame(run);
    };

    const getCenteredMonthId = () => {
        const state = listRef.current?.getState();
        const currentMonths = monthsRef.current;
        if (!state || currentMonths.length === 0) {
            return todayMonthId;
        }

        const start = Math.max(0, Math.min(currentMonths.length - 1, state.start));
        const end = Math.max(start, Math.min(currentMonths.length - 1, state.end));
        const viewportCenter = state.scroll + state.scrollLength / 2;
        let closestIndex: number | undefined;
        let closestDistance = Number.POSITIVE_INFINITY;

        for (let index = start; index <= end; index += 1) {
            const position = state.positionAtIndex(index);
            const size = state.sizeAtIndex(index);
            if (!Number.isFinite(position) || !Number.isFinite(size) || size <= 0) {
                continue;
            }

            const distance = Math.abs(position + size / 2 - viewportCenter);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        }

        const fallbackIndex = closestIndex ?? Math.floor((start + end) / 2);
        return currentMonths[fallbackIndex]?.id ?? todayMonthId;
    };

    const ensureMonthVisible = (targetMonthId: string) => {
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
        scheduleScrollToMonth(targetMonthId, true);
    };

    const switchMode = (nextMode: CalendarMode) => {
        setMonths((current) => {
            let next = current;

            while (todayMonthId < next[0]!.id) {
                next = prependCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
            }

            while (todayMonthId > next[next.length - 1]!.id) {
                next = appendCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
            }

            return next;
        });
        setMode(nextMode);
        scheduleScrollToMonth(todayMonthId, false);
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
                            onPress={() => switchMode(value)}
                            style={[styles.modePill, mode === value && styles.modePillActive]}
                        >
                            <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value}</Text>
                        </Pressable>
                    ))}
                </View>
                <View style={styles.controls}>
                    <Pressable
                        onPress={() => ensureMonthVisible(shiftCalendarMonthId(getCenteredMonthId(), -1))}
                        style={styles.navPill}
                    >
                        <Text style={styles.navText}>Prev</Text>
                    </Pressable>
                    <Pressable onPress={() => ensureMonthVisible(todayMonthId)} style={styles.navPill}>
                        <Text style={styles.navText}>Today</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => ensureMonthVisible(shiftCalendarMonthId(getCenteredMonthId(), 1))}
                        style={styles.navPill}
                    >
                        <Text style={styles.navText}>Next</Text>
                    </Pressable>
                </View>
            </View>
            <LegendList
                contentContainerStyle={styles.listContent}
                data={months}
                estimatedItemSize={mode === "horizontal" ? 336 : 420}
                horizontal={mode === "horizontal"}
                initialScrollIndex={activeIndex}
                key={mode}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                onEndReached={loadNewer}
                onEndReachedThreshold={0.25}
                onStartReached={loadOlder}
                onStartReachedThreshold={0.25}
                pagingEnabled={false}
                recycleItems
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
