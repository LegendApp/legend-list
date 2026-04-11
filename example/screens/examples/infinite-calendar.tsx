import { useEffect, useMemo, useRef, useState } from "react";
import { Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { buildCalendarMonths, type CalendarMonth } from "@examples/calendar";

type CalendarMode = "horizontal" | "vertical";

function getMonthIndex(months: CalendarMonth[], monthId: string) {
    const index = months.findIndex((month) => month.id === monthId);
    return index === -1 ? 0 : index;
}

export default function InfiniteCalendarScreen() {
    const months = useMemo(() => buildCalendarMonths(new Date(), 10), []);
    const [mode, setMode] = useState<CalendarMode>("vertical");
    const [activeMonthId, setActiveMonthId] = useState(months[10]?.id ?? months[0]!.id);
    const listRef = useRef<LegendListRef>(null);

    useEffect(() => {
        const index = getMonthIndex(months, activeMonthId);
        requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0 });
        });
    }, [activeMonthId, mode, months]);

    const jumpBy = (delta: number) => {
        const index = Math.max(0, Math.min(months.length - 1, getMonthIndex(months, activeMonthId) + delta));
        setActiveMonthId(months[index]!.id);
    };

    return (
        <>
            <Stack.Screen options={{ headerTitle: "Infinite Calendar", headerTransparent: false }} />
            <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.title}>Infinite Calendar</Text>
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
                        <Pressable onPress={() => jumpBy(-1)} style={styles.navPill}>
                            <Text style={styles.navText}>Prev</Text>
                        </Pressable>
                        <Pressable onPress={() => setActiveMonthId(months[10]!.id)} style={styles.navPill}>
                            <Text style={styles.navText}>Today</Text>
                        </Pressable>
                        <Pressable onPress={() => jumpBy(1)} style={styles.navPill}>
                            <Text style={styles.navText}>Next</Text>
                        </Pressable>
                    </View>
                </View>
                <LegendList
                    contentContainerStyle={styles.listContent}
                    data={months}
                    estimatedItemSize={mode === "horizontal" ? 360 : 420}
                    horizontal={mode === "horizontal"}
                    keyExtractor={(item) => item.id}
                    pagingEnabled={mode === "horizontal"}
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
                />
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    controls: {
        flexDirection: "row",
        gap: 10,
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
    header: {
        gap: 14,
        paddingHorizontal: 20,
        paddingTop: 18,
    },
    listContent: {
        padding: 20,
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
    title: {
        color: "#111827",
        fontSize: 28,
        fontWeight: "800",
    },
    weekRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8,
    },
});
