import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LegendList, type LegendListRef } from "@legendapp/list";
import { type Item, renderItem } from "~/app/cards-renderItem";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";

//** Purpose of this component is to show that LegendList with initialScrollIndex can correctly scroll to the begginning
// and the end of the list even if element height is unknown and calculated dynamically */
export default function IntialScrollIndexFreeHeight() {
    const listRef = useRef<LegendListRef>(null);

    const [data, _setData] = useState<Item[]>(
        () =>
            Array.from({ length: 100 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    const { bottom } = useSafeAreaInsets();

    return (
        <View key="legendlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                contentContainerStyle={styles.listContainer}
                data={data}
                drawDistance={DRAW_DISTANCE}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                initialScrollIndex={50}
                keyExtractor={(item) => `id${item.id}`}
                ListFooterComponent={<View style={{ height: bottom }} />}
                maintainVisibleContentPosition
                numColumns={1}
                recycleItems={true}
                ref={listRef}
                //ListHeaderComponent={<View style={{ height: top }} />}
                renderItem={renderItem}
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
