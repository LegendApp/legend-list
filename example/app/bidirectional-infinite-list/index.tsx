import { useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LegendList, type LegendListRef } from "@legendapp/list";
import { type Item, renderItem } from "~/app/cards-renderItem";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";

let last = performance.now();

export default function BidirectionalInfiniteList() {
    const listRef = useRef<LegendListRef>(null);

    const [data, setData] = useState<Item[]>(
        () =>
            Array.from({ length: 20 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = () => {
        console.log("onRefresh");
        setRefreshing(true);
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
            setRefreshing(false);
        }, 500);
    };

    // useEffect(() => {
    //     setTimeout(() => {
    //         setData((prevData) => {
    //             const initialIndex = Number.parseInt(prevData[0].id);
    //             const newData = [
    //                 ...Array.from({ length: 1 }, (_, i) => ({
    //                     id: (initialIndex - i - 1).toString(),
    //                 })).reverse(),
    //                 ...prevData,
    //             ];
    //             return newData;
    //         });
    //     }, 2000);
    // }, []);

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
                    console.log("onEndReached", distanceFromEnd);
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
                onStartReached={(props) => {
                    const time = performance.now();
                    console.log("onStartReached", props, last - time);
                    last = time;
                    onRefresh();
                }}
                recycleItems={true}
                ref={listRef}
                refreshControl={
                    <RefreshControl
                        progressViewOffset={40}
                        //onRefresh={onRefresh}
                        refreshing={refreshing}
                        tintColor={"#ffffff"}
                    />
                }
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
