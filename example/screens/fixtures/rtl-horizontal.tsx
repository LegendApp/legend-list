import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";

const ITEM_SIZE = 112;
const ITEMS = Array.from({ length: 30 }, (_, index) => ({
    id: `rtl-${index}`,
    label: `Item ${index}`,
}));

type RTLFixtureState = {
    scrollToEnd: () => void;
    scrollToMiddle: () => void;
    scrollToStart: () => void;
    visible: () => string[];
};

declare global {
    var __legendRTLFixture: RTLFixtureState | undefined;
}

export default function RTLHorizontalFixture() {
    const listRef = useRef<LegendListRef>(null);
    const visibleRef = useRef<string[]>([]);
    const [visible, setVisible] = useState<string[]>([]);
    const data = useMemo(() => ITEMS, []);

    const setVisibleItems = useCallback((labels: string[]) => {
        visibleRef.current = labels;
        setVisible(labels);
    }, []);

    const scrollToStart = useCallback(() => {
        listRef.current?.scrollToOffset({ animated: false, offset: 0 });
    }, []);

    const scrollToMiddle = useCallback(() => {
        listRef.current?.scrollToOffset({ animated: false, offset: ITEM_SIZE * 10 });
    }, []);

    const scrollToEnd = useCallback(() => {
        listRef.current?.scrollToEnd({ animated: false });
    }, []);

    useEffect(() => {
        globalThis.__legendRTLFixture = {
            scrollToEnd,
            scrollToMiddle,
            scrollToStart,
            visible: () => visibleRef.current,
        };

        return () => {
            globalThis.__legendRTLFixture = undefined;
        };
    }, [scrollToEnd, scrollToMiddle, scrollToStart]);

    return (
        <View style={styles.container}>
            <View style={styles.toolbar}>
                <Button onPress={scrollToStart} title="Start" />
                <Button onPress={scrollToMiddle} title="Middle" />
                <Button onPress={scrollToEnd} title="End" />
            </View>
            <Text accessibilityLabel="rtl-visible-items" style={styles.status}>
                Visible: {visible.join(", ") || "none"}
            </Text>
            <LegendList
                data={data}
                estimatedItemSize={ITEM_SIZE}
                getFixedItemSize={() => ITEM_SIZE}
                horizontal
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd
                onViewableItemsChanged={({ viewableItems }) => {
                    setVisibleItems(viewableItems.map((viewable) => viewable.item.label));
                }}
                recycleItems
                ref={listRef}
                renderItem={({ item }) => (
                    <View accessibilityLabel={item.label} style={styles.item}>
                        <Text style={styles.itemLabel}>{item.label}</Text>
                    </View>
                )}
                rtl
                snapToIndices={data.map((_, index) => index)}
                style={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#F4F6F8",
        flex: 1,
    },
    item: {
        alignItems: "center",
        backgroundColor: "#0F766E",
        borderColor: "#0B4F4A",
        borderRadius: 8,
        borderWidth: 1,
        height: 132,
        justifyContent: "center",
        marginHorizontal: 8,
        marginVertical: 16,
        width: ITEM_SIZE - 16,
    },
    itemLabel: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
    list: {
        flexGrow: 0,
        height: 180,
    },
    status: {
        color: "#111827",
        fontSize: 14,
        fontWeight: "600",
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    toolbar: {
        backgroundColor: "#FFFFFF",
        borderBottomColor: "#D1D5DB",
        borderBottomWidth: 1,
        flexDirection: "row",
        justifyContent: "space-around",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
});
