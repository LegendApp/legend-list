import { useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";

const ITEM_HEIGHT = 200;
const ITEM_WIDTH = 200;
const PADDING_BOTTOM = 32;
const ITEMS = Array.from({ length: 6 }, (_, index) => ({
    id: `horizontal-cross-axis-${index}`,
    label: `Card ${index + 1}`,
}));

type CrossAxisFixtureState = {
    itemHeight: number;
    listHeight: number;
    pass: boolean;
    wrapperHeight: number;
};

declare global {
    var __legendCrossAxisFixture: (() => CrossAxisFixtureState) | undefined;
}

export default function HorizontalCrossAxisFixture() {
    const [itemHeight, setItemHeight] = useState(0);
    const [listHeight, setListHeight] = useState(0);
    const [wrapperHeight, setWrapperHeight] = useState(0);
    const data = useMemo(() => ITEMS, []);
    const pass = listHeight >= ITEM_HEIGHT && wrapperHeight >= ITEM_HEIGHT && itemHeight === ITEM_HEIGHT;

    useEffect(() => {
        globalThis.__legendCrossAxisFixture = () => ({
            itemHeight,
            listHeight,
            pass,
            wrapperHeight,
        });

        return () => {
            globalThis.__legendCrossAxisFixture = undefined;
        };
    }, [itemHeight, listHeight, pass, wrapperHeight]);

    return (
        <View style={styles.container}>
            <Text accessibilityLabel="cross-axis-status" style={styles.status}>
                CrossAxis {pass ? "PASS" : "PENDING"} list={Math.round(listHeight)} wrapper=
                {Math.round(wrapperHeight)} item={Math.round(itemHeight)}
            </Text>
            <View onLayout={(event) => setWrapperHeight(event.nativeEvent.layout.height)} style={styles.wrapper}>
                <LegendList
                    contentContainerStyle={styles.content}
                    data={data}
                    estimatedItemSize={ITEM_WIDTH}
                    estimatedListSize={{ height: 1, width: Dimensions.get("window").width }}
                    getFixedItemSize={() => ITEM_WIDTH}
                    horizontal
                    keyExtractor={(item) => item.id}
                    onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
                    recycleItems
                    renderItem={({ item, index }) => (
                        <View
                            accessibilityLabel={`cross-axis-card-${index}`}
                            onLayout={(event) => {
                                if (index === 0) {
                                    setItemHeight(event.nativeEvent.layout.height);
                                }
                            }}
                            style={styles.item}
                        >
                            <Text style={styles.itemLabel}>{item.label}</Text>
                        </View>
                    )}
                    showsHorizontalScrollIndicator={false}
                />
            </View>
            <Text style={styles.caption}>Expected card height: {ITEM_HEIGHT}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    caption: {
        color: "#475569",
        fontSize: 13,
        marginTop: 12,
    },
    container: {
        backgroundColor: "#F8FAFC",
        flex: 1,
        padding: 16,
    },
    content: {
        paddingBottom: PADDING_BOTTOM,
    },
    item: {
        alignItems: "center",
        backgroundColor: "#DC2626",
        height: ITEM_HEIGHT,
        justifyContent: "center",
        marginHorizontal: 16,
        width: ITEM_WIDTH,
    },
    itemLabel: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "700",
    },
    status: {
        color: "#0F172A",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 12,
    },
    wrapper: {
        backgroundColor: "#DBEAFE",
    },
});
