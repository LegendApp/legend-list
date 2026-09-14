import { useState } from "react";
import { Button, Pressable, StyleSheet, Text, View } from "react-native";

import { MasonryLegendList } from "@legendapp/list/masonry";

const COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#ca8a04", "#dc2626"];
const makeItem = (index: number) => ({
    color: COLORS[Math.abs(index) % COLORS.length],
    height: 96 + ((Math.abs(index) * 47) % 180),
    id: String(index),
});
const DATA = Array.from({ length: 80 }, (_, index) => makeItem(index));

export default function Masonry() {
    const [data, setData] = useState(DATA);
    const [columns, setColumns] = useState(2);
    const [selected, setSelected] = useState<string | null>(null);
    const [tall, setTall] = useState(false);
    return (
        <View style={styles.container}>
            <View style={styles.controls}>
                <Button
                    onPress={() => setColumns((value) => (value === 4 ? 2 : value + 1))}
                    title={`Columns: ${columns}`}
                />
                <Button
                    onPress={() => setData((items) => [makeItem(Number(items[0].id) - 1), ...items])}
                    title="Prepend"
                />
                <Button
                    onPress={() => setData((items) => [...items, makeItem(Number(items.at(-1)!.id) + 1)])}
                    title="Append"
                />
                <Button onPress={() => setTall((value) => !value)} title="Toggle tall card" />
                <Button
                    onPress={() => {
                        setData(DATA);
                        setTall(false);
                        setSelected(null);
                    }}
                    title="Reset"
                />
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.status}>
                Selected: {selected ?? "none"} / Items: {data.length}
            </Text>
            <MasonryLegendList
                contentContainerStyle={styles.content}
                data={data}
                estimatedItemSize={180}
                extraData={tall}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                numColumns={columns}
                recycleItems
                renderItem={({ item }) => (
                    <Pressable
                        accessibilityLabel={`Card ${item.id}`}
                        accessibilityRole="button"
                        onPress={() => setSelected(item.id)}
                        style={[
                            styles.card,
                            { backgroundColor: item.color, height: tall && item.id === "1" ? 2000 : item.height },
                        ]}
                    >
                        <Text style={styles.eyebrow}>CARD {item.id}</Text>
                        <Text style={styles.height}>{tall && item.id === "1" ? 2000 : item.height}px</Text>
                    </Pressable>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 18,
        justifyContent: "space-between",
        padding: 16,
    },
    container: {
        backgroundColor: "#f8fafc",
        flex: 1,
    },
    content: {
        columnGap: 12,
        padding: 12,
        rowGap: 12,
    },
    controls: { flexDirection: "row", flexWrap: "wrap" },
    eyebrow: {
        color: "rgba(255, 255, 255, 0.78)",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.2,
    },
    height: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "800",
    },
    status: { paddingBottom: 8, paddingHorizontal: 12 },
});
