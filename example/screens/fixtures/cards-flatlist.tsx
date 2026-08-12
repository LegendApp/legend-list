import { FlatList, type ListRenderItemInfo, StyleSheet, View } from "react-native";

import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import type { DemoMetricStore } from "~/lib/demoMetrics";
import renderItem, { type Item } from "~/screens/fixtures/shared/cardsRenderItem";

export default function CardsFlatList({ metrics }: { metrics?: DemoMetricStore }) {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i.toString() }));

    const renderItemFn = (info: ListRenderItemInfo<Item>) => {
        const legendListProps = {
            data,
            extraData: { metrics },
            index: info.index,
            item: info.item,
            type: undefined,
        } satisfies LegendListRenderItemProps<Item>;

        return renderItem({ ...legendListProps, metrics });
    };

    return (
        <View key="flatlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <FlatList
                data={data}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
                renderItem={renderItemFn}
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
