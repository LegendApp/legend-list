import { useCallback, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import type { LegendListRef, LegendListRenderItemProps } from "@legendapp/list/react-native";
import { AnimatedLegendList, type AnimatedLegendListSharedValues } from "@legendapp/list/reanimated";
import { DemoButton, DemoControlRow, DemoHint } from "~/components/DemoControls";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";

type SharedValueItem = {
    id: string;
    title: string;
};

type BooleanListSharedValue = NonNullable<AnimatedLegendListSharedValues["isAtEnd"]>;
type NumberListSharedValue = NonNullable<AnimatedLegendListSharedValues["scrollOffset"]>;

function createItems(count: number): SharedValueItem[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `shared-value-${index}`,
        title: `Animated row ${index}`,
    }));
}

function keyExtractor(item: SharedValueItem) {
    return item.id;
}

function getFixedItemSize() {
    return 72;
}

function ReanimatedHint() {
    return (
        <DemoHint>
            Scroll drives progress and boundary SharedValues without React rerenders; only reassigned rows render.
            Append near the end to test end-follow.
        </DemoHint>
    );
}

function SharedValueRow({ item, metrics }: { item: SharedValueItem; metrics: DemoMetricStore }) {
    metrics.increment("rowRenders");
    return (
        <View style={styles.row}>
            <View style={styles.rowIcon} />
            <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>Scroll updates SharedValues without updating this row.</Text>
            </View>
        </View>
    );
}

function BooleanChip({ label, value }: { label: string; value: BooleanListSharedValue }) {
    const animatedStyle = useAnimatedStyle(() => ({
        backgroundColor: value.value ? "#16A34A" : "#334155",
        opacity: value.value ? 1 : 0.58,
    }));

    return (
        <Reanimated.View style={[styles.chip, animatedStyle]}>
            <Text style={styles.chipText}>{label}</Text>
        </Reanimated.View>
    );
}

function SharedValueStatus({
    isAtEnd,
    isAtStart,
    isNearEnd,
    isNearStart,
    isWithinMaintainScrollAtEndThreshold,
    maxScrollOffset,
    scrollOffset,
}: Required<Omit<AnimatedLegendListSharedValues, "activeStickyIndex">> & {
    maxScrollOffset: NumberListSharedValue;
}) {
    const trackWidth = useSharedValue(0);
    const progressStyle = useAnimatedStyle(() => {
        const progress = isAtEnd.value
            ? 1
            : maxScrollOffset.value > 0
              ? Math.max(0, Math.min(1, scrollOffset.value / maxScrollOffset.value))
              : 0;
        return {
            width: trackWidth.value * progress,
        };
    });
    const jumpStyle = useAnimatedStyle(() => ({
        opacity: isNearEnd.value ? 0.35 : 1,
        transform: [{ translateY: isNearEnd.value ? 4 : 0 }],
    }));

    return (
        <View style={styles.sharedPanel}>
            <View
                onLayout={(event) => {
                    trackWidth.value = event.nativeEvent.layout.width;
                }}
                style={styles.progressTrack}
            >
                <Reanimated.View style={[styles.progressFill, progressStyle]} />
            </View>
            <View style={styles.chips}>
                <BooleanChip label="At start" value={isAtStart} />
                <BooleanChip label="Near start" value={isNearStart} />
                <BooleanChip label="Near end" value={isNearEnd} />
                <BooleanChip label="At end" value={isAtEnd} />
                <BooleanChip label="Follow threshold" value={isWithinMaintainScrollAtEndThreshold} />
            </View>
            <Reanimated.View style={jumpStyle}>
                <Text style={styles.jumpHint}>Jump-to-latest affordance</Text>
            </Reanimated.View>
        </View>
    );
}

