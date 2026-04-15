import type * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { CalendarMonth } from "../../../examples-shared/calendar";
import { buildCalendarMonthRange, shiftCalendarMonthId } from "../../../examples-shared/calendar";
import type { ChatAttachment } from "../../../examples-shared/chat";
import type { ProductCard, ProductShelfSection } from "../../../examples-shared/commerce";

export type ShelfRow =
    | { id: string; subtitle: string; title: string; type: "header" }
    | ({ badge: string; type: "product" } & ProductCard);

export type CalendarMode = "horizontal" | "vertical";

export const CALENDAR_INITIAL_SPAN = 12;
export const CALENDAR_PAGE_SIZE = 6;

export const AI_SUGGESTIONS = [
    {
        label: "Stable anchors",
        prompt: "Summarize why stable anchors matter for chat UIs.",
    },
    {
        label: "Mixed heights",
        prompt: "Explain how mixed row heights affect virtualization.",
    },
    {
        label: "Visible content",
        prompt: "Describe when to use maintainVisibleContentPosition.",
    },
] as const;

export function buildShelfRows(sections: ProductShelfSection[]) {
    const rows: ShelfRow[] = [];
    const stickyHeaderIndices: number[] = [];

    for (const section of sections) {
        stickyHeaderIndices.push(rows.length);
        rows.push({
            id: `${section.id}-header`,
            subtitle: `${section.items.length} curated picks`,
            title: section.title,
            type: "header",
        });

        for (const [index, item] of section.items.entries()) {
            rows.push({
                ...item,
                badge: index % 2 === 0 ? "Ready to ship" : "Popular",
                type: "product",
            });
        }
    }

    return { rows, stickyHeaderIndices };
}

export function monthIndex(months: CalendarMonth[], activeMonthId: string) {
    const index = months.findIndex((month) => month.id === activeMonthId);
    return index === -1 ? 0 : index;
}

export function prependCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[0]!.id, -count);
    return [...buildCalendarMonthRange(startMonthId, count, today), ...months];
}

export function appendCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[months.length - 1]!.id, 1);
    return [...months, ...buildCalendarMonthRange(startMonthId, count, today)];
}

export function Shell({ children }: { children: React.ReactNode }) {
    return <View style={styles.shell}>{children}</View>;
}

export function ChatAttachmentCard({ attachment, dark }: { attachment: ChatAttachment; dark?: boolean }) {
    return (
        <View
            style={[
                styles.chatAttachment,
                {
                    backgroundColor: attachment.accent,
                    height: attachment.height,
                },
            ]}
        >
            <View style={styles.chatAttachmentScrim} />
            <Text style={[styles.chatAttachmentLabel, dark && styles.chatAttachmentLabelDark]}>{attachment.label}</Text>
            <Text style={[styles.chatAttachmentSubtitle, dark && styles.chatAttachmentSubtitleDark]}>
                {attachment.subtitle}
            </Text>
        </View>
    );
}

