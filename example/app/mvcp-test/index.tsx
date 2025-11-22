import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LegendList, type LegendListRef, useSyncLayout } from "@legendapp/list";
import { observable } from "@legendapp/state";
import { useSelector } from "@legendapp/state/react";
import type { Item } from "~/app/cards-renderItem";
import { ESTIMATED_ITEM_LENGTH } from "~/constants/constants";

// Create a global observable store for item heights
const store = observable({
    map: {} as Record<number, number>,
    updateAncestor: (index: number) => {
        const prevIndex = index - 1;
        const prevHeight = store.map[prevIndex].peek() ?? 300;

        const newHeight = prevHeight + 100;
        console.log("set", prevIndex, "to", newHeight);

        // Update the height for the previous item
        store.map[prevIndex].set(newHeight);
    },
});

interface ItemComponentProps {
    index: number;
}

const ItemComponent = ({ index }: ItemComponentProps) => {
    // Use .get() to observe the height - observer wrapper will handle reactivity
    const height = useSelector(store.map[index]) ?? 300;
    const syncLayout = useSyncLayout();

    const randomBgColor = ["red", "green", "yellow", "purple", "blue", "orange", "lightgrey"][index % 7];

    return (
        <Pressable
            onPress={() => {
                store.updateAncestor(index);
                syncLayout();
            }}
            style={{
                alignItems: "center",
                backgroundColor: randomBgColor,
                height,
                justifyContent: "center",
                position: "relative",
                width: "100%",
            }}
        >
            <Text style={{ color: "white", fontSize: 12, left: 10, position: "absolute", top: 10 }}>
                item #{index} height: {height}
            </Text>
            <Text style={{ color: "white", fontSize: 16 }}>Change</Text>
        </Pressable>
    );
};

export default function MVCPTest() {
    const listRef = useRef<LegendListRef>(null);

    const [data] = useState<Item[]>(
        () =>
            Array.from({ length: 30 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    const { bottom } = useSafeAreaInsets();

    return (
        <View key="legendlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                contentContainerStyle={styles.listContainer}
                data={data}
                drawDistance={2000}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                initialScrollIndex={10}
                keyExtractor={(item) => `id${item.id}`}
                ListFooterComponent={<View style={{ height: bottom }} />}
                maintainVisibleContentPosition
                numColumns={1}
                recycleItems={true}
                ref={listRef}
                //ListHeaderComponent={<View style={{ height: top }} />}
                renderItem={({ index }) => <ItemComponent index={index} />}
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    listContainer: {
        marginHorizontal: "auto",
        maxWidth: "100%",
        width: "100%",
    },
    listEmpty: {
        alignItems: "center",
        backgroundColor: "#6789AB",
        flex: 1,
        justifyContent: "center",
        paddingVertical: 16,
    },
    listHeader: {
        alignSelf: "center",
        backgroundColor: "#456AAA",
        borderRadius: 12,
        height: 100,
        marginHorizontal: 8,
        marginVertical: 8,
        width: 100,
    },
    outerContainer: {
        backgroundColor: "#456",
    },
    scrollContainer: {},
});
