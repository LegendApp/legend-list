import { useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { LegendList, type LegendListRenderItemProps, useRecyclingState } from "@legendapp/list/react-native";
import { DemoHint, DemoModeSwitch } from "~/components/DemoControls";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";

type ImageMode = "delayed" | "reserved";
type ImageItem = {
    height: number;
    id: string;
    width: number;
};

const DATA: ImageItem[] = Array.from({ length: 30 }, (_, index) => ({
    height: 420 + (index % 4) * 110,
    id: `image-${index}`,
    width: 800,
}));
const MODES: Array<{ label: string; value: ImageMode }> = [
    { label: "Size after load", value: "delayed" },
    { label: "Reserved geometry", value: "reserved" },
];

function keyExtractor(item: ImageItem) {
    return item.id;
}

function ImagesHint() {
    return (
        <DemoHint>
            Compare size-after-load with geometry reserved from known dimensions; watch late corrections and visible
            movement.
        </DemoHint>
    );
}

function ImageRow({
    availableWidth,
    item,
    metrics,
    mode,
}: {
    availableWidth: number;
    item: ImageItem;
    metrics: DemoMetricStore;
    mode: ImageMode;
}) {
    const reservedHeight = Math.round((availableWidth * item.height) / item.width);
    const [imageHeight = 72, setImageHeight] = useRecyclingState<number>(() =>
        mode === "reserved" ? reservedHeight : 72,
    );
    const source = useMemo(
        () => ({ uri: `https://picsum.photos/seed/legend-list-${item.id}-${mode}/${item.width}/${item.height}` }),
        [item.height, item.id, item.width, mode],
    );
    const onLoad = useCallback(() => {
        metrics.increment("loads");
        if (mode === "delayed" && imageHeight !== reservedHeight) {
            metrics.increment("corrections");
            setImageHeight(reservedHeight);
        }
    }, [imageHeight, metrics, mode, reservedHeight, setImageHeight]);

    return (
        <View style={styles.row}>
            <Image onLoad={onLoad} resizeMode="cover" source={source} style={[styles.image, { height: imageHeight }]} />
            <View style={styles.caption}>
                <Text style={styles.title}>{item.id}</Text>
                <Text style={styles.meta}>
                    {mode === "reserved" ? `Reserved ${reservedHeight}px before load` : `${imageHeight}px after load`}
                </Text>
            </View>
        </View>
    );
}

function ImageSizingRun({ mode }: { mode: ImageMode }) {
    const { width } = useWindowDimensions();
    const availableWidth = Math.min(520, width - 24);
    const metrics = useDemoMetricStore([
        { id: "loads", initialValue: 0, label: "Images loaded" },
        { id: "corrections", initialValue: 0, label: "Late corrections" },
        { id: "size", initialValue: "—", label: "Last size" },
    ]);
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<ImageItem>) => (
            <ImageRow availableWidth={availableWidth} item={item} metrics={metrics} mode={mode} />
        ),
        [availableWidth, metrics, mode],
    );

    return (
        <View style={styles.run}>
            <DemoStatsBar store={metrics} />
            <LegendList
                contentContainerStyle={styles.content}
                data={DATA}
                estimatedItemSize={260}
                keyExtractor={keyExtractor}
                ListHeaderComponent={ImagesHint}
                onItemSizeChanged={({ previous, size }) => {
                    metrics.set("size", `${Math.round(previous)}→${Math.round(size)}`);
                }}
                recycleItems
                renderItem={renderItem}
            />
        </View>
    );
}

export function DebuggingImagesDemo() {
    const [mode, setMode] = useState<ImageMode>("delayed");

    return (
        <View style={styles.screen}>
            <DemoModeSwitch modes={MODES} onSelect={setMode} selected={mode} />
            <ImageSizingRun key={mode} mode={mode} />
        </View>
    );
}

const styles = StyleSheet.create({
    caption: {
        gap: 2,
        padding: 12,
    },
    content: {
        gap: 12,
        padding: 12,
        paddingBottom: 40,
    },
    image: {
        backgroundColor: "#CBD5E1",
        width: "100%",
    },
    meta: {
        color: "#64748B",
        fontSize: 11,
    },
    row: {
        backgroundColor: "#FFFFFF",
        borderColor: "#CBD5E1",
        borderRadius: 14,
        borderWidth: 1,
        overflow: "hidden",
    },
    run: {
        flex: 1,
    },
    screen: {
        backgroundColor: "#E2E8F0",
        flex: 1,
    },
    title: {
        color: "#0F172A",
        fontSize: 14,
        fontWeight: "700",
    },
});
