import { memo, useRef } from "react";
import { StyleSheet, View } from "react-native";

import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { FlashList, type FlashListRef, type ListRenderItemInfo, useRecyclingState } from "@shopify/flash-list";
import { DRAW_DISTANCE } from "~/constants/constants";
import type { DemoMetricStore } from "~/lib/demoMetrics";
import { type Item, ItemCardContent, type ItemCardProps } from "~/screens/fixtures/shared/cardsRenderItem";

interface CardsFlashListProps {
    fixedItemSize?: number;
    metrics?: DemoMetricStore;
}

const FlashRecyclingItemCard = memo(function FlashRecyclingItemCardComponent(props: ItemCardProps) {
    const [isExpanded, setIsExpanded] = useRecyclingState(false, [props.item.id]);
    return <ItemCardContent {...props} isExpanded={isExpanded} setIsExpanded={setIsExpanded} />;
});

export default function CardsFlashList({ fixedItemSize, metrics }: CardsFlashListProps) {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i.toString() }));

    const scrollRef = useRef<FlashListRef<Item>>(null);

    const renderItemFn = (info: ListRenderItemInfo<Item>) => {
        const legendListProps = {
            data,
            extraData: { metrics },
            index: info.index,
            item: info.item,
            type: undefined,
        } satisfies LegendListRenderItemProps<Item>;

        return (
            <FlashRecyclingItemCard
                {...legendListProps}
                fixedHeight={fixedItemSize}
                metrics={metrics}
                numSentences={fixedItemSize === undefined ? undefined : 1}
            />
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
