import { type Item, renderItem } from "@/app/cards-renderItem";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "@/constants/constants";
import { LegendList, type LegendListRef } from "@legendapp/list";
import { useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

    const { top, bottom } = useSafeAreaInsets();

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]} key="legendlist">
            <LegendList
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        //onRefresh={onRefresh}
                        tintColor={"#ffffff"}
                        progressViewOffset={40}
                    />
                }
                ref={listRef}
                initialScrollIndex={10}
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                contentContainerStyle={styles.listContainer}
                data={data}
                renderItem={renderItem}
                keyExtractor={(item) => `id${item.id}`}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                drawDistance={DRAW_DISTANCE}
                maintainVisibleContentPosition
                recycleItems={true}
                ListHeaderComponent={<View style={{ height: top }} />}
                ListFooterComponent={<View style={{ height: bottom }} />}
                onStartReached={(props) => {
                    const time = performance.now();
                    console.log("onStartReached", props, last - time);
                    last = time;
                    onRefresh();
                }}
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
    },
    scrollContainer: {},
    listContainer: {
        width: 360,
        maxWidth: "100%",
        marginHorizontal: "auto",
    },
});
