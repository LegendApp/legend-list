import { type Item, renderItem } from "@/app/cards-renderItem";
import { DO_SCROLL_TEST, DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "@/constants/constants";
import { useScrollTest } from "@/constants/useScrollTest";
import { LegendList, type LegendListRef } from "@legendapp/list";
import { useRef, useState } from "react";
import { LogBox, Platform, StyleSheet, Text, View } from "react-native";

LogBox.ignoreLogs(["Open debugger"]);

interface CardsProps {
    numColumns?: number;
}

export default function Cards({ numColumns = 1 }: CardsProps) {
    const listRef = useRef<LegendListRef>(null);

    const [data, setData] = useState<Item[]>(
        () =>
            Array.from({ length: 1000 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    if (DO_SCROLL_TEST) {
        useScrollTest((offset) => {
            listRef.current?.scrollToOffset({
                offset: offset,
                animated: true,
            });
        });
    }

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]} key="legendlist">
            <LegendList
                ref={listRef}
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                contentContainerStyle={styles.listContainer}
                data={data}
                renderItem={renderItem}
                keyExtractor={(item) => `id${item.id}`}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                drawDistance={DRAW_DISTANCE}
                recycleItems={false}
                numColumns={numColumns}
                // initialScrollIndex={50}
                // alignItemsAtEnd
                // maintainScrollAtEnd
                // onEndReached={({ distanceFromEnd }) => {
                //     console.log("onEndReached", distanceFromEnd);
                // }}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
                ListFooterComponent={<View />}
                ListFooterComponentStyle={styles.listHeader}
                ListEmptyComponent={
                    <View style={styles.listEmpty}>
                        <Text style={{ color: "white" }}>Empty</Text>
                    </View>
                }
                // viewabilityConfigCallbackPairs={[
                //     {
                //         viewabilityConfig: { id: "viewability", viewAreaCoveragePercentThreshold: 50 },
                //         // onViewableItemsChanged: ({ viewableItems, changed }) => {
                //         //     console.log(
                //         //         'onViewableItems',
                //         //         viewableItems.map((v) => v.key),
                //         //     );
                //         //     // console.log('onViewableChanged', changed);
                //         // },
                //     },
                // ]}

                // initialScrollOffset={20000}
                // initialScrollIndex={500}
                // inverted
                // horizontal
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
        marginVertical: 8,
    },
    listEmpty: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#6789AB",
        paddingVertical: 16,
    },
    outerContainer: {
        backgroundColor: "#456",
        bottom: Platform.OS === "ios" ? 82 : 0,
    },
    scrollContainer: {},
    listContainer: {
        width: 400,
        maxWidth: "100%",
        marginHorizontal: "auto",
    },
});
