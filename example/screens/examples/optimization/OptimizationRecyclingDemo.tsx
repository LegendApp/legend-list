import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRenderItemProps, useRecyclingState } from "@legendapp/list/react-native";
import { DemoHint, DemoModeSwitch } from "~/components/DemoControls";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";

type RecyclingItem = {
    id: string;
    label: string;
    type: "message" | "notice";
};

type RecyclingMode = "correct" | "local";

const DATA: RecyclingItem[] = Array.from({ length: 200 }, (_, index) => ({
    id: `recycling-${index}`,
    label: `Item ${index}`,
    type: index % 7 === 0 ? "notice" : "message",
}));
const MODES: Array<{ label: string; value: RecyclingMode }> = [
    { label: "Ordinary useState", value: "local" },
    { label: "Recycling-aware", value: "correct" },
];
let nextInstanceId = 1;

function keyExtractor(item: RecyclingItem) {
    return item.id;
}

function getItemType(item: RecyclingItem) {
    return item.type;
}

function getFixedItemSize() {
    return 68;
}

function RecyclingHint() {
    return (
        <DemoHint>
            Select a row, then scroll: ordinary state follows its reused container, useRecyclingState follows the item,
            and getItemType keeps structures compatible.
        </DemoHint>
    );
}

function RecyclingRowFrame({
    item,
    metrics,
    selected,
    setSelected,
}: {
    item: RecyclingItem;
    metrics: DemoMetricStore;
    selected: boolean;
    setSelected: (value: boolean) => void;
}) {
    const instanceId = useRef(0);
    const previousItemId = useRef(item.id);
    if (instanceId.current === 0) {
        instanceId.current = nextInstanceId++;
    }
    metrics.increment("rowRenders");

    if (previousItemId.current !== item.id) {
        previousItemId.current = item.id;
        metrics.increment("reassignments");
    }

    useEffect(() => {
        return metrics.trackMount("mounted");
    }, [metrics]);

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => setSelected(!selected)}
            style={[styles.row, item.type === "notice" && styles.noticeRow, selected && styles.selectedRow]}
        >
            <View style={styles.rowCopy}>
                <Text style={[styles.rowLabel, selected && styles.selectedText]}>{item.label}</Text>
                <Text style={[styles.rowMeta, selected && styles.selectedText]}>
                    {item.type} · container {instanceId.current}
                </Text>
            </View>
            <Text style={[styles.state, selected && styles.selectedText]}>{selected ? "Selected" : "Tap me"}</Text>
        </Pressable>
    );
}

function OrdinaryStateRow({ item, metrics }: { item: RecyclingItem; metrics: DemoMetricStore }) {
    const [selected, setSelected] = useState(false);
    return <RecyclingRowFrame item={item} metrics={metrics} selected={selected} setSelected={setSelected} />;
}

function RecyclingAwareRow({ item, metrics }: { item: RecyclingItem; metrics: DemoMetricStore }) {
    const [selected = false, setSelected] = useRecyclingState<boolean>(false);
    return <RecyclingRowFrame item={item} metrics={metrics} selected={selected} setSelected={setSelected} />;
}

export function OptimizationRecyclingDemo() {
    const [mode, setMode] = useState<RecyclingMode>("local");

    return (
        <View style={styles.screen}>
            <DemoModeSwitch modes={MODES} onSelect={setMode} selected={mode} />
            <RecyclingRun key={mode} mode={mode} />
        </View>
    );
}

function RecyclingRun({ mode }: { mode: RecyclingMode }) {
    const metrics = useDemoMetricStore([
        { id: "rowRenders", initialValue: 0, label: "Row renders" },
        { id: "mounted", initialValue: 0, label: "Mounted", resettable: false },
        { id: "reassignments", initialValue: 0, label: "Reassigned" },
    ]);
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<RecyclingItem>) =>
            mode === "correct" ? (
                <RecyclingAwareRow item={item} metrics={metrics} />
            ) : (
                <OrdinaryStateRow item={item} metrics={metrics} />
            ),
        [metrics, mode],
    );

    return (
        <View style={styles.run}>
            <DemoStatsBar store={metrics} />
            <View style={styles.list}>
                <LegendList
                    data={DATA}
                    estimatedItemSize={68}
                    getFixedItemSize={getFixedItemSize}
                    getItemType={getItemType}
                    keyExtractor={keyExtractor}
                    ListHeaderComponent={RecyclingHint}
                    recycleItems
                    renderItem={renderItem}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    list: {
        borderTopColor: "#E2E8F0",
        borderTopWidth: 1,
        flex: 1,
    },
    noticeRow: {
        backgroundColor: "#FEF3C7",
    },
    row: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderBottomColor: "#E2E8F0",
        borderBottomWidth: 1,
        flexDirection: "row",
        height: 68,
        paddingHorizontal: 14,
    },
    rowCopy: {
        flex: 1,
        gap: 3,
    },
    rowLabel: {
        color: "#0F172A",
        fontSize: 15,
        fontWeight: "700",
    },
    rowMeta: {
        color: "#64748B",
        fontSize: 11,
    },
    run: {
        flex: 1,
    },
    screen: {
        flex: 1,
    },
    selectedRow: {
        backgroundColor: "#4F46E5",
    },
    selectedText: {
        color: "#FFFFFF",
    },
    state: {
        color: "#475569",
        fontSize: 12,
        fontWeight: "700",
    },
});
