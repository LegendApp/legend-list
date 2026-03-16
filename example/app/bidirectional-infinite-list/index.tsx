import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { type Item, renderItem } from "~/app/cards-renderItem";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";

export default function BidirectionalInfiniteList() {
    const listRef = useRef<LegendListRef>(null);

    const [data, setData] = useState<Item[]>(
        () =>
            Array.from({ length: 20 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    const onRefresh = () => {
        setTimeout(() => {
            setData((prevData) => {
                const initialIndex = Number.parseInt(prevData[0].id);
                const newData = [
                    ...Array.from({ length: 5 }, (_, i) => ({
                        id: (initialIndex - i - 1).toString(),
                    })).reverse(),
                    ...prevData,
                ];
                return newData;
            });
        }, 500);
    };

    const { bottom } = useSafeAreaInsets();

    return (
        <View key="legendlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                data={data}
                drawDistance={DRAW_DISTANCE}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                initialScrollIndex={10}
                keyExtractor={(item) => `id${item.id}`}
                ListFooterComponent={<View style={{ height: bottom }} />}
                maintainVisibleContentPosition
                onEndReached={({ distanceFromEnd }) => {
                    if (distanceFromEnd > 0) {
                        setTimeout(() => {
                            setData((prevData) => {
                                const newData = [
                                    ...prevData,
                                    ...Array.from({ length: 10 }, (_, i) => ({
                                        id: (Number.parseInt(prevData[prevData.length - 1].id) + i + 1).toString(),
                                    })),
                                ];
                                return newData;
                            });
                        }, 500);
                    }
                }}
                onStartReached={onRefresh}
                recycleItems
                ref={listRef}
                renderItem={renderItem}
                style={[StyleSheet.absoluteFill]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
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
});
