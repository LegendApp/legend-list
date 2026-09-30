import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";

const ROW_HEIGHT = 100;
const INITIAL_ROWS = 8;
const ROWS_PER_PAGE = 8;
const MAX_PAGES = 4;

type Row = { id: string; label: string };

const createRows = (start: number, count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({ id: `row-${start + i}`, label: `Item ${start + i + 1}` }));

const Row = ({ item }: { item: Row }) => {
    const [focused, setFocused] = useState(false);

    return (
        <Pressable
            focusable
            onBlur={() => setFocused(false)}
            onFocus={() => setFocused(true)}
            style={[styles.row, focused && styles.rowFocused]}
        >
            <Text style={styles.rowText}>{item.label}</Text>
        </Pressable>
    );
};

export default function ReachedEdgeDpad() {
    const [rows, setRows] = useState(() => createRows(0, INITIAL_ROWS));
    const [pages, setPages] = useState(1);
    const [calls, setCalls] = useState(0);

    const onEndReached = useCallback(() => {
        setCalls((prev) => prev + 1);
        if (pages >= MAX_PAGES) {
            return;
        }
        setRows((prev) => [...prev, ...createRows(prev.length, ROWS_PER_PAGE)]);
        setPages((prev) => prev + 1);
    }, [pages]);

    const loadedAll = pages >= MAX_PAGES;

    return (
        <View style={styles.container}>
            <View style={styles.status}>
                <Text style={styles.statusText}>
                    pages loaded: {pages} / {MAX_PAGES}
                </Text>
                <Text style={styles.statusText}>onEndReached calls: {calls}</Text>
                <Text style={[styles.statusText, loadedAll ? styles.ok : styles.stuck]}>
                    {loadedAll ? "all pages loaded" : "waiting for onEndReached"}
                </Text>
            </View>
            <LegendList
                data={rows}
                estimatedItemSize={ROW_HEIGHT}
                keyExtractor={(item) => item.id}
                onEndReached={onEndReached}
                onEndReachedThreshold={2}
                renderItem={({ item }) => <Row item={item} />}
                scrollEnabled={false}
                style={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#f5f5f5",
        flex: 1,
    },
    list: {
        flex: 1,
    },
    ok: {
        color: "#1b873f",
    },
    row: {
        alignItems: "center",
        backgroundColor: "white",
        borderBottomColor: "#d0d0d0",
        borderBottomWidth: 2,
        flexDirection: "row",
        height: ROW_HEIGHT,
        paddingHorizontal: 24,
    },
    rowFocused: {
        backgroundColor: "#cfe3ff",
        borderColor: "#2a6df4",
        borderWidth: 4,
    },
    rowText: {
        fontSize: 32,
    },
    status: {
        backgroundColor: "#202124",
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    statusText: {
        color: "white",
        fontSize: 18,
        fontWeight: "700",
    },
    stuck: {
        color: "#ff6b6b",
    },
});
