import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";

type Item = {
    id: string;
    height: number;
};

type ItemLayout = {
    height: number;
    y: number;
};

type HorizontalAlignItemsFixtureState = {
    flatListLayouts: Record<string, ItemLayout>;
    legendListLayouts: Record<string, ItemLayout>;
    legendListPass: boolean;
};

declare global {
    var __legendHorizontalAlignItemsFixture: (() => HorizontalAlignItemsFixtureState) | undefined;
}

const DATA: Item[] = [1, 2, 3].map((value) => ({
    height: value * 50,
    id: `item-${value}`,
}));

const GAP = 16;
const ITEM_WIDTH = 50;
const LIST_HEIGHT = 174;

function areBottomsAligned(layouts: Record<string, ItemLayout>) {
    const values = Object.values(layouts);
    if (values.length !== DATA.length) {
        return false;
    }

    const [first, ...rest] = values.map((layout) => Math.round(layout.y + layout.height));
    return rest.every((bottom) => bottom === first);
}

export default function HorizontalAlignItemsFixture() {
    const data = useMemo(() => DATA, []);
    const [flatListLayouts, setFlatListLayouts] = useState<Record<string, ItemLayout>>({});
    const [legendListLayouts, setLegendListLayouts] = useState<Record<string, ItemLayout>>({});
    const legendListPass = areBottomsAligned(legendListLayouts);

    const updateFlatListLayout = useCallback((id: string, layout: ItemLayout) => {
        setFlatListLayouts((prev) => ({ ...prev, [id]: layout }));
    }, []);

    const updateLegendListLayout = useCallback((id: string, layout: ItemLayout) => {
        setLegendListLayouts((prev) => ({ ...prev, [id]: layout }));
    }, []);

    useEffect(() => {
        globalThis.__legendHorizontalAlignItemsFixture = () => ({
            flatListLayouts,
            legendListLayouts,
            legendListPass,
        });

        return () => {
            globalThis.__legendHorizontalAlignItemsFixture = undefined;
        };
    }, [flatListLayouts, legendListLayouts, legendListPass]);

    return (
        <View style={styles.container}>
            <View>
                <Text style={styles.title}>FlatList</Text>
                <FlatList
                    contentContainerStyle={styles.contentContainer}
                    data={data}
                    horizontal
                    keyExtractor={(item) => item.id}
                    renderItem={({ item, index }) => (
                        <View
                            accessibilityLabel={`flatlist-align-item-${index}`}
                            onLayout={(event) => {
                                updateFlatListLayout(item.id, {
                                    height: event.nativeEvent.layout.height,
                                    y: event.nativeEvent.layout.y,
                                });
                            }}
                            style={[styles.item, { height: item.height }]}
                        />
                    )}
                    scrollEnabled={false}
                    showsHorizontalScrollIndicator={false}
                    style={styles.list}
                />
            </View>
            <View>
                <Text style={styles.title}>LegendList {legendListPass ? "PASS" : "PENDING"}</Text>
                <LegendList
                    contentContainerStyle={styles.contentContainer}
                    data={data}
                    estimatedItemSize={ITEM_WIDTH}
                    getFixedItemSize={() => ITEM_WIDTH}
                    horizontal
                    keyExtractor={(item) => item.id}
                    recycleItems
                    renderItem={({ item, index }) => (
                        <View
                            accessibilityLabel={`legendlist-align-item-${index}`}
                            onLayout={(event) => {
                                updateLegendListLayout(item.id, {
                                    height: event.nativeEvent.layout.height,
                                    y: event.nativeEvent.layout.y,
                                });
                            }}
                            style={[styles.item, { height: item.height }]}
                        />
                    )}
                    showsHorizontalScrollIndicator={false}
                    style={styles.list}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#F8FAFC",
        flex: 1,
        gap: 24,
        padding: 16,
    },
    contentContainer: {
        alignItems: "flex-end",
        backgroundColor: "#2563EB",
        gap: GAP,
    },
    item: {
        backgroundColor: "#FACC15",
        width: ITEM_WIDTH,
    },
    list: {
        flexGrow: 0,
        height: LIST_HEIGHT,
    },
    title: {
        color: "#0F172A",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 8,
    },
});
