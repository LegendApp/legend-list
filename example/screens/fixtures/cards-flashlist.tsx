import { Fragment, useRef } from "react";
import { StyleSheet, View } from "react-native";

import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { FlashList, type FlashListRef, type ListRenderItemInfo } from "@shopify/flash-list";
import { DRAW_DISTANCE, RECYCLE_ITEMS } from "~/constants/constants";
import {
    type Item,
    renderItem as renderCardItem,
    renderFixedCardItem,
} from "~/screens/fixtures/shared/cardsRenderItem";

interface CardsFlashListProps {
    fixedItemSize?: number;
}

export default function CardsFlashList({ fixedItemSize }: CardsFlashListProps) {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i.toString() }));

    const scrollRef = useRef<FlashListRef<Item>>(null);
    const renderSharedCardItem = fixedItemSize !== undefined ? renderFixedCardItem : renderCardItem;

    const renderItemFn = (info: ListRenderItemInfo<Item>) => {
        const legendListProps = {
            data,
            extraData: undefined,
            index: info.index,
            item: info.item,
            type: undefined,
        } satisfies LegendListRenderItemProps<Item>;

        return RECYCLE_ITEMS ? (
            renderSharedCardItem(legendListProps)
        ) : (
            <Fragment key={info.item.id}>{renderSharedCardItem(legendListProps)}</Fragment>
        );
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
    },
});