export function MonthCard({ month }: { month: CalendarMonth }) {
    return (
        <View style={styles.calendarCard}>
            <Text style={styles.sectionTitle}>{month.label}</Text>
            {month.weeks.map((week, weekIndex) => (
                <View key={`${month.id}-${weekIndex}`} style={styles.weekRow}>
                    {week.map((day) => (
                        <View
                            key={day.dateKey}
                            style={[
                                styles.dayCell,
                                !day.isCurrentMonth && styles.dayCellMuted,
                                day.isToday && styles.dayCellToday,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.dayText,
                                    !day.isCurrentMonth && styles.dayTextMuted,
                                    day.isToday && styles.dayTextToday,
                                ]}
                            >
                                {day.dayNumber}
                            </Text>
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
}

export const styles = StyleSheet.create({
    activityAmount: {
        fontWeight: "700",
    },
    activityBadgeRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
        marginTop: 10,
    },
    activityCreditCard: {
        borderColor: "#86EFAC",
        borderWidth: 1,
    },
    activityDetails: {
        gap: 8,
        marginTop: 12,
    },
    activityDetailText: {
        color: "#334155",
        lineHeight: 20,
    },
    activityHeader: {
        backgroundColor: "#E2E8F0",
        borderColor: "#CBD5E1",
        borderRadius: 0,
        borderWidth: 1,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    activityHeaderMeta: {
        color: "#475569",
        fontSize: 12,
        marginTop: 4,
    },
    activityHeaderTitle: {
        color: "#111827",
        fontSize: 15,
        fontWeight: "800",
    },
    activityLiveSummary: {
        color: "#64748B",
        flexShrink: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    activityPending: {
        borderColor: "#F59E0B",
        borderWidth: 1,
    },
    activityReversed: {
        borderColor: "#FCA5A5",
        borderWidth: 1,
    },
    activityRowCopy: {
        flex: 1,
        marginRight: 12,
    },
    activityRowHeader: {
        alignItems: "flex-start",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    activityStatusBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    activityStatusPending: {
        backgroundColor: "#FEF3C7",
    },
    activityStatusPendingText: {
        color: "#92400E",
    },
    activityStatusPosted: {
        backgroundColor: "#DCFCE7",
    },
    activityStatusPostedText: {
        color: "#166534",
    },
    activityStatusReversed: {
        backgroundColor: "#FEE2E2",
    },
    activityStatusReversedText: {
        color: "#991B1B",
    },
    activityStatusText: {
        fontSize: 12,
        fontWeight: "700",
        textTransform: "capitalize",
    },
    avatar: {
        alignItems: "center",
        borderRadius: 999,
        height: 42,
        justifyContent: "center",
        width: 42,
    },
    avatarText: {
        color: "#fff",
        fontWeight: "800",
    },
    body: {
        color: "#111827",
        lineHeight: 20,
    },
    bubble: {
        borderRadius: 18,
        marginBottom: 12,
        maxWidth: "84%",
        padding: 14,
    },
    button: {
        backgroundColor: "#FFFFFF",
        borderColor: "#CBD5E1",
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    buttonActive: {
        backgroundColor: "#111827",
        borderColor: "#111827",
    },
    buttonText: {
        color: "#111827",
        fontWeight: "700",
    },
    buttonTextActive: {
        color: "#FFFFFF",
    },
    calendarCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        marginBottom: 16,
        padding: 18,
    },
    calendarCardHorizontal: {
        marginRight: 16,
        width: 320,
    },
    chatAttachment: {
        borderRadius: 16,
        justifyContent: "flex-end",
        marginBottom: 10,
        overflow: "hidden",
        padding: 12,
        width: 220,
    },
    chatAttachmentLabel: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    chatAttachmentLabelDark: {
        color: "#E0F2FE",
    },
    chatAttachmentScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(15, 23, 42, 0.14)",
    },
    chatAttachmentSubtitle: {
        color: "#FFFFFF",
        fontSize: 20,
        fontWeight: "800",
        marginTop: 6,
    },
    chatAttachmentSubtitleDark: {
        color: "#F8FAFC",
    },
    columnWrapper: {
        gap: 12,
    },
    composerInput: {
        backgroundColor: "#FFFFFF",
        borderColor: "#CBD5E1",
        borderRadius: 16,
        borderWidth: 1,
        color: "#111827",
        flex: 1,
        minHeight: 44,
        paddingHorizontal: 14,
    },
    composerRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    creditText: {
        color: "#0F766E",
    },
    dayCell: {
        alignItems: "center",
        backgroundColor: "#E5E7EB",
        borderRadius: 10,
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
    dayTextToday: {
        color: "#FFFFFF",
    },
    debitText: {
        color: "#9A3412",
    },
    feedActionRow: {
        alignItems: "center",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 16,
    },
    feedAvatar: {
        alignItems: "center",
        backgroundColor: "#DBEAFE",
        borderRadius: 999,
        height: 36,
        justifyContent: "center",
        width: 36,
    },
    feedAvatarText: {
        color: "#1D4ED8",
        fontWeight: "800",
    },
    feedCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        marginBottom: 12,
        padding: 16,
    },
    feedCategoryChip: {
        alignSelf: "flex-start",
        backgroundColor: "#F8FAFC",
        borderRadius: 999,
        marginBottom: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    feedCategoryChipText: {
        color: "#334155",
        fontSize: 12,
        fontWeight: "700",
    },
    feedEventBadge: {
        backgroundColor: "#DCFCE7",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    feedEventBadgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
    },
    feedEventBadgeText: {
        color: "#166534",
        fontSize: 12,
        fontWeight: "700",
    },
    feedExpandedBody: {
        color: "#334155",
        lineHeight: 22,
        marginTop: 14,
    },
    feedHeader: {
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
    },
    feedKindBadge: {
        backgroundColor: "#EEF2FF",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    feedKindBadgeText: {
        color: "#4338CA",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "capitalize",
    },
    feedMediaCard: {
        borderRadius: 18,
        justifyContent: "flex-end",
        marginBottom: 12,
        padding: 14,
    },
    feedMediaLabel: {
        color: "#0F172A",
        fontSize: 12,
        fontWeight: "800",
        opacity: 0.72,
        textTransform: "uppercase",
    },
    feedMediaSubtitle: {
        color: "#0F172A",
        marginTop: 6,
        maxWidth: 260,
        opacity: 0.78,
    },
    feedMediaTitle: {
        color: "#0F172A",
        fontSize: 20,
        fontWeight: "800",
        marginTop: 6,
    },
    feedPollList: {
        gap: 10,
        marginTop: 14,
    },
    feedPollOption: {
        backgroundColor: "#F8FAFC",
        borderColor: "#E2E8F0",
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
    },
    feedPollOptionLabel: {
        color: "#0F172A",
        fontWeight: "700",
    },
    feedPollOptionSelected: {
        backgroundColor: "#DBEAFE",
        borderColor: "#60A5FA",
    },
    feedPollOptionVotes: {
        color: "#64748B",
        fontSize: 12,
        marginTop: 4,
    },
    feedQuoteCard: {
        backgroundColor: "#F8FAFC",
        borderLeftWidth: 4,
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
    },
    feedQuoteText: {
        color: "#0F172A",
        fontSize: 20,
        fontWeight: "700",
        lineHeight: 30,
        marginBottom: 10,
    },
    galleryCard: {
        borderRadius: 18,
        justifyContent: "flex-end",
        marginBottom: 12,
        minHeight: 140,
        padding: 14,
    },
    headerRow: {
        backgroundColor: "#E2E8F0",
        borderRadius: 0,
        marginBottom: 8,
        padding: 10,
    },
    headerText: {
        color: "#111827",
        fontWeight: "800",
    },
    list: {
        padding: 16,
    },
    otherBubble: {
        alignSelf: "flex-start",
        backgroundColor: "#FFFFFF",
    },
    personCopy: {
        flex: 1,
        gap: 2,
    },
    personMeta: {
        color: "#64748B",
        fontSize: 13,
    },
    personName: {
        color: "#111827",
        fontWeight: "800",
    },
    personRow: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
        padding: 14,
    },
    posterCard: {
        borderRadius: 18,
        height: 180,
        justifyContent: "flex-end",
        marginRight: 12,
        padding: 14,
        width: 130,
    },
    posterSubtitle: {
        color: "#FFFFFF",
        opacity: 0.85,
    },
    posterTitle: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "800",
    },
    productBadge: {
        color: "#111827",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    productCard: {
        borderRadius: 18,
        flex: 1,
        justifyContent: "space-between",
        marginBottom: 12,
        minHeight: 140,
        padding: 14,
    },
    productPrice: {
        color: "#111827",
        fontWeight: "700",
        marginTop: 4,
    },
    productTitle: {
        color: "#111827",
        fontWeight: "800",
    },
    promptBubble: {
        alignSelf: "flex-end",
        backgroundColor: "#111827",
    },
    promptText: {
        color: "#FFFFFF",
    },
    railContent: {
        paddingRight: 16,
    },
    railSection: {
        marginBottom: 20,
    },
    responseBubble: {
        alignSelf: "flex-start",
        backgroundColor: "#FFFFFF",
    },
    search: {
        backgroundColor: "#FFFFFF",
        borderColor: "#E5E7EB",
        borderRadius: 16,
        borderWidth: 1,
        color: "#111827",
        fontSize: 14,
        margin: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    secondaryButton: {
        backgroundColor: "#E2E8F0",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    secondaryButtonText: {
        color: "#0F172A",
        fontSize: 12,
        fontWeight: "700",
    },
    sectionTitle: {
        color: "#111827",
        fontSize: 18,
        fontWeight: "800",
        marginBottom: 8,
    },
    selfBubble: {
        alignSelf: "flex-end",
        backgroundColor: "#DBEAFE",
    },
    sender: {
        color: "#111827",
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 4,
    },
    shelfHeader: {
        backgroundColor: "#FFFFFF",
        borderRadius: 0,
        marginBottom: 12,
        padding: 14,
    },
    shell: {
        backgroundColor: "#F6F3EE",
        flex: 1,
        minHeight: 0,
    },
    timestamp: {
        color: "#64748B",
        fontSize: 12,
        marginTop: 8,
    },
    toolbar: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    unread: {
        borderColor: "#C7D2FE",
        borderWidth: 1,
    },
    videoBody: {
        color: "#FFFFFF",
        fontSize: 16,
        opacity: 0.9,
    },
    videoCreator: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 8,
        opacity: 0.85,
    },
    videoShell: {
        flex: 1,
    },
    videoSlide: {
        justifyContent: "flex-end",
        padding: 24,
    },
    videoTitle: {
        color: "#FFFFFF",
        fontSize: 32,
        fontWeight: "800",
        marginBottom: 8,
    },
    weekRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8,
    },
});
