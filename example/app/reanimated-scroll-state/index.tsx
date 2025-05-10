import { AnimatedLegendList } from "@legendapp/list/reanimated";
import { type TCountryCode, countries, getEmojiFlag } from "countries-list";
import { useCallback, useState } from "react";
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import type {} from "react-native-safe-area-context";

type Country = {
    id: string;
    name: string;
    flag: string;
};

const DATA: Country[] = Object.entries(countries)
    .map(([code, country]) => ({
        id: code,
        name: country.name,
        flag: getEmojiFlag(code as TCountryCode),
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
        ({ item }: { item: Country }) => {
            const isSelected = item.id === selectedId;
            return <Item item={item} onPress={() => setSelectedId(item.id)} isSelected={isSelected} />;
        },
        [selectedId],
    );

    return (
        <SafeAreaView style={styles.container}>
            <GestureDetector gesture={tapGesture}>
                <AnimatedLegendList
                    data={DATA}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    estimatedItemSize={70}
                    extraData={selectedId}
                    recycleItems
                />
            </GestureDetector>
        </SafeAreaView>
    );
};

export default App;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: StatusBar.currentHeight || 0,
        backgroundColor: "#f5f5f5",
    },
    item: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
    },
    selectedItem: {},
    pressedItem: {},
    flagContainer: {
        marginRight: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#f8f9fa",
        alignItems: "center",
        justifyContent: "center",
    },
    flag: {
        fontSize: 28,
    },
    contentContainer: {
        flex: 1,
        justifyContent: "center",
    },
    title: {
        fontSize: 16,
        color: "#333",
        fontWeight: "500",
    },
    selectedText: {
        color: "#1976d2",
        fontWeight: "600",
    },
    countryCode: {
        fontSize: 14,
        color: "#666",
        fontWeight: "400",
    },
});
