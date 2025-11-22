import { useNavigation } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list";
import { type Item, renderItem } from "./renderFixedItem";

const ITEM_HEIGHT = 400;
const SEPARATOR_HEIGHT = 52;
const ESTIMATED_ITEM_LENGTH = 200;

type RenderItem = Item & { type: "separator" | "item" };

const RenderMultiItem = ({ item, index }: { item: RenderItem; index: number }) => {
    if (item.type === "separator") {
        return (
            <View
                style={{
                    alignItems: "center",
                    backgroundColor: "red",
                    height: SEPARATOR_HEIGHT,
                    justifyContent: "center",
                }}
            >
                <Text style={{ color: "white" }}>Separator {item.id}</Text>
            </View>
        );
    }
    return renderItem({ height: ITEM_HEIGHT, index, item });
};

export default function ScrollIndexDemo() {
    const scrollViewRef = useRef<LegendListRef>(null);

    const [data, _setData] = useState<RenderItem[]>(
        () =>
            Array.from({ length: 500 }, (_, i) => ({
                id: i.toString(),
                type: i % 3 === 0 ? "separator" : "item",
            })) as any[],
    );

    const navigation = useNavigation();
    useLayoutEffect(() => {
        navigation.setOptions({
            title: "Initial scroll index",
        });
    }, []);

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                contentContainerStyle={styles.listContainer}
                data={data}
                drawDistance={1000}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                getEstimatedItemSize={(i, _item) => (data[i].type === "separator" ? 52 : 400)}
                initialScrollIndex={50}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
                onEndReached={({ distanceFromEnd }) => {
                    console.log("onEndReached", distanceFromEnd);
                }}
                // alignItemsAtEnd
                // maintainScrollAtEnd
                recycleItems={true}
                ref={scrollViewRef}
                renderItem={RenderMultiItem}
                // initialScrollOffset={20000}
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                // inverted
                // horizontal
            />
        </View>
    );
}

const styles = StyleSheet.create({
    listContainer: {
        // paddingHorizontal: 16,
        paddingTop: 48,
    },
    listHeader: {
        alignSelf: "center",
        backgroundColor: "#456AAA",
        borderRadius: 12,
        height: 100,
        marginHorizontal: 8,
        marginTop: 8,
        width: 100,
    },
    outerContainer: {
        backgroundColor: "#456",
    },
    scrollContainer: {
        paddingHorizontal: 16,
        // paddingrVertical: 48,
    },
});
