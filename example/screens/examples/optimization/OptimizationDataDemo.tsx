import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react-native";
import { DemoButton, DemoControlRow, DemoHint, DemoModeSwitch } from "~/components/DemoControls";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";

type DataItem = {
    id: string;
    revision: number;
    title: string;
};

type EqualityMode = "compare" | "reference";
type DatasetId = "A" | "B";

const MODES: Array<{ label: string; value: EqualityMode }> = [
    { label: "Reference changes", value: "reference" },
    { label: "itemsAreEqual", value: "compare" },
];

function createDataset(datasetId: DatasetId): DataItem[] {
    return Array.from({ length: 100 }, (_, index) => ({
        id: `data-${index}`,
        revision: 0,
        title: `${datasetId} · Item ${index}`,
    }));
}

function keyExtractor(item: DataItem) {
    return item.id;
}

function getFixedItemSize() {
    return 62;
}

function DataHint() {
    return (
        <DemoHint>
            Clone all items, update item 2, then switch datasets to compare reference equality, itemsAreEqual, and
            dataKey.
        </DemoHint>
    );
}

function itemsAreEqual(previous: DataItem, next: DataItem) {
    return previous.id === next.id && previous.revision === next.revision && previous.title === next.title;
}

function DataRow({ item, metrics }: { item: DataItem; metrics: DemoMetricStore }) {
    const renderCount = useRef(0);
    renderCount.current += 1;
    metrics.increment("rowRenders");

    return (
        <View style={styles.row}>
            <View style={styles.rowCopy}>
                <Text style={styles.rowLabel}>{item.title}</Text>
                <Text style={styles.rowMeta}>revision {item.revision}</Text>
            </View>
            <Text style={styles.rowCount}>render {renderCount.current}</Text>
        </View>
    );
}

export function OptimizationDataDemo() {
    const metrics = useDemoMetricStore([
        { id: "rowRenders", initialValue: 0, label: "Row renders" },
        { id: "operations", initialValue: 0, label: "Operations" },
        { id: "dataset", initialValue: "A", label: "Dataset" },
    ]);
    const [datasetId, setDatasetId] = useState<DatasetId>("A");
    const [data, setData] = useState(() => createDataset("A"));
    const [mode, setMode] = useState<EqualityMode>("reference");
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<DataItem>) => <DataRow item={item} metrics={metrics} />,
        [metrics],
    );

    const cloneItems = () => {
        metrics.increment("operations");
        setData((current) => current.map((item) => ({ ...item })));
    };
    const updateItem = () => {
        metrics.increment("operations");
        setData((current) =>
            current.map((item, index) =>
                index === 2
                    ? {
                          ...item,
                          revision: item.revision + 1,
                          title: `${item.title.split(" · r")[0]} · r${item.revision + 1}`,
                      }
                    : item,
            ),
        );
    };
    const switchDataset = () => {
        const nextDatasetId = datasetId === "A" ? "B" : "A";
        metrics.increment("operations");
        metrics.set("dataset", nextDatasetId);
        setDatasetId(nextDatasetId);
        setData(createDataset(nextDatasetId));
    };
    const selectMode = (nextMode: EqualityMode) => {
        metrics.reset();
        metrics.set("dataset", datasetId);
        setMode(nextMode);
    };

    return (
        <View style={styles.screen}>
            <DemoStatsBar store={metrics} />
            <DemoModeSwitch modes={MODES} onSelect={selectMode} selected={mode} />
            <DemoControlRow>
                <DemoButton label="Clone all items" onPress={cloneItems} />
                <DemoButton label="Update item 2" onPress={updateItem} />
                <DemoButton label="Switch dataset" onPress={switchDataset} />
            </DemoControlRow>
            <View style={styles.list}>
                <LegendList
                    data={data}
                    dataKey={datasetId}
                    estimatedItemSize={62}
                    getFixedItemSize={getFixedItemSize}
                    itemsAreEqual={mode === "compare" ? itemsAreEqual : undefined}
                    keyExtractor={keyExtractor}
                    ListHeaderComponent={DataHint}
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
    row: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderBottomColor: "#E2E8F0",
        borderBottomWidth: 1,
        flexDirection: "row",
        height: 62,
        paddingHorizontal: 14,
    },
    rowCopy: {
        flex: 1,
        gap: 2,
    },
    rowCount: {
        color: "#64748B",
        fontSize: 12,
        fontVariant: ["tabular-nums"],
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
    screen: {
        flex: 1,
    },
});
