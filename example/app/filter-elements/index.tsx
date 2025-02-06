import { renderItem } from "@/app/cards-renderItem";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "@/constants/constants";
import { LegendList, type LegendListRef } from "@legendapp/list";
import { useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { CardsDataProvider, useCardData } from "./filter-data-provider";

interface CardsProps {
    numColumns?: number;
}

function FilteredCards({ numColumns = 1 }: CardsProps) {
    const listRef = useRef<LegendListRef>(null);
    const { data } = useCardData();
    const navigation = useNavigation();
    const [mvcp, setMvcp] = useState(false);
    const [key, setKey] = useState(0);

    useEffect(() => {
        navigation.setOptions({
            title: "Filter",
            headerRight: () => (
                <Button
                    title={`${mvcp ? "✓" : ""}MVCP`}
                    onPress={() => {
                        setMvcp((prev) => !prev);
                        setKey((prev) => prev + 1);
                    }}
                    color={mvcp ? "#00e" : "black"}
                />
            ),
        });
    }, [mvcp]);

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]} key="legendlist">
            <FilterInput />
            <View style={{ flexGrow: 1 }}>
                <LegendList
                    key={key} // LegendList react weird on the changing of maintainVisibleContentPosition on the fly, make sure to remount the list
                    ref={listRef}
                    style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                    contentContainerStyle={styles.listContainer}
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={(item) => `id${item.id}`}
                    estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                    drawDistance={DRAW_DISTANCE}
                    maintainVisibleContentPosition={mvcp}
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
