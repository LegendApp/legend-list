import renderItem from "@/app/cards-renderItem";
import { DO_SCROLL_TEST, DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH, RECYCLE_ITEMS } from "@/constants/constants";
import { useScrollTest } from "@/constants/useScrollTest";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Fragment, useRef } from "react";
import { StyleSheet, View } from "react-native";

export default function HomeScreen() {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i.toString() }));

    const scrollRef = useRef<FlashList<any>>(null);

    //   useEffect(() => {
    //     let amtPerInterval = 4;
    //     let index = amtPerInterval;
    //     const interval = setInterval(() => {
    //       scrollRef.current?.scrollToIndex({
    //         index,
    //       });
    //       index += amtPerInterval;
    //     }, 100);

    //     return () => clearInterval(interval);
    //   });

    const renderItemFn = (info: ListRenderItemInfo<any>) => {
        return RECYCLE_ITEMS ? renderItem(info) : <Fragment key={info.item.id}>{renderItem(info)}</Fragment>;
    };

    if (DO_SCROLL_TEST) {
        useScrollTest((offset) => {
            scrollRef.current?.scrollToOffset({
                offset,
                animated: true,
            });
        });
    }

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]} key="flashlist">
            <FlashList
                data={data}
                renderItem={renderItemFn}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                drawDistance={DRAW_DISTANCE}
                ref={scrollRef}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
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
        marginTop: 8,
    },
    outerContainer: {
        backgroundColor: "#456",
    },
    scrollContainer: {
        // paddingHorizontal: 8,
    },
    titleContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
    reactLogo: {
        height: 178,
        width: 290,
        bottom: 0,
        left: 0,
        position: "absolute",
    },
    itemContainer: {
        // padding: 4,
        // borderBottomWidth: 1,
        // borderBottomColor: "#ccc",
    },
    listContainer: {
        //paddingHorizontal: 16,
        //paddingTop: 48,
    },
    itemTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 8,
        color: "#1a1a1a",
    },
    itemBody: {
        fontSize: 14,
        color: "#666666",
        lineHeight: 20,
        flex: 1,
    },
    itemFooter: {
        flexDirection: "row",
        justifyContent: "flex-start",
        gap: 16,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
    },
    footerText: {
        fontSize: 14,
        color: "#888888",
    },
});