export function ReanimatedSharedValuesExample() {
    const metrics = useDemoMetricStore([
        { id: "parentRenders", initialValue: 0, label: "Parent renders" },
        { id: "rowRenders", initialValue: 0, label: "Row renders" },
        { id: "bridge", initialValue: "Worklets", label: "Scroll UI" },
    ]);
    const listRef = useRef<LegendListRef>(null);
    const [data, setData] = useState(() => createItems(80));
    const scrollOffset = useSharedValue(0);
    const isAtStart = useSharedValue(true);
    const isAtEnd = useSharedValue(false);
    const isNearStart = useSharedValue(true);
    const isNearEnd = useSharedValue(false);
    const isWithinMaintainScrollAtEndThreshold = useSharedValue(false);
    const contentHeight = useSharedValue(0);
    const viewportHeight = useSharedValue(0);
    const maxScrollOffset = useSharedValue(0);
    const sharedValues = useMemo<AnimatedLegendListSharedValues>(
        () => ({
            isAtEnd,
            isAtStart,
            isNearEnd,
            isNearStart,
            isWithinMaintainScrollAtEndThreshold,
            scrollOffset,
        }),
        [isAtEnd, isAtStart, isNearEnd, isNearStart, isWithinMaintainScrollAtEndThreshold, scrollOffset],
    );
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<SharedValueItem>) => <SharedValueRow item={item} metrics={metrics} />,
        [metrics],
    );
    const updateMaxScrollOffset = useCallback(() => {
        maxScrollOffset.value = Math.max(0, contentHeight.value - viewportHeight.value);
    }, [contentHeight, maxScrollOffset, viewportHeight]);
    const onContentSizeChange = useCallback(
        (_width: number, height: number) => {
            contentHeight.value = height;
            updateMaxScrollOffset();
        },
        [contentHeight, updateMaxScrollOffset],
    );
    const onListLayout = useCallback(
        (event: LayoutChangeEvent) => {
            viewportHeight.value = event.nativeEvent.layout.height;
            updateMaxScrollOffset();
        },
        [updateMaxScrollOffset, viewportHeight],
    );
    metrics.increment("parentRenders");

    const appendItem = () => {
        setData((current) => [
            ...current,
            { id: `shared-value-${current.length}`, title: `Appended row ${current.length}` },
        ]);
    };

    return (
        <View style={styles.screen}>
            <DemoStatsBar store={metrics} />
            <SharedValueStatus
                isAtEnd={isAtEnd}
                isAtStart={isAtStart}
                isNearEnd={isNearEnd}
                isNearStart={isNearStart}
                isWithinMaintainScrollAtEndThreshold={isWithinMaintainScrollAtEndThreshold}
                maxScrollOffset={maxScrollOffset}
                scrollOffset={scrollOffset}
            />
            <DemoControlRow>
                <DemoButton label="Jump to end" onPress={() => listRef.current?.scrollToEnd()} />
                <DemoButton label="Append item" onPress={appendItem} />
            </DemoControlRow>
            <View style={styles.list}>
                <AnimatedLegendList
                    data={data}
                    estimatedItemSize={72}
                    getFixedItemSize={getFixedItemSize}
                    keyExtractor={keyExtractor}
                    ListHeaderComponent={ReanimatedHint}
                    maintainScrollAtEnd={{ animated: true, on: { dataChange: true } }}
                    onContentSizeChange={onContentSizeChange}
                    onLayout={onListLayout}
                    recycleItems
                    ref={listRef}
                    renderItem={renderItem}
                    sharedValues={sharedValues}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    chip: {
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    chips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    chipText: {
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "800",
    },
    jumpHint: {
        color: "#C7D2FE",
        fontSize: 11,
        fontWeight: "700",
    },
    list: {
        borderTopColor: "#CBD5E1",
        borderTopWidth: 1,
        flex: 1,
    },
    progressFill: {
        backgroundColor: "#818CF8",
        borderRadius: 999,
        height: 5,
    },
    progressTrack: {
        alignSelf: "stretch",
        backgroundColor: "#334155",
        borderRadius: 999,
        height: 5,
        overflow: "hidden",
    },
    row: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderBottomColor: "#E2E8F0",
        borderBottomWidth: 1,
        flexDirection: "row",
        height: 72,
        paddingHorizontal: 14,
    },
    rowCopy: {
        flex: 1,
        gap: 3,
    },
    rowIcon: {
        backgroundColor: "#818CF8",
        borderRadius: 10,
        height: 38,
        marginRight: 12,
        width: 38,
    },
    rowMeta: {
        color: "#64748B",
        fontSize: 11,
    },
    rowTitle: {
        color: "#0F172A",
        fontSize: 15,
        fontWeight: "700",
    },
    screen: {
        backgroundColor: "#F8FAFC",
        flex: 1,
    },
    sharedPanel: {
        backgroundColor: "#0F172A",
        gap: 9,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
});
