import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react-native";
import { DemoButton, DemoControlRow, DemoHint, DemoModeSwitch } from "~/components/DemoControls";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";

type CostMode = "0" | "2" | "6";
type CostItem = {
    id: string;
    revision: number;
};

const INITIAL_DATA: CostItem[] = Array.from({ length: 500 }, (_, index) => ({
    id: `cost-${index}`,
    revision: 0,
}));
const MODES: Array<{ label: string; value: CostMode }> = [
    { label: "0 ms", value: "0" },
    { label: "2 ms", value: "2" },
    { label: "6 ms", value: "6" },
];

function keyExtractor(item: CostItem) {
    return item.id;
}

function getFixedItemSize() {
    return 64;
}

function RowCostHint() {
    return (
        <DemoHint>
            Update every item at each cost: virtualization limits mounted rows, but every required render still pays the
            row cost.
        </DemoHint>
    );
}

function performRowWork(duration: number) {
    const deadline = performance.now() + duration;
    let checksum = 1;
    while (performance.now() < deadline) {
        checksum = (checksum * 1.000001 + Math.sqrt(checksum + 17)) % 10000;
    }
    return Math.round(checksum);
}

function CostRow({ cost, item, metrics }: { cost: number; item: CostItem; metrics: DemoMetricStore }) {
    metrics.increment("rowRenders");
    const checksum = performRowWork(cost);

    return (
        <View style={styles.row}>
            <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Row {item.id.replace("cost-", "")}</Text>
                <Text style={styles.rowMeta}>
                    revision {item.revision} · work checksum {checksum}
                </Text>
            </View>
            <Text style={styles.cost}>{cost} ms</Text>
        </View>
    );
}

function RowCostRun({ cost }: { cost: number }) {
    const metrics = useDemoMetricStore([
        { id: "rowRenders", initialValue: 0, label: "Row renders" },
        { id: "cost", initialValue: `${cost} ms`, label: "Cost / row" },
        { id: "onLoad", initialValue: "—", label: "Initial load" },
    ]);
    const [data, setData] = useState(INITIAL_DATA);
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<CostItem>) => <CostRow cost={cost} item={item} metrics={metrics} />,
        [cost, metrics],
    );
    const refreshVisibleRows = () => {
        metrics.reset();
        metrics.set("cost", `${cost} ms`);
        setData((current) => current.map((item) => ({ ...item, revision: item.revision + 1 })));
    };

    return (
        <View style={styles.run}>
            <DemoStatsBar store={metrics} />
            <DemoControlRow>
                <DemoButton label="Update every item" onPress={refreshVisibleRows} />
            </DemoControlRow>
            <View style={styles.list}>
                <LegendList
                    data={data}
                    estimatedItemSize={64}
                    getFixedItemSize={getFixedItemSize}
                    keyExtractor={keyExtractor}
                    ListHeaderComponent={RowCostHint}
                    onLoad={({ elapsedTimeInMs }) => metrics.set("onLoad", `${elapsedTimeInMs.toFixed(1)} ms`)}
                    recycleItems
                    renderItem={renderItem}
                />
            </View>
        </View>
    );
}

export function DebuggingRowCostDemo() {
    const [mode, setMode] = useState<CostMode>("0");

    return (
        <View style={styles.screen}>
            <DemoModeSwitch modes={MODES} onSelect={setMode} selected={mode} />
            <RowCostRun cost={Number(mode)} key={mode} />
        </View>
    );
}

const styles = StyleSheet.create({
    cost: {
        color: "#B45309",
        fontSize: 12,
        fontWeight: "800",
    },
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
        height: 64,
        paddingHorizontal: 14,
    },
    rowCopy: {
        flex: 1,
        gap: 3,
    },
    rowMeta: {
        color: "#64748B",
        fontSize: 11,
    },
    rowTitle: {
        color: "#0F172A",
        fontSize: 14,
        fontWeight: "700",
    },
    run: {
        flex: 1,
    },
    screen: {
        flex: 1,
    },
});
