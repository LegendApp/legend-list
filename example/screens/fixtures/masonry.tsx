import { StyleSheet, Text, View } from "react-native";

import { MasonryLegendList } from "@legendapp/list/masonry";

const COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#ca8a04", "#dc2626"];
const DATA = Array.from({ length: 80 }, (_, index) => ({
    color: COLORS[index % COLORS.length],
    height: 96 + ((index * 47) % 180),
    id: String(index),
}));

export default function Masonry() {
    return (
        <View style={styles.container}>
            <MasonryLegendList
                contentContainerStyle={styles.content}
                data={DATA}
                estimatedItemSize={180}
                keyExtractor={(item) => item.id}
                numColumns={2}
                recycleItems
                renderItem={({ item, index }) => (
                    <View style={[styles.card, { backgroundColor: item.color, height: item.height }]}>
                        <Text style={styles.eyebrow}>CARD {String(index + 1).padStart(2, "0")}</Text>
                        <Text style={styles.height}>{item.height}px</Text>
                    </View>
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
});
