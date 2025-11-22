import { useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list";
import { renderItem } from "~/app/cards-renderItem";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";
import { CardsDataProvider, useCardData } from "~/hooks/filter-data-provider";

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
            headerRight: () => (
                <Button
                    color={mvcp ? "#00e" : "black"}
                    onPress={() => {
                        setMvcp((prev) => !prev);
                        setKey((prev) => prev + 1);
                    }}
                    title={`${mvcp ? "✓" : ""}MVCP`}
                />
            ),
            title: "Filter",
        });
    }, [mvcp]);

    return (
        <View key="legendlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <FilterInput />
            <View style={{ flexGrow: 1 }}>
                <LegendList
                    contentContainerStyle={styles.listContainer} // LegendList react weird on the changing of maintainVisibleContentPosition on the fly, make sure to remount the list
                    data={data}
                    drawDistance={DRAW_DISTANCE}
                    estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                    key={key}
                    keyExtractor={(item) => `id${item.id}`}
                    ListEmptyComponent={
                        <View style={styles.listEmpty}>
                            <Text style={{ color: "white" }}>Empty</Text>
                        </View>
                    }
                    ListFooterComponent={<View />}
                    ListFooterComponentStyle={styles.listHeader}
                    maintainVisibleContentPosition={mvcp}
                    numColumns={numColumns}
                    recycleItems={true}
                    ref={listRef}
                    renderItem={renderItem}
                    style={[StyleSheet.absoluteFill, styles.scrollContainer]}
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
            keyboardType="numeric"
            onChangeText={setFilter}
            placeholder="Filter"
            style={{ backgroundColor: "white", height: 40, margin: 8, padding: 8 }}
            value={filter}
        />
    );
};

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
        marginHorizontal: 8,
        marginVertical: 8,
        width: "100%",
    },
    outerContainer: {
        backgroundColor: "#456",
    },
    scrollContainer: {},
});
