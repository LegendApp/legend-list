import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type AdaptiveRender, LegendList, useAdaptiveRender } from "@legendapp/list/react-native";
import {
    DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY,
    DEFAULT_ADAPTIVE_RENDER_EXIT_DELAY,
    DEFAULT_ADAPTIVE_RENDER_EXIT_VELOCITY,
} from "@/core/adaptiveRender";

type FeedItem = {
    accent: string;
    category: string;
    id: string;
    metric: string;
    summary: string;
    title: string;
};

const CATEGORIES = ["Analytics", "Design", "Ops", "Growth", "Support", "Infra"];
const ACCENTS = ["#2563eb", "#059669", "#dc2626", "#7c3aed", "#ea580c", "#0891b2"];

const DATA: FeedItem[] = Array.from({ length: 2000 }, (_value, index) => {
    const category = CATEGORIES[index % CATEGORIES.length];
    return {
        accent: ACCENTS[index % ACCENTS.length],
        category,
        id: String(index),
        metric: `${Math.round(48 + ((index * 13) % 47))}%`,
        summary:
            "Rich mode renders preview media, metadata, and chart details. Light mode keeps this row cheap while velocity is high.",
        title: `${category} update ${index + 1}`,
    };
});

function ModeBadge({ mode }: { mode: AdaptiveRender }) {
    return (
        <View style={[styles.modeBadge, mode === "light" ? styles.lightBadge : styles.normalBadge]}>
            <Text style={[styles.modeBadgeText, mode === "light" ? styles.lightBadgeText : styles.normalBadgeText]}>
                {mode}
            </Text>
        </View>
    );
}

function Sparkline({ accent, index, mode }: { accent: string; index: number; mode: AdaptiveRender }) {
    return (
        <View style={styles.sparkline}>
            {Array.from({ length: 18 }, (_value, barIndex) => {
                const height = mode === "light" ? 8 : 8 + ((index * 7 + barIndex * 11) % 30);
                return (
                    <View
                        key={barIndex}
                        style={[
                            styles.sparklineBar,
                            {
                                backgroundColor: mode === "light" ? "#e5e7eb" : accent,
                                height,
                                opacity: mode === "light" ? 1 : 0.25 + (barIndex % 4) * 0.15,
                            },
                        ]}
                    />
                );
            })}
        </View>
    );
}

function ScoreValue({ metric, mode }: { metric: string; mode: AdaptiveRender }) {
    return mode === "light" ? <View style={styles.scorePlaceholder} /> : <Text style={styles.metaText}>{metric}</Text>;
}

function FeedRow({ index, item }: { index: number; item: FeedItem }) {
    const mode = useAdaptiveRender();

    return (
        <View style={styles.row}>
            <View style={[styles.media, { backgroundColor: item.accent }]}>
                <Text style={styles.mediaText}>{item.category}</Text>
            </View>
            <View style={styles.rowBody}>
                <View style={styles.rowHeader}>
                    <View style={styles.titleGroup}>
                        <Text style={styles.rowIndex}>Row {index + 1}</Text>
                        <Text numberOfLines={1} style={styles.rowTitle}>
                            {item.title}
                        </Text>
                    </View>
                    <ModeBadge mode={mode} />
                </View>
                <Text style={styles.summary}>{item.summary}</Text>
                <View style={styles.metaRow}>
                    <View style={styles.metaPill}>
                        <Text style={styles.metaText}>score </Text>
                        <ScoreValue metric={item.metric} mode={mode} />
                    </View>
                    <View style={styles.metaPill}>
                        <Text style={styles.metaText}>render {mode}</Text>
                    </View>
                    <View style={styles.metaPill}>
                        <Text style={styles.metaText}>id {item.id}</Text>
                    </View>
                </View>
                <Sparkline accent={item.accent} index={index} mode={mode} />
            </View>
        </View>
    );
}

function Stepper({
    label,
    max,
    min,
    onChange,
    step,
    suffix = "",
    value,
}: {
    label: string;
    max: number;
    min: number;
    onChange: (value: number) => void;
    step: number;
    suffix?: string;
    value: number;
}) {
    const decrement = () => onChange(Math.max(min, Number((value - step).toFixed(1))));
    const increment = () => onChange(Math.min(max, Number((value + step).toFixed(1))));

    return (
        <View style={styles.stepper}>
            <Text style={styles.stepperLabel}>{label}</Text>
            <Pressable onPress={decrement} style={styles.stepperButton}>
                <Text style={styles.stepperButtonText}>-</Text>
            </Pressable>
            <Text style={styles.stepperValue}>
                {value}
                {suffix}
            </Text>
            <Pressable onPress={increment} style={styles.stepperButton}>
                <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
        </View>
    );
}

