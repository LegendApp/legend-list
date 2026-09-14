import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react-native";
import { observable } from "@legendapp/state";
import { useSelector } from "@legendapp/state/react";
import { DemoHint, DemoModeSwitch } from "~/components/DemoControls";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";

type InvalidationItem = {
    id: string;
    label: string;
};

type InvalidationMode = "external" | "extraData";

const DATA: InvalidationItem[] = Array.from({ length: 80 }, (_, index) => ({
    id: `state-${index}`,
    label: `Selectable item ${index}`,
}));
const MODES: Array<{ label: string; value: InvalidationMode }> = [
    { label: "extraData", value: "extraData" },
    { label: "Item-scoped state", value: "external" },
];

function createSelectionStore() {
    return observable<Record<string, boolean>>({});
}

type SelectionStore = ReturnType<typeof createSelectionStore>;

function keyExtractor(item: InvalidationItem) {
    return item.id;
}

function InvalidationHint() {
    return (
        <DemoHint>
            Tap one row: extraData re-evaluates every mounted row, while item-scoped state updates only its subscriber.
        </DemoHint>
    );
}

function SelectionRow({
    item,
    metrics,
    onPress,
    selected,
}: {
    item: InvalidationItem;
    metrics: DemoMetricStore;
    onPress: () => void;
    selected: boolean;
}) {
    const renderCount = useRef(0);
    renderCount.current += 1;
    metrics.increment("rowRenders");

    return (
        <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, selected && styles.rowSelected]}>
            <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{item.label}</Text>
            <Text style={[styles.rowCount, selected && styles.rowLabelSelected]}>render {renderCount.current}</Text>
        </Pressable>
    );
}

function ExternalSelectionRow({
    item,
    metrics,
    selection,
}: {
    item: InvalidationItem;
    metrics: DemoMetricStore;
    selection: SelectionStore;
}) {
    const selected = useSelector(() => selection[item.id].get()) ?? false;
    const toggle = () => {
        selection[item.id].set(!selected);
        metrics.increment("selected", selected ? -1 : 1);
    };

    return <SelectionRow item={item} metrics={metrics} onPress={toggle} selected={selected} />;
}

function ExternalStateList({ metrics, selection }: { metrics: DemoMetricStore; selection: SelectionStore }) {
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<InvalidationItem>) => (
            <ExternalSelectionRow item={item} metrics={metrics} selection={selection} />
        ),
        [metrics, selection],
    );

    return (
        <LegendList
            data={DATA}
            estimatedItemSize={58}
            getFixedItemSize={() => 58}
            keyExtractor={keyExtractor}
            ListHeaderComponent={InvalidationHint}
            recycleItems
            renderItem={renderItem}
        />
    );
}

function ExtraDataList({ metrics }: { metrics: DemoMetricStore }) {
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<InvalidationItem>) => {
            const isSelected = selected[item.id] ?? false;
            const toggle = () => {
                setSelected((current) => ({ ...current, [item.id]: !isSelected }));
                metrics.increment("selected", isSelected ? -1 : 1);
            };
            return <SelectionRow item={item} metrics={metrics} onPress={toggle} selected={isSelected} />;
        },
        [metrics, selected],
    );

    return (
        <LegendList
            data={DATA}
            estimatedItemSize={58}
            extraData={selected}
            getFixedItemSize={() => 58}
            keyExtractor={keyExtractor}
            ListHeaderComponent={InvalidationHint}
            recycleItems
            renderItem={renderItem}
        />
    );
}

export function OptimizationInvalidationDemo() {
    const metrics = useDemoMetricStore([
        { id: "rowRenders", initialValue: 0, label: "Row renders" },
        { id: "selected", initialValue: 0, label: "Selected" },
        { id: "mode", initialValue: "Scoped", label: "Update scope" },
    ]);
    const [mode, setMode] = useState<InvalidationMode>("extraData");
    const [selection] = useState(createSelectionStore);

    const selectMode = (nextMode: InvalidationMode) => {
        selection.set({});
        metrics.reset();
        metrics.set("mode", nextMode === "external" ? "Scoped" : "All mounted");
        setMode(nextMode);
    };

    return (
        <View style={styles.screen}>
            <DemoStatsBar store={metrics} />
            <DemoModeSwitch modes={MODES} onSelect={selectMode} selected={mode} />
            <View key={mode} style={styles.list}>
                {mode === "external" ? (
                    <ExternalStateList metrics={metrics} selection={selection} />
                ) : (
                    <ExtraDataList metrics={metrics} />
                )}
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
    row: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderBottomColor: "#E2E8F0",
        borderBottomWidth: 1,
        flexDirection: "row",
        height: 58,
        paddingHorizontal: 14,
    },
    rowCount: {
        color: "#64748B",
        fontSize: 12,
        fontVariant: ["tabular-nums"],
    },
    rowLabel: {
        color: "#0F172A",
        flex: 1,
        fontSize: 15,
        fontWeight: "600",
    },
    rowLabelSelected: {
        color: "#FFFFFF",
    },
    rowSelected: {
        backgroundColor: "#4F46E5",
    },
    screen: {
        flex: 1,
    },
});
