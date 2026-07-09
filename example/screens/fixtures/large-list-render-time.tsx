import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react-native";

type Item = {
    id: string;
    label: string;
    detail: string;
};

const ITEM_COUNT = 10000;
const ESTIMATED_ITEM_SIZE = 64;

const DATA: Item[] = Array.from({ length: ITEM_COUNT }, (_value, index) => ({
    detail: `Row ${index + 1} of ${ITEM_COUNT}`,
    id: `item-${index}`,
    label: `Item ${index + 1}`,
}));

function formatMs(value: number | undefined) {
    return value === undefined ? "--" : `${value.toFixed(1)}ms`;
}

export default function LargeListRenderTimeFixture() {
    const renderCountRef = useRef(0);
    const [runId, setRunId] = useState(1);
    const [loadMs, setLoadMs] = useState<number>();
    const [renderedRows, setRenderedRows] = useState(0);

    const data = useMemo(() => DATA, []);

    const reset = useCallback(() => {
        renderCountRef.current = 0;
        setLoadMs(undefined);
        setRenderedRows(0);
        setRunId((value) => value + 1);
    }, []);

    const renderItem = useCallback(({ item }: LegendListRenderItemProps<Item>) => {
        renderCountRef.current += 1;
        return (
            <View style={styles.row}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.detail}>{item.detail}</Text>
            </View>
        );
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Large List Render Time</Text>
                    <Text style={styles.subtitle}>{ITEM_COUNT.toLocaleString()} estimated rows</Text>
                </View>
                <Pressable onPress={reset} style={styles.button}>
                    <Text style={styles.buttonText}>Run</Text>
                </Pressable>
            </View>
            <View style={styles.metrics}>
                <Text style={styles.metric}>onLoad {formatMs(loadMs)}</Text>
                <Text style={styles.metric}>rows rendered {renderedRows}</Text>
            </View>
            <LegendList<Item>
                data={data}
                estimatedItemSize={ESTIMATED_ITEM_SIZE}
                key={runId}
                keyExtractor={(item) => item.id}
                onLoad={({ elapsedTimeInMs }) => {
                    setLoadMs(elapsedTimeInMs);
                    setRenderedRows(renderCountRef.current);
                }}
                recycleItems
                renderItem={renderItem}
                style={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        alignItems: "center",
        backgroundColor: "#1d4ed8",
        borderRadius: 6,
        minWidth: 72,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    buttonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
    container: {
        backgroundColor: "#f5f5f5",
        flex: 1,
    },
    detail: {
        color: "#666",
        fontSize: 12,
        marginTop: 2,
    },
    header: {
        alignItems: "center",
        backgroundColor: "#fff",
        borderBottomColor: "#e2e2e2",
        borderBottomWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    label: {
        color: "#1d1d1f",
        fontSize: 16,
        fontWeight: "600",
    },
    list: {
        flex: 1,
    },
    metric: {
        color: "#444",
        fontSize: 13,
        fontVariant: ["tabular-nums"],
    },
    metrics: {
        backgroundColor: "#fff",
        borderBottomColor: "#e2e2e2",
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: 18,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    row: {
        backgroundColor: "#fff",
        borderBottomColor: "#ececec",
        borderBottomWidth: 1,
        minHeight: ESTIMATED_ITEM_SIZE,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    subtitle: {
        color: "#555",
        fontSize: 13,
        marginTop: 3,
    },
    title: {
        color: "#111",
        fontSize: 18,
        fontWeight: "700",
    },
});
