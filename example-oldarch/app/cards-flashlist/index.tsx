import { Fragment, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { FlashList, type FlashListRef, type ListRenderItemInfo } from "@shopify/flash-list";
import renderItem, { type Item } from "~/app/cards-renderItem";
import { DRAW_DISTANCE, RECYCLE_ITEMS } from "~/constants/constants";

export default function HomeScreen() {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i.toString() }));

    const scrollRef = useRef<FlashListRef<Item>>(null);

    const renderItemFn = (info: ListRenderItemInfo<any>) => {
        return RECYCLE_ITEMS ? renderItem(info) : <Fragment key={info.item.id}>{renderItem(info)}</Fragment>;
    };

    return (
        <View key="flashlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <FlashList
                contentContainerStyle={styles.listContainer}
                data={data}
                drawDistance={DRAW_DISTANCE}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
                ref={scrollRef}
                renderItem={renderItemFn}
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
