import { useCallback, useState } from "react";
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";

import { AnimatedLegendList } from "@legendapp/list/reanimated";
import type { LegendListRenderItemProps } from "@/types";
import { countries, getEmojiFlag, type TCountryCode } from "countries-list";

type Country = {
    id: string;
    name: string;
    flag: string;
};

const DATA: Country[] = Object.entries(countries)
    .map(([code, country]) => ({
        flag: getEmojiFlag(code as TCountryCode),
        id: code,
        name: country.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

type ItemProps = {
    item: Country;
    onPress: () => void;
    isSelected: boolean;
};

const Item = ({ item, onPress, isSelected }: ItemProps) => (
    <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.item, isSelected && styles.selectedItem, pressed && styles.pressedItem]}
    >
        <View style={styles.flagContainer}>
            <Text style={styles.flag}>{item.flag}</Text>
        </View>
        <View style={styles.contentContainer}>
            <Text style={[styles.title, isSelected && styles.selectedText]}>
                {item.name}
                <Text style={styles.countryCode}> ({item.id})</Text>
            </Text>
        </View>
    </Pressable>
);

const App = () => {
    const [selectedId, setSelectedId] = useState<string>();

    const scrollY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            console.log("onScroll", event);

            scrollY.value = event.contentOffset.y;
        },
    });

    const tapGesture = Gesture.Tap().onStart(({ absoluteY }) => {
        "worklet";
        const adjustedY = absoluteY + scrollY.value;
        console.log("📍 Tap at scroll-adjusted Y:", adjustedY);
    });

    const keyExtractor = useCallback((item: Country) => item.id, []);

    const renderItem = useCallback(
        ({ item }: LegendListRenderItemProps<Country>) => {
            const isSelected = item.id === selectedId;

            return <Item isSelected={isSelected} item={item} onPress={() => setSelectedId(item.id)} />;
        },
        [selectedId],
    );

    return (
        <SafeAreaView style={styles.container}>
            <GestureDetector gesture={tapGesture}>
                <AnimatedLegendList
                    data={DATA}
                    estimatedItemSize={70}
                    extraData={selectedId}
                    keyExtractor={keyExtractor}
                    onScroll={onScroll}
                    recycleItems
                    renderItem={renderItem}
                    scrollEventThrottle={16}
                />
            </GestureDetector>
        </SafeAreaView>
    );
};

export default App;

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#f5f5f5",
        flex: 1,
        marginTop: StatusBar.currentHeight || 0,
    },
    contentContainer: {
        flex: 1,
        justifyContent: "center",
    },
    countryCode: {
        color: "#666",
        fontSize: 14,
        fontWeight: "400",
    },
    flag: {
        fontSize: 28,
    },
    flagContainer: {
        alignItems: "center",
        backgroundColor: "#f8f9fa",
        borderRadius: 20,
        height: 40,
        justifyContent: "center",
        marginRight: 16,
        width: 40,
    },
    item: {
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    pressedItem: {},
    selectedItem: {},
    selectedText: {
        color: "#1976d2",
        fontWeight: "600",
    },
    title: {
        color: "#333",
        fontSize: 16,
        fontWeight: "500",
    },
});
