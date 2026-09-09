import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListItemSeparatorProps } from "@legendapp/list/react-native";
import {
    buildTimelineEntries,
    cycleTimelineEntryKind,
    TIMELINE_KIND_COLORS,
    TIMELINE_KIND_LABELS,
    TIMELINE_KINDS,
    type TimelineEntry,
} from "../../../examples-shared/timeline";
import { Shell, styles } from "./shared";

// Entries of the same kind are joined by a hairline in their shared color, while a change of kind
// gets a thicker bar split between the color of the item above and the item below it.
function TimelineSeparator({ leadingItem, trailingItem }: LegendListItemSeparatorProps<TimelineEntry>) {
    const leadingColor = TIMELINE_KIND_COLORS[leadingItem.kind];

    if (!trailingItem || trailingItem.kind === leadingItem.kind) {
        return <View style={[local.separatorSame, { backgroundColor: leadingColor }]} />;
    }

    return (
        <View style={local.separatorBoundary}>
            <View style={[local.separatorHalf, { backgroundColor: leadingColor }]} />
            <View style={[local.separatorHalf, { backgroundColor: TIMELINE_KIND_COLORS[trailingItem.kind] }]} />
        </View>
    );
}

export function ItemSeparatorsExample() {
    const [entries, setEntries] = useState(() => buildTimelineEntries());

    const cycleKind = useCallback((id: string) => {
        setEntries((current) => cycleTimelineEntryKind(current, id));
    }, []);

    const renderItem = useCallback(
        ({ item }: { item: TimelineEntry }) => (
            <Pressable onPress={() => cycleKind(item.id)} style={local.row}>
                <View style={[local.rowBadge, { backgroundColor: TIMELINE_KIND_COLORS[item.kind] }]} />
                <View style={styles.personCopy}>
                    <Text style={styles.personName}>{item.title}</Text>
                    <Text style={styles.personMeta}>
                        {TIMELINE_KIND_LABELS[item.kind]} · {item.meta}
                    </Text>
                </View>
                <Text style={local.rowAction}>Change kind</Text>
            </Pressable>
        ),
        [cycleKind],
    );

    return (
        <Shell>
            <View style={local.legend}>
                {TIMELINE_KINDS.map((kind) => (
                    <View key={kind} style={local.legendEntry}>
                        <View style={[local.legendSwatch, { backgroundColor: TIMELINE_KIND_COLORS[kind] }]} />
                        <Text style={local.legendLabel}>{TIMELINE_KIND_LABELS[kind]}</Text>
                    </View>
                ))}
            </View>
            <Text style={local.hint}>
                Tap an entry to change its kind. The separator above it recolors too, because separators re-render when
                their trailing item changes.
            </Text>
            <LegendList
                contentContainerStyle={styles.list}
                data={entries}
                estimatedItemSize={72}
                ItemSeparatorComponent={TimelineSeparator}
                keyExtractor={(item) => item.id}
                recycleItems
                renderItem={renderItem}
                style={styles.fill}
            />
        </Shell>
    );
}

const local = StyleSheet.create({
    hint: {
        color: "#64748B",
        fontSize: 13,
        lineHeight: 18,
        paddingBottom: 12,
        paddingHorizontal: 16,
    },
    legend: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        paddingBottom: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    legendEntry: {
        alignItems: "center",
        flexDirection: "row",
        gap: 6,
    },
    legendLabel: {
        color: "#334155",
        fontSize: 12,
    },
    legendSwatch: {
        borderRadius: 3,
        height: 12,
        width: 12,
    },
    row: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    rowAction: {
        color: "#94A3B8",
        fontSize: 11,
        marginLeft: "auto",
    },
    rowBadge: {
        borderRadius: 6,
        height: 12,
        width: 12,
    },
    separatorBoundary: {
        flexDirection: "row",
        height: 6,
    },
    separatorHalf: {
        flex: 1,
    },
    separatorSame: {
        height: 1,
        opacity: 0.35,
    },
});
