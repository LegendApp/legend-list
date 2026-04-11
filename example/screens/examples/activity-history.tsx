import { useMemo, useState } from "react";
import { Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegendList } from "@legendapp/list/react-native";
import { buildActivityItems, type ActivityItem } from "@examples/commerce";

export default function ActivityHistoryScreen() {
    const [windowCenter, setWindowCenter] = useState(0);
    const data = useMemo(() => buildActivityItems(windowCenter, 28), [windowCenter]);

    return (
        <>
            <Stack.Screen options={{ headerTitle: "Activity History", headerTransparent: false }} />
            <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.eyebrow}>Directory</Text>
                    <Text style={styles.title}>Activity History</Text>
                </View>
                <LegendList<ActivityItem>
                    contentContainerStyle={styles.listContent}
                    data={data}
                    estimatedItemSize={96}
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition
                    onEndReached={() => setWindowCenter((current) => current + 6)}
                    onStartReached={() => setWindowCenter((current) => current - 6)}
                    renderItem={({ item }) => (
                        <Pressable style={styles.row}>
                            <View style={styles.rowHeader}>
                                <Text style={styles.rowTitle}>{item.summary}</Text>
                                <Text style={[styles.amount, item.kind === "credit" ? styles.credit : styles.debit]}>
                                    {item.amountLabel}
                                </Text>
                            </View>
                            <Text style={styles.rowMeta}>{item.timeLabel}</Text>
                        </Pressable>
                    )}
                />
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    amount: {
        fontSize: 16,
        fontWeight: "700",
    },
    credit: {
        color: "#0F766E",
    },
    debit: {
        color: "#7C2D12",
    },
    eyebrow: {
        color: "#78716C",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1.1,
        textTransform: "uppercase",
    },
    header: {
        gap: 6,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    listContent: {
        padding: 20,
    },
    row: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
    },
    rowHeader: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    rowMeta: {
        color: "#78716C",
        marginTop: 6,
    },
    rowTitle: {
        color: "#1C1917",
        fontSize: 16,
        fontWeight: "600",
    },
    safeArea: {
        backgroundColor: "#F6F1EA",
        flex: 1,
    },
    title: {
        color: "#1C1917",
        fontSize: 28,
        fontWeight: "800",
    },
});
