import { LegendList, type LegendListRef } from "@legendapp/list";
import { useNavigation } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { type Item, renderItem } from "./renderFixedItem";

const ITEM_HEIGHT = 400;
const SEPARATOR_HEIGHT = 52;
const ESTIMATED_ITEM_LENGTH = 200;

type RenderItem = Item & { type: "separator" | "item" };

const RenderMultiItem = ({
    item,
    index,
}: {
    item: RenderItem;
    index: number;
}) => {
    if (item.type === "separator") {
        return (
            <View
                style={{
                    height: SEPARATOR_HEIGHT,
                    backgroundColor: "red",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <Text style={{ color: "white" }}>Separator {item.id}</Text>
            </View>
        );
    }
    return renderItem({ item, index, height: ITEM_HEIGHT });
};

export default function ScrollIndexDemo() {
    const scrollViewRef = useRef<LegendListRef>(null);

    const [data, setData] = useState<RenderItem[]>(
        () =>
            Array.from({ length: 500 }, (_, i) => ({
                id: i.toString(),
                type: i % 3 === 0 ? "separator" : "item",
            })) as any[],
    );
    const stickyIndices = Array.from({ length: Math.floor(500 / 3) }, (_, i) => i*3);

    const navigation = useNavigation();
    useLayoutEffect(() => {
        navigation.setOptions({
            title: "Initial scroll index",
        });
    }, []);

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                ref={scrollViewRef}
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                contentContainerStyle={styles.listContainer}
                data={data}
                renderItem={RenderMultiItem}
                keyExtractor={(item) => item.id}
                getEstimatedItemSize={(i, item) => (data[i].type === "separator" ? 52 : 400)}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                drawDistance={1000}
                recycleItems={true}
                stickyIndices={stickyIndices}
                // stickyHeaderHiddenOnScroll // <-- that's also working
                onEndReached={({ distanceFromEnd }) => {
                    console.log("onEndReached", distanceFromEnd);
                }}
                //ListHeaderComponent={<View />}
                //ListHeaderComponentStyle={styles.listHeader}
                // initialScrollOffset={20000}
                initialScrollIndex={50}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    listHeader: {
        alignSelf: "center",
        height: 100,
        width: 100,
        backgroundColor: "#456AAA",
        borderRadius: 12,
        marginHorizontal: 8,
        marginTop: 8,
    },
    outerContainer: {
        backgroundColor: "#456",
    },
    scrollContainer: {
        paddingHorizontal: 16,
        // paddingrVertical: 48,
    },

    listContainer: {
        // paddingHorizontal: 16,
        paddingTop: 0,
    },
});
