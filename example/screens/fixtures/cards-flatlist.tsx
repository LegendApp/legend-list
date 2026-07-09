import { FlatList, type ListRenderItemInfo, StyleSheet, View } from "react-native";

import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import renderItem, { type Item } from "~/screens/fixtures/shared/cardsRenderItem";

export default function CardsFlatList() {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i.toString() }));

    const renderItemFn = (info: ListRenderItemInfo<Item>) => {
        const legendListProps = {
            data,
            extraData: undefined,
            index: info.index,
            item: info.item,
            type: undefined,
        } satisfies LegendListRenderItemProps<Item>;

        return renderItem(legendListProps);
    };

    return (
        <View key="flatlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <FlatList
                data={data}
                initialNumToRender={10} // Reduce initial render amount for a closer comparison to LegendList
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader} // Reduced batch size for smoother scrolling
                renderItem={renderItemFn}
                windowSize={3} // Reduce window size for a closer comparison to LegendList
                // maxToRenderPerBatch={5}
                // initialNumToRender={8}
                // removeClippedSubviews={true} // Reduced window size for better performance
                // style={[StyleSheet.absoluteFill, styles.scrollContainer]} // Initial render amount
                // updateCellsBatchingPeriod={50} // Detach views outside of the viewport
                // windowSize={3} // Batching period for updates
            />
        </View>
    );
}

const styles = StyleSheet.create({
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
});
