import { useRef, useState } from "react";
import { Button, Platform, StatusBar, StyleSheet, Text, View } from "react-native";
import { TextInput } from "react-native-gesture-handler";

import { LegendList, type LegendListRef } from "@legendapp/list";
import { type Item, renderItem } from "~/app/cards-renderItem";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";

interface CardsProps {
    numColumns?: number;
}

export default function AccurateScrollToHuge({ numColumns = 1 }: CardsProps) {
    const listRef = useRef<LegendListRef>(null);

    const [data, _setData] = useState<Item[]>(
        () =>
            Array.from({ length: 1000 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    const buttonText = useRef<string>("");

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    onChangeText={(text) => {
                        buttonText.current = text;
                    }}
                    placeholder="Select item to scroll to"
                    style={styles.searchInput}
                />
                <Button
                    onPress={() => {
                        const index = Number(buttonText.current) || 0;
                        console.log("scrolling to index", index);
                        if (index !== -1) {
                            listRef.current?.scrollToIndex({ animated: true, index });
                        }
                    }}
                    title="Scroll to item"
                />
                <Button
                    onPress={() => {
                        console.log("scrolling to end");
                        listRef.current?.scrollToEnd({ animated: true });
                    }}
                    title="Scroll to end"
                />
            </View>
            <LegendList
                contentContainerStyle={styles.listContainer}
                data={data}
                drawDistance={DRAW_DISTANCE}
                // @ts-ignore
                estimatedItemSize={ESTIMATED_ITEM_LENGTH + 120}
                keyExtractor={(item) => `id${item.id}`}
                ListEmptyComponent={
                    <View style={styles.listEmpty}>
                        <Text style={{ color: "white" }}>Empty</Text>
                    </View>
                }
                maintainVisibleContentPosition
                numColumns={numColumns}
                recycleItems={true}
                ref={listRef}
                renderItem={({ item, index }) =>
                    // @ts-ignore
                    renderItem({ index, item, numSentences: (indexForData) => ((indexForData * 7919) % 40) + 40 })
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#f5f5f5",
        flex: 1,
        marginTop: StatusBar.currentHeight || 0,
    },
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
    scrollContainer: {},
    searchContainer: {
        backgroundColor: "#fff",
        borderBottomColor: "#e0e0e0",
        borderBottomWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 8,
    },
    searchInput: {
        backgroundColor: "#f5f5f5",
        borderRadius: 8,
        flexGrow: 1,
        fontSize: 16,
        height: 40,
        paddingHorizontal: 12,
    },
});