export default function AdaptiveRenderFixture() {
    const [enabled, setEnabled] = useState(true);
    const [enterVelocity, setEnterVelocity] = useState(DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY);
    const [exitVelocity, setExitVelocity] = useState(DEFAULT_ADAPTIVE_RENDER_EXIT_VELOCITY);
    const [exitDelay, setExitDelay] = useState(DEFAULT_ADAPTIVE_RENDER_EXIT_DELAY);
    const [mode, setMode] = useState<AdaptiveRender>("normal");

    const adaptiveRender = useMemo(
        () =>
            enabled
                ? {
                      enterVelocity,
                      exitDelay,
                      exitVelocity,
                      onChange: setMode,
                  }
                : undefined,
        [enabled, enterVelocity, exitDelay, exitVelocity],
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.title}>Adaptive Render</Text>
                        <Text style={styles.subtitle}>Fast scroll blanks expensive row details.</Text>
                    </View>
                    <Pressable
                        onPress={() => {
                            setEnabled((value) => {
                                const nextValue = !value;
                                if (!nextValue) {
                                    setMode("normal");
                                }
                                return nextValue;
                            });
                        }}
                        style={[styles.toggle, enabled && styles.toggleEnabled]}
                    >
                        <Text style={[styles.toggleText, enabled && styles.toggleTextEnabled]}>
                            {enabled ? "Enabled" : "Disabled"}
                        </Text>
                    </Pressable>
                </View>
                <View style={styles.controls}>
                    <Stepper
                        label="Enter"
                        max={16}
                        min={0.5}
                        onChange={setEnterVelocity}
                        step={0.5}
                        value={enterVelocity}
                    />
                    <Stepper label="Exit" max={8} min={0} onChange={setExitVelocity} step={0.5} value={exitVelocity} />
                    <Stepper
                        label="Delay"
                        max={2000}
                        min={0}
                        onChange={setExitDelay}
                        step={100}
                        suffix="ms"
                        value={exitDelay}
                    />
                </View>
            </View>
            <View style={styles.modeOverlay}>
                <ModeBadge mode={mode} />
            </View>
            <LegendList<FeedItem>
                data={DATA}
                estimatedItemSize={136}
                experimental_adaptiveRender={adaptiveRender}
                keyExtractor={(item) => item.id}
                recycleItems
                renderItem={({ item, index }) => <FeedRow index={index} item={item} />}
                scrollEventThrottle={16}
                style={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#f8fafc",
        flex: 1,
    },
    controls: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 10,
    },
    header: {
        backgroundColor: "#fff",
        borderBottomColor: "#e5e7eb",
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTop: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    lightBadge: {
        backgroundColor: "#fef3c7",
    },
    lightBadgeText: {
        color: "#92400e",
    },
    list: {
        flex: 1,
    },
    media: {
        borderRadius: 6,
        height: 80,
        justifyContent: "flex-end",
        padding: 8,
        width: 96,
    },
    mediaText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
    },
    metaPill: {
        alignItems: "center",
        backgroundColor: "#f1f5f9",
        borderRadius: 4,
        flexDirection: "row",
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 10,
    },
    metaText: {
        color: "#475569",
        fontSize: 12,
    },
    modeBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    modeBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    modeOverlay: {
        alignItems: "flex-end",
        paddingHorizontal: 16,
        paddingTop: 8,
        position: "absolute",
        right: 0,
        top: 116,
        zIndex: 1,
    },
    normalBadge: {
        backgroundColor: "#dcfce7",
    },
    normalBadgeText: {
        color: "#166534",
    },
    row: {
        backgroundColor: "#fff",
        borderBottomColor: "#e5e7eb",
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    rowBody: {
        flex: 1,
        minWidth: 0,
    },
    rowHeader: {
        alignItems: "flex-start",
        flexDirection: "row",
        gap: 8,
        justifyContent: "space-between",
    },
    rowIndex: {
        color: "#64748b",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    rowTitle: {
        color: "#0f172a",
        fontSize: 16,
        fontWeight: "700",
        marginTop: 3,
    },
    scorePlaceholder: {
        backgroundColor: "#cbd5e1",
        borderRadius: 4,
        height: 12,
        width: 28,
    },
    sparkline: {
        alignItems: "flex-end",
        flexDirection: "row",
        gap: 3,
        height: 40,
        marginTop: 12,
    },
    sparklineBar: {
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        width: 6,
    },
    stepper: {
        alignItems: "center",
        backgroundColor: "#f8fafc",
        borderColor: "#e2e8f0",
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    stepperButton: {
        alignItems: "center",
        backgroundColor: "#e2e8f0",
        borderRadius: 4,
        height: 24,
        justifyContent: "center",
        width: 24,
    },
    stepperButtonText: {
        color: "#0f172a",
        fontSize: 16,
        fontWeight: "700",
        lineHeight: 18,
    },
    stepperLabel: {
        color: "#475569",
        fontSize: 12,
        fontWeight: "700",
    },
    stepperValue: {
        color: "#0f172a",
        fontSize: 12,
        fontVariant: ["tabular-nums"],
        minWidth: 42,
        textAlign: "center",
    },
    subtitle: {
        color: "#64748b",
        fontSize: 12,
        marginTop: 3,
    },
    summary: {
        color: "#475569",
        fontSize: 13,
        lineHeight: 18,
        marginTop: 8,
    },
    title: {
        color: "#0f172a",
        fontSize: 18,
        fontWeight: "700",
    },
    titleGroup: {
        flex: 1,
    },
    toggle: {
        borderColor: "#cbd5e1",
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    toggleEnabled: {
        backgroundColor: "#1d4ed8",
        borderColor: "#1d4ed8",
    },
    toggleText: {
        color: "#475569",
        fontSize: 13,
        fontWeight: "700",
    },
    toggleTextEnabled: {
        color: "#fff",
    },
});
