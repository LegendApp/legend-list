import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { LegendListDatasets } from "@legendapp/list/react-native";

type Item = { id: string; title: string; subtitle: string };

function makeItems(prefix: string, count: number): Item[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `${prefix}-${i}`,
        subtitle: `subtitle for ${prefix} ${i}`,
        title: `${prefix} ${i}`,
    }));
}

const RED = makeItems("Red", 500);
const GREEN = makeItems("Green", 500);
const BLUE = makeItems("Blue", 500);

const TABS = [
    { color: "#ffcccc", data: RED, key: "red", label: "Red" },
    { color: "#ccffcc", data: GREEN, key: "green", label: "Green" },
    { color: "#cce4ff", data: BLUE, key: "blue", label: "Blue" },
];
const COLORS_BY_KEY = Object.fromEntries(TABS.map((tab) => [tab.key, tab.color]));

let headerRenderCount = 0;

function SharedHeader() {
    headerRenderCount += 1;
    const renderedAt = headerRenderCount;
    return (
        <View style={{ backgroundColor: "#222", padding: 16 }}>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "600" }}>Shared Header</Text>
            <Text style={{ color: "#bbb", fontSize: 12, marginTop: 4 }}>
                Header render count: {renderedAt} (should stay at 1 across tab switches)
            </Text>
        </View>
    );
}

export default function DatasetsTabsFixture() {
    const [active, setActive] = useState<string>("red");

    const datasets = useMemo(
        () =>
            TABS.map((t) => ({
                data: t.data,
                key: t.key,
            })),
        [],
    );

    return (
        <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: "#eee", flexDirection: "row", gap: 8, padding: 8 }}>
                {TABS.map((t) => (
                    <Pressable
                        key={t.key}
                        onPress={() => setActive(t.key)}
                        style={{
                            alignItems: "center",
                            backgroundColor: active === t.key ? "#333" : "#bbb",
                            borderRadius: 6,
                            flex: 1,
                            paddingVertical: 10,
                        }}
                    >
                        <Text style={{ color: "white", fontWeight: "600" }}>{t.label}</Text>
                    </Pressable>
                ))}
            </View>
            <LegendListDatasets
                activeDatasetKey={active}
                datasets={datasets}
                estimatedItemSize={70}
                inactiveDatasetBehavior="pause"
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<SharedHeader />}
                recycleItems
                renderItem={({ datasetKey, item }) => (
                    <View
                        style={{
                            backgroundColor: COLORS_BY_KEY[datasetKey],
                            borderRadius: 8,
                            marginHorizontal: 12,
                            marginVertical: 4,
                            padding: 14,
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: "600" }}>{item.title}</Text>
                        <Text style={{ color: "#444", fontSize: 12 }}>{item.subtitle}</Text>
                    </View>
                )}
                staggerMountMs={100}
            />
        </View>
    );
}
