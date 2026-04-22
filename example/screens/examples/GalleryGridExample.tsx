import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import { buildGalleryItems } from "../../../examples-shared/commerce";

const styles = StyleSheet.create({
    card: {
        borderRadius: 18,
        justifyContent: "space-between",
        padding: 14,
    },
    cardSubtitle: {
        color: "#292524",
        fontSize: 13,
        fontWeight: "600",
    },
    cardTitle: {
        color: "#111827",
        fontSize: 18,
        fontWeight: "800",
    },
    columnWrapper: {
        columnGap: 12,
        rowGap: 12,
    },
    listContent: {
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    safeArea: {
        backgroundColor: "#FAF7F2",
        flex: 1,
    },
    toggle: {
        backgroundColor: "#E7E5E4",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    toggleActive: {
        backgroundColor: "#292524",
    },
    toggleRow: {
        flexDirection: "row",
        gap: 10,
        paddingBottom: 12,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    toggleText: {
        color: "#292524",
        fontWeight: "700",
    },
    toggleTextActive: {
        color: "#FFFFFF",
    },
});

export function GalleryGridExample() {
    const [columns, setColumns] = useState<2 | 3>(2);
    const data = useMemo(() => buildGalleryItems(120), []);

    return (
        <View style={styles.safeArea}>
            <View style={styles.toggleRow}>
                {[2, 3].map((value) => (
                    <Pressable
                        key={value}
                        onPress={() => setColumns(value as 2 | 3)}
                        style={[styles.toggle, columns === value && styles.toggleActive]}
                    >
                        <Text style={[styles.toggleText, columns === value && styles.toggleTextActive]}>
                            {value} cols
                        </Text>
                    </Pressable>
                ))}
            </View>
            <LegendList
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.listContent}
                data={data}
                estimatedItemSize={columns === 2 ? 180 : 140}
                keyExtractor={(item) => item.id}
                numColumns={columns}
                recycleItems
                renderItem={({ item, index }) => (
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: item.color,
                                height: columns === 2 ? (index % 3 === 0 ? 220 : 180) : index % 2 === 0 ? 150 : 180,
                            },
                        ]}
                    >
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardSubtitle}>{item.tone}</Text>
                    </View>
                )}
                style={{ flex: 1 }}
            />
        </View>
    );
}
