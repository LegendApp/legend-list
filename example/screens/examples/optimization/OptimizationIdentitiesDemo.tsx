import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react-native";
import { DemoButton, DemoControlRow, DemoHint, DemoModeSwitch } from "~/components/DemoControls";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";

type IdentityItem = {
    id: string;
    label: string;
};

type IdentityMode = "stable" | "unstable";

const DATA: IdentityItem[] = Array.from({ length: 80 }, (_, index) => ({
    id: `identity-${index}`,
    label: `Item ${index}`,
}));
const CONTENT_STYLE = { paddingBottom: 32 };
const MODES: Array<{ label: string; value: IdentityMode }> = [
    { label: "Changing props", value: "unstable" },
    { label: "Stable props", value: "stable" },
];

function keyExtractor(item: IdentityItem) {
    return item.id;
}

function IdentityHint() {
    return (
        <DemoHint>
            Render the parent to compare changing renderItem, keyExtractor, and content style with stable identities;
            row renders are tracked separately.
        </DemoHint>
    );
}

function IdentityRow({ item, metrics }: { item: IdentityItem; metrics: DemoMetricStore }) {
    const renderCount = useRef(0);
    renderCount.current += 1;
    metrics.increment("rowRenders");

    return (
        <View style={styles.row}>
            <View style={styles.rowDot} />
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowCount}>render {renderCount.current}</Text>
        </View>
    );
}

function StableIdentityList({ metrics, parentTick }: { metrics: DemoMetricStore; parentTick: number }) {
    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<IdentityItem>) => <IdentityRow item={item} metrics={metrics} />,
        [metrics],
    );

    return (
        <View style={styles.list} testID={`stable-parent-render-${parentTick}`}>
            <LegendList
                contentContainerStyle={CONTENT_STYLE}
                data={DATA}
                estimatedItemSize={58}
                keyExtractor={keyExtractor}
                ListHeaderComponent={IdentityHint}
                recycleItems
                renderItem={renderItem}
                style={styles.list}
            />
        </View>
    );
}

function ChangingIdentityList({ metrics, parentTick }: { metrics: DemoMetricStore; parentTick: number }) {
    const renderItem = ({ item }: LegendListRenderItemProps<IdentityItem>) => (
        <IdentityRow item={item} metrics={metrics} />
    );
    const changingKeyExtractor = (item: IdentityItem) => item.id;
    const contentContainerStyle = { paddingBottom: 32 };
    const previousProps = useRef({ contentContainerStyle, keyExtractor: changingKeyExtractor, renderItem });

    if (previousProps.current.contentContainerStyle !== contentContainerStyle) {
        metrics.increment("propChanges");
    }
    if (previousProps.current.keyExtractor !== changingKeyExtractor) {
        metrics.increment("propChanges");
    }
    if (previousProps.current.renderItem !== renderItem) {
        metrics.increment("propChanges");
    }
    previousProps.current = { contentContainerStyle, keyExtractor: changingKeyExtractor, renderItem };

    return (
        <View style={styles.list} testID={`changing-parent-render-${parentTick}`}>
            <LegendList
                contentContainerStyle={contentContainerStyle}
                data={DATA}
                estimatedItemSize={58}
                keyExtractor={changingKeyExtractor}
                ListHeaderComponent={IdentityHint}
                recycleItems
                renderItem={renderItem}
                style={styles.list}
            />
        </View>
    );
}

export function OptimizationIdentitiesDemo() {
    const metrics = useDemoMetricStore([
        { id: "parentRenders", initialValue: 0, label: "Parent renders" },
        { id: "propChanges", initialValue: 0, label: "Prop changes" },
        { id: "rowRenders", initialValue: 0, label: "Row renders" },
    ]);
    const [mode, setMode] = useState<IdentityMode>("unstable");
    const [parentTick, setParentTick] = useState(0);
    metrics.increment("parentRenders");

    const selectMode = (nextMode: IdentityMode) => {
        metrics.reset();
        setMode(nextMode);
    };

    return (
        <View style={styles.screen}>
            <DemoStatsBar store={metrics} />
            <DemoModeSwitch modes={MODES} onSelect={selectMode} selected={mode} />
            <DemoControlRow>
                <DemoButton
                    label={`Render parent (${parentTick})`}
                    onPress={() => setParentTick((value) => value + 1)}
                />
            </DemoControlRow>
            <View style={styles.listFrame}>
                {mode === "stable" ? (
                    <StableIdentityList metrics={metrics} parentTick={parentTick} />
                ) : (
                    <ChangingIdentityList metrics={metrics} parentTick={parentTick} />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    list: {
        flex: 1,
    },
    listFrame: {
        borderTopColor: "#E2E8F0",
        borderTopWidth: 1,
        flex: 1,
    },
    row: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderBottomColor: "#E2E8F0",
        borderBottomWidth: 1,
        flexDirection: "row",
        height: 58,
        paddingHorizontal: 14,
    },
    rowCount: {
        color: "#64748B",
        fontSize: 12,
        fontVariant: ["tabular-nums"],
    },
    rowDot: {
        backgroundColor: "#818CF8",
        borderRadius: 5,
        height: 10,
        marginRight: 10,
        width: 10,
    },
    rowLabel: {
        color: "#0F172A",
        flex: 1,
        fontSize: 15,
        fontWeight: "600",
    },
    screen: {
        flex: 1,
    },
});
