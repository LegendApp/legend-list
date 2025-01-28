import { renderItem } from "@/app/cards-renderItem";
import { DO_SCROLL_TEST, DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "@/constants/constants";
import { useScrollTest } from "@/constants/useScrollTest";
import { LegendList, type LegendListRef } from "@legendapp/list";
import { useRef } from "react";
import { LogBox, StyleSheet, Text, TextInput, View } from "react-native";
import { CardsDataProvider, useCardData } from "./filter-data-provider";

LogBox.ignoreLogs(["Open debugger"]);

interface CardsProps {
    numColumns?: number;
}

function FilteredCards({ numColumns = 1 }: CardsProps) {
    const listRef = useRef<LegendListRef>(null);
    const { data } = useCardData();

    if (DO_SCROLL_TEST) {
        useScrollTest((offset) => {
            listRef.current?.scrollToOffset({
                offset: offset,
                animated: true,
            });
        });
    }

    console.log("rendering cards", data.length);

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]} key="legendlist">
            <FilterInput />
            <View style={{flexGrow:1}} >
            <LegendList
                ref={listRef}
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                contentContainerStyle={styles.listContainer}
                data={data}
                renderItem={renderItem}
                keyExtractor={(item) => `id${item.id}`}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                drawDistance={DRAW_DISTANCE}
                //maintainVisibleContentPosition
                recycleItems={true}
                numColumns={numColumns}
                ListFooterComponent={<View />}
                ListFooterComponentStyle={styles.listHeader}
                ListEmptyComponentStyle={{ flex: 1 }}
                ListEmptyComponent={
                    <View style={styles.listEmpty}>
                        <Text style={{ color: "white" }}>Empty</Text>
                    </View>
                }
            />
            </View>
        </View>
    );
}

export default function CardsWrapper({ numColumns = 1 }: CardsProps) {
    return (
        <CardsDataProvider
            initialData={
                Array.from({ length: 1000 }, (_, i) => ({
                    id: i.toString(),
                })) as any[]
            }
        >
            <FilteredCards numColumns={numColumns} />
        </CardsDataProvider>
    );
}

const FilterInput = () => {
    const { filter, setFilter } = useCardData();
    return (
        <TextInput
            placeholder="Filter"
            style={{ backgroundColor: "white", padding: 8, margin: 8, height: 40 }}
            value={filter}
            onChangeText={setFilter}
            keyboardType="numeric"
        />
    );
};

const styles = StyleSheet.create({
    listHeader: {
        alignSelf: "center",
        width: "100%",
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
        width: 400,
        maxWidth: "100%",
        marginHorizontal: "auto",
    },
});
