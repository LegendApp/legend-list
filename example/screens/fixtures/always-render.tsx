import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react-native";

type Item = {
    id: string;
    label: string;
};

const ALWAYS_RENDER = { bottom: 2, top: 2 } as const;
const DATA: Item[] = Array.from({ length: 60 }, (_, index) => ({
    id: `item-${index}`,
    label: `Item ${index + 1}`,
}));

export default function AlwaysRenderExample() {
    const listRef = useRef<LegendListRef>(null);
    const [mountedStatus, setMountedStatus] = useState({ bottom: false, top: false });

    const updateMountedStatus = useCallback(() => {
        const state = listRef.current?.getState();
        if (!state) return;
        const topMounted = !!state.elementAtIndex(0);
        const bottomMounted = !!state.elementAtIndex(DATA.length - 1);
        setMountedStatus((prev) =>
            prev.top === topMounted && prev.bottom === bottomMounted
                ? prev
                : { bottom: bottomMounted, top: topMounted },
        );
    }, []);

    const renderItem = useCallback(({ item, index }: LegendListRenderItemProps<Item>) => {
        const isAlways = index < ALWAYS_RENDER.top || index >= DATA.length - ALWAYS_RENDER.bottom;
        return (
            <View style={[styles.row, isAlways && styles.pinnedRow]}>
                <Text style={styles.label}>{item.label}</Text>
                {isAlways && <Text style={styles.badge}>Always</Text>}
            </View>
        );
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Always Render</Text>
                <Text style={styles.subtitle}>Top and bottom items stay mounted while you scroll.</Text>
                <View style={styles.statusRow}>
                    <Text style={styles.statusText}>Top mounted: {mountedStatus.top ? "yes" : "no"}</Text>
                    <Text style={styles.statusText}>Bottom mounted: {mountedStatus.bottom ? "yes" : "no"}</Text>
                </View>
            </View>
            <LegendList<Item>
                alwaysRender={ALWAYS_RENDER}
                data={DATA}
                estimatedItemSize={56}
                keyExtractor={(item) => item.id}
                onLoad={updateMountedStatus}
                onScroll={updateMountedStatus}
                recycleItems
                ref={listRef}
                renderItem={renderItem}
                scrollEventThrottle={16}
                style={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        color: "#0f5132",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    container: {
        backgroundColor: "#f5f5f5",
        flex: 1,
    },
    header: {
        backgroundColor: "#fff",
        borderBottomColor: "#e2e2e2",
        borderBottomWidth: 1,
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
    pinnedRow: {
        backgroundColor: "#e9f7ef",
        borderColor: "#b7e4c7",
    },
    row: {
        alignItems: "center",
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderColor: "#ececec",
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    statusRow: {
        flexDirection: "row",
        gap: 16,
        marginTop: 6,
    },
    statusText: {
        color: "#444",
        fontSize: 12,
    },
    subtitle: {
        color: "#555",
        marginTop: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
    },
});
