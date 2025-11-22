import { useRef, useState } from "react";
import { LogBox, Platform, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list";
import { type Item, renderItem } from "~/app/cards-renderItem";
import { DO_SCROLL_TEST, DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";
import { useScrollTest } from "~/constants/useScrollTest";

LogBox.ignoreLogs(["Open debugger"]);

interface CardsProps {
    numColumns?: number;
}

export default function Cards({ numColumns = 1 }: CardsProps) {
    const listRef = useRef<LegendListRef>(null);

    const [data, _setData] = useState<Item[]>(
        () =>
            Array.from({ length: 1000 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    if (DO_SCROLL_TEST) {
        useScrollTest((offset) => {
            listRef.current?.scrollToOffset({
                animated: true,
                offset: offset,
            });
        });
    }

    return (
        <View key="legendlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                contentContainerStyle={styles.listContainer}
                data={data}
                drawDistance={DRAW_DISTANCE}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                keyExtractor={(item) => `id${item.id}`}
                ListEmptyComponent={
                    <View style={styles.listEmpty}>
                        <Text style={{ color: "white" }}>Empty</Text>
                    </View>
                }
                ListFooterComponent={<View />}
                ListFooterComponentStyle={styles.listHeader}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
                // initialScrollIndex={50}
                // alignItemsAtEnd
                // maintainScrollAtEnd
                // onEndReached={({ distanceFromEnd }) => {
                //     console.log("onEndReached", distanceFromEnd);
                // }}
                numColumns={numColumns}
                recycleItems={false}
                ref={listRef}
                renderItem={renderItem}
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
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
    listContainer: {
        marginHorizontal: "auto",
        maxWidth: "100%",
        width: 400,
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
        bottom: Platform.OS === "ios" ? 82 : 0,
    },
    scrollContainer: {},
});
