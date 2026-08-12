import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react-native";
import { DemoHint, DemoModeSwitch } from "~/components/DemoControls";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";

type DistanceMode = "0" | "250" | "1000";
type WindowItem = {
    id: string;
};

const DATA: WindowItem[] = Array.from({ length: 400 }, (_, index) => ({ id: `window-${index}` }));
const MODES: Array<{ label: string; value: DistanceMode }> = [
    { label: "0 px", value: "0" },
    { label: "250 px", value: "250" },
    { label: "1000 px", value: "1000" },
];

function keyExtractor(item: WindowItem) {
    return item.id;
}

function getFixedItemSize() {
    return 64;
}

function RenderWindowHint() {
    return (
        <DemoHint>
            Fast-scroll at each draw distance and compare getState() ranges. Larger buffers mount more work; tune only
            after row cost and sizing.
        </DemoHint>
    );
}

function WindowRow({ item, metrics }: { item: WindowItem; metrics: DemoMetricStore }) {
    useEffect(() => {
        return metrics.trackMount("mounted");
    }, [metrics]);

    return (
        <View style={styles.row}>
            <Text style={styles.rowTitle}>Row {item.id.replace("window-", "")}</Text>
            <Text style={styles.rowMeta}>64 px fixed size</Text>
        </View>
    );
}

function RenderWindowRun({ drawDistance }: { drawDistance: number }) {
    const listRef = useRef<LegendListRef>(null);
    const metrics = useDemoMetricStore([
        { id: "visible", initialValue: "—", label: "Visible" },
        { id: "buffered", initialValue: "—", label: "Buffered" },
        { id: "mounted", initialValue: 0, label: "Mounted", resettable: false },
    ]);
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<WindowItem>) => <WindowRow item={item} metrics={metrics} />,
        [metrics],
    );
    const updateRanges = useCallback(() => {
        const state = listRef.current?.getState();
        if (state) {
            metrics.set("visible", `${state.start}–${state.end}`);
            metrics.set("buffered", `${state.startBuffered}–${state.endBuffered}`);
        }
    }, [metrics]);
    const resetMetrics = useCallback(() => {
        const state = listRef.current?.getState();
        metrics.reset(
            state
                ? {
                      buffered: `${state.startBuffered}–${state.endBuffered}`,
                      visible: `${state.start}–${state.end}`,
                  }
                : undefined,
        );
    }, [metrics]);

    return (
        <View style={styles.run}>
            <DemoStatsBar onReset={resetMetrics} store={metrics} />
            <View style={styles.list}>
                <LegendList
                    data={DATA}
                    drawDistance={drawDistance}
                    estimatedItemSize={64}
                    getFixedItemSize={getFixedItemSize}
                    keyExtractor={keyExtractor}
                    ListHeaderComponent={RenderWindowHint}
                    onFirstVisibleItemChanged={updateRanges}
                    onLoad={updateRanges}
                    onScroll={updateRanges}
                    recycleItems
                    ref={listRef}
                    renderItem={renderItem}
                    scrollEventThrottle={32}
                />
            </View>
        </View>
    );
}

export function DebuggingRenderWindowDemo() {
    const [mode, setMode] = useState<DistanceMode>("250");

    return (
        <View style={styles.screen}>
            <DemoModeSwitch modes={MODES} onSelect={setMode} selected={mode} />
            <RenderWindowRun drawDistance={Number(mode)} key={mode} />
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
        height: 64,
        justifyContent: "space-between",
        paddingHorizontal: 14,
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
