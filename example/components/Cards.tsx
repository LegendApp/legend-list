import { useRef, useState } from "react";
import { LogBox, StyleSheet, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";
import { type Item, renderFixedCardItem, renderItem } from "~/screens/fixtures/shared/cardsRenderItem";

LogBox.ignoreLogs(["Open debugger"]);

interface CardsProps {
    fixedItemSize?: number;
    numColumns?: number;
}

export default function Cards({ fixedItemSize, numColumns = 1 }: CardsProps) {
    const listRef = useRef<LegendListRef>(null);

    const [data, _setData] = useState<Item[]>(
        () =>
            Array.from({ length: 1000 }, (_, i) => ({
                id: i.toString(),
            })) as Item[],
    );

    return (
        <View key="legendlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                data={data}
                drawDistance={DRAW_DISTANCE}
                estimatedItemSize={fixedItemSize ?? ESTIMATED_ITEM_LENGTH}
                extraData={{ recycleState: true }}
                getFixedItemSize={fixedItemSize !== undefined ? () => fixedItemSize : undefined}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
                numColumns={numColumns}
                recycleItems={true}
                ref={listRef}
                renderItem={fixedItemSize !== undefined ? renderFixedCardItem : renderItem}
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
