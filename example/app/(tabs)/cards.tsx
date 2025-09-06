import { useRef, useState } from "react";
import { LogBox, Platform, StyleSheet, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list";
import { type Item, ItemCard } from "~/app/cards-renderItem";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";

LogBox.ignoreLogs(["Open debugger"]);

interface CardsProps {
    numColumns?: number;
}

export default function Cards({ numColumns = 1 }: CardsProps) {
    const listRef = useRef<LegendListRef>(null);

    const [data, _setData] = useState<Item[]>(
        () =>
            Array.from({ length: 10000 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    // Note that if benchmarking against other cards implementations
    // it should use the same props
    return (
        <View key="legendlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                data={data}
                drawDistance={DRAW_DISTANCE}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                extraData={{ recycleState: true }}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
                numColumns={numColumns}
                recycleItems={true}
                ref={listRef}
                renderItem={ItemCard as any}
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
});
