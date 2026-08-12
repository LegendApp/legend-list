import { useCallback, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import {
    LegendList,
    type LegendListRenderItemProps,
    useRecyclingEffect,
    useViewabilityAmount,
    type ViewAmountToken,
} from "@legendapp/list/react-native";
import { DemoHint } from "~/components/DemoControls";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";

type VisibilityItem = {
    color: string;
    height: number;
    id: string;
    title: string;
};

const COLORS = ["#4338CA", "#0369A1", "#047857", "#B45309", "#BE123C"];
const DATA: VisibilityItem[] = Array.from({ length: 60 }, (_, index) => ({
    color: COLORS[index % COLORS.length]!,
    height: index % 3 === 0 ? 220 : 168,
    id: `visibility-${index}`,
    title: `Story ${index}`,
}));
const VIEWABILITY_CONFIG = {
    id: "visibility-opacity",
    itemVisiblePercentThreshold: 0,
};
const EDGE_OPACITY = 0.12;

function keyExtractor(item: VisibilityItem) {
    return item.id;
}

function getFixedItemSize(item: VisibilityItem) {
    return item.height;
}

function VisibilityHint() {
    return (
        <DemoHint>
            A zero-percent threshold feeds each row's visibility amount into opacity without React state;
            onFirstVisibleItemChanged tracks the leader.
        </DemoHint>
    );
}

function VisibilityRow({ item, metrics }: { item: VisibilityItem; metrics: DemoMetricStore }) {
    const opacity = useRef(new Animated.Value(EDGE_OPACITY)).current;
    const onViewabilityAmount = useCallback(
        (info: ViewAmountToken<VisibilityItem>) => {
            const percentVisible = Math.round(info.percentVisible);
            const visibleFraction = Math.min(1, Math.max(0, info.percentVisible / 100));
            opacity.setValue(EDGE_OPACITY + visibleFraction ** 2 * (1 - EDGE_OPACITY));
            if (info.percentVisible >= 60) {
                metrics.set("active", item.title);
                metrics.set("visible", `${percentVisible}%`);
            }
        },
        [item.title, metrics, opacity],
    );
    const resetOpacity = useCallback(() => opacity.setValue(EDGE_OPACITY), [opacity]);

    metrics.increment("rowRenders");
    useViewabilityAmount(onViewabilityAmount);
    useRecyclingEffect(resetOpacity);

    return (
        <Animated.View style={[styles.row, { backgroundColor: item.color, height: item.height, opacity }]}>
            <Text style={styles.eyebrow}>VIEWABILITY AMOUNT</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>Opacity follows the portion of this recycled row that is visible.</Text>
        </Animated.View>
    );
}

export function VisibilityExample() {
    const metrics = useDemoMetricStore([
        { id: "first", initialValue: "—", label: "First visible" },
        { id: "active", initialValue: "—", label: "Active item" },
        { id: "visible", initialValue: "0%", label: "Visible" },
    ]);
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<VisibilityItem>) => <VisibilityRow item={item} metrics={metrics} />,
        [metrics],
    );
    const onFirstVisibleItemChanged = useCallback(
        ({ index }: { index: number }) => metrics.set("first", index),
        [metrics],
    );

    return (
        <View style={styles.screen}>
            <DemoStatsBar store={metrics} />
            <LegendList
                contentContainerStyle={styles.content}
                data={DATA}
                estimatedItemSize={180}
                getFixedItemSize={getFixedItemSize}
                keyExtractor={keyExtractor}
                ListHeaderComponent={VisibilityHint}
                onFirstVisibleItemChanged={onFirstVisibleItemChanged}
                recycleItems
                renderItem={renderItem}
                viewabilityConfig={VIEWABILITY_CONFIG}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    body: {
        color: "#E2E8F0",
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
        maxWidth: 300,
    },
    content: {
        gap: 10,
        padding: 12,
        paddingBottom: 40,
    },
    eyebrow: {
        color: "#C7D2FE",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1,
    },
    row: {
        borderRadius: 18,
        justifyContent: "center",
        padding: 20,
    },
    screen: {
        backgroundColor: "#E2E8F0",
        flex: 1,
    },
    title: {
        color: "#FFFFFF",
        fontSize: 24,
        fontWeight: "800",
        marginTop: 4,
    },
});
