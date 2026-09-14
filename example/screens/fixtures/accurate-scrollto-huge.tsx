import { useRef, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { TextInput } from "react-native-gesture-handler";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";
import { type Item, ItemCard } from "~/screens/fixtures/shared/cardsRenderItem";

interface CardsProps {
    numColumns?: number;
}

export default function AccurateScrollToHuge({ numColumns = 1 }: CardsProps) {
    const listRef = useRef<LegendListRef>(null);
    const didUnmountList = useRef(false);
    const [isListMounted, setIsListMounted] = useState(true);
    const [status, setStatus] = useState("Ready");

    const [data, _setData] = useState<Item[]>(() =>
        Array.from({ length: 1000 }, (_, i) => ({
            id: i.toString(),
        })),
    );

    const buttonText = useRef<string>("");

    const runRapidSequence = () => {
        const list = listRef.current;
        if (list) {
            setStatus("Rapid sequence pending");
            void Promise.all([
                list.scrollToIndex({ animated: true, index: 900 }),
                list.scrollToIndex({ animated: true, index: 0 }),
                list.scrollToEnd({ animated: true }),
            ]).then(() => setStatus("Rapid sequence resolved"));
        }
    };

    const scrollThenUnmount = () => {
        const scrollPromise = listRef.current?.scrollToIndex({ animated: true, index: 999 });
        if (scrollPromise) {
            setStatus("Unmount pending");
            requestAnimationFrame(() => {
                didUnmountList.current = true;
                setIsListMounted(false);
            });
            void scrollPromise.then(() => {
                setStatus(didUnmountList.current ? "Resolved after unmount" : "Resolved before unmount");
            });
        }
    };

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
                            setStatus(`Index ${index} pending`);
                            void listRef.current
                                ?.scrollToIndex({ animated: true, index })
                                .then(() => setStatus(`Index ${index} resolved`));
                        }
                    }}
                    title="Scroll to item"
                />
                <Button
                    onPress={() => {
                        console.log("scrolling to end");
                        setStatus("End pending");
                        void listRef.current?.scrollToEnd({ animated: true }).then(() => setStatus("End resolved"));
                    }}
                    title="Scroll to end"
                />
            </View>
            <View style={styles.lifecycleControls}>
                <Button onPress={runRapidSequence} title="Rapid 900, 0, end" />
                {isListMounted ? (
                    <Button onPress={scrollThenUnmount} title="Scroll then unmount" />
                ) : (
                    <Button
                        onPress={() => {
                            didUnmountList.current = false;
                            setIsListMounted(true);
                            setStatus("Ready");
                        }}
                        title="Mount list"
                    />
                )}
                <Text>{status}</Text>
            </View>
            {isListMounted && (
                <LegendList
                    contentContainerStyle={styles.contentContainer}
                    data={data}
                    drawDistance={DRAW_DISTANCE}
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
                    renderItem={({ item, index }) => (
                        <ItemCard
                            data={data}
                            extraData={undefined}
                            index={index}
                            item={item}
                            numSentences={(indexForData) => ((indexForData * 7919) % 40) + 40}
                            type={undefined}
                        />
                    )}
                    style={styles.list}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#f5f5f5",
        flex: 1,
    },
    contentContainer: {
        marginHorizontal: "auto",
        maxWidth: "100%",
        width: 400,
    },
    lifecycleControls: {
        alignItems: "center",
        backgroundColor: "#fff",
        flexDirection: "row",
        gap: 8,
        justifyContent: "space-between",
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    list: {
        flex: 1,
    },
    listEmpty: {
        alignItems: "center",
        backgroundColor: "#6789AB",
        flex: 1,
        justifyContent: "center",
        paddingVertical: 16,
    },
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
