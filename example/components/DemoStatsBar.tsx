import { Pressable, StyleSheet, Text, View } from "react-native";

import { type DemoMetricStore, useDemoMetricSnapshot } from "~/lib/demoMetrics";

export function DemoStatsBar({ onReset, store }: { onReset?: () => void; store: DemoMetricStore }) {
    const metrics = useDemoMetricSnapshot(store);

    return (
        <View accessibilityLabel="Demo statistics" style={styles.container}>
            <View style={styles.metrics}>
                {metrics.map((metric) => (
                    <View key={metric.id} style={styles.metric}>
                        <Text numberOfLines={1} style={styles.label}>
                            {metric.label}
                        </Text>
                        <Text numberOfLines={1} style={styles.value} testID={`demo-metric-${metric.id}`}>
                            {metric.value}
                        </Text>
                    </View>
                ))}
            </View>
            <Pressable
                accessibilityLabel="Reset demo statistics"
                accessibilityRole="button"
                onPress={() => (onReset ?? store.reset)()}
                style={styles.reset}
            >
                <Text style={styles.resetText}>Reset</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        backgroundColor: "#0F172A",
        borderBottomColor: "#334155",
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        minHeight: 48,
        paddingHorizontal: 10,
    },
    label: {
        color: "#94A3B8",
        fontSize: 10,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    metric: {
        flex: 1,
        gap: 1,
        minWidth: 0,
    },
    metrics: {
        flex: 1,
        flexDirection: "row",
        gap: 10,
    },
    reset: {
        backgroundColor: "#1E293B",
        borderColor: "#475569",
        borderRadius: 8,
        borderWidth: 1,
        marginLeft: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    resetText: {
        color: "#E2E8F0",
        fontSize: 11,
        fontWeight: "700",
    },
    value: {
        color: "#F8FAFC",
        fontSize: 15,
        fontVariant: ["tabular-nums"],
        fontWeight: "800",
    },
});
