import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";

const ROW_HEIGHT = 72;
const INITIAL_HEADER_HEIGHT = 96;
const ANCHOR_ROW_INDEX = 20;
const DATA = Array.from({ length: 80 }, (_, index) => ({
    id: String(index),
    title: `Row ${index}`,
}));

type RowItem = (typeof DATA)[number];

function Header({ height }: { height: number }) {
    return (
        <View style={[styles.header, { height }]}>
            <Text style={styles.headerTitle}>Measured ListHeaderComponent</Text>
            <Text style={styles.headerSubtitle}>height: {height}</Text>
        </View>
    );
}

export default function HeaderMvcpFixture() {
    const listRef = useRef<LegendListRef>(null);
    const [headerHeight, setHeaderHeight] = useState(INITIAL_HEADER_HEIGHT);
    const [scrollOffset, setScrollOffset] = useState(0);

    return (
        <View style={styles.container}>
            <LegendList<RowItem>
                data={DATA}
                estimatedItemSize={ROW_HEIGHT}
                initialScrollIndex={ANCHOR_ROW_INDEX}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<Header height={headerHeight} />}
                maintainVisibleContentPosition={{ data: false, size: true }}
                onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
                recycleItems
                ref={listRef}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <Text style={styles.rowText}>{item.title}</Text>
                    </View>
                )}
                style={styles.list}
            />

            <View style={styles.controls}>
                <Text style={styles.readout}>scrollOffset: {Math.round(scrollOffset)}</Text>
                <View style={styles.buttonRow}>
                    <Pressable onPress={() => setHeaderHeight((value) => value + 80)} style={styles.button}>
                        <Text style={styles.buttonText}>Grow header</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setHeaderHeight((value) => Math.max(24, value - 80))}
                        style={styles.button}
                    >
                        <Text style={styles.buttonText}>Shrink header</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => listRef.current?.scrollToOffset({ animated: false, offset: 0 })}
                        style={styles.button}
                    >
                        <Text style={styles.buttonText}>Show header</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: "#1e3a8a",
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    buttonRow: {
        flexDirection: "row",
        gap: 8,
    },
    buttonText: {
        color: "#ffffff",
        fontSize: 13,
    },
    container: {
        backgroundColor: "#ffffff",
        flex: 1,
    },
    controls: {
        backgroundColor: "#f8fafc",
        borderTopColor: "#cbd5e1",
        borderTopWidth: 1,
        gap: 8,
        padding: 12,
    },
    header: {
        backgroundColor: "#dbeafe",
        borderBottomColor: "#bfdbfe",
        borderBottomWidth: 1,
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    headerSubtitle: {
        color: "#1e3a8a",
        fontSize: 12,
    },
    headerTitle: {
        color: "#1e3a8a",
        fontSize: 14,
        fontWeight: "600",
    },
    list: {
        flex: 1,
    },
    readout: {
        color: "#0f172a",
        fontSize: 13,
        fontVariant: ["tabular-nums"],
    },
    row: {
        borderBottomColor: "#dbe3ef",
        borderBottomWidth: 1,
        height: ROW_HEIGHT,
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    rowText: {
        color: "#0f172a",
        fontSize: 15,
    },
});
