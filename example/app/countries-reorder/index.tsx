import { useMemo, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list";
import { countries, getEmojiFlag, type TCountryCode } from "countries-list";

export const unstable_settings = {
    initialRouteName: "index",
};

export const createTitle = () => "Countries";

type Country = {
    id: string;
    name: string;
    flag: string;
};

// Convert countries object to array and add an id
const DATA: Country[] = Object.entries(countries)
    // .slice(0, 5)
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
    const [randomSeed, setRandomSeed] = useState(0);

    // Display either ordered or randomized data based on state
    const displayData = useMemo(() => {
        if (randomSeed) {
            // Randomize the order
            return [...DATA].sort(() => Math.random() - 0.5);
        }
        // Return alphabetically sorted data
        return [...DATA].sort((a, b) => a.name.localeCompare(b.name));
    }, [randomSeed]);

    const renderItem = ({ item }: { item: Country }) => {
        const isSelected = item.id === selectedId;
        return <Item isSelected={isSelected} item={item} onPress={() => setSelectedId(item.id)} />;
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                <View style={styles.headerContainer}>
                    <Pressable onPress={() => setRandomSeed(randomSeed + 1)} style={styles.reorderButton}>
                        <Text style={styles.buttonText}>Randomize Order</Text>
                    </Pressable>
                </View>
                <LegendList
                    data={displayData}
                    estimatedItemSize={70}
                    extraData={selectedId}
                    ItemSeparatorComponent={Separator}
                    keyExtractor={(item) => item.id}
                    onEndReached={({ distanceFromEnd }) => {
                        console.log("onEndReached", distanceFromEnd);
                    }}
                    onEndReachedThreshold={0.1}
                    onStartReached={({ distanceFromStart }) => {
                        console.log("onStartReached", distanceFromStart);
                    }}
                    onStartReachedThreshold={0.1}
                    recycleItems
                    // ListHeaderComponent={<View style={{ height: 200, backgroundColor: "red" }} />}
                    // ListFooterComponent={<View style={{ height: 200, backgroundColor: "blue" }} />}
                    renderItem={renderItem}
                />
            </SafeAreaView>
        </SafeAreaProvider>
    );
};

const Separator = () => <View style={{ backgroundColor: "green", height: 5 }} />;

export default App;

const styles = StyleSheet.create({
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "500",
    },
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
    headerContainer: {
        alignItems: "center",
        backgroundColor: "#fff",
        borderBottomColor: "#e0e0e0",
        borderBottomWidth: 1,
        padding: 8,
    },
    item: {
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 6,
        //     shadowColor: "#000",
        //     shadowOffset: {
        //         width: 0,
        //         height: 2,
        //     },
        //     shadowOpacity: 0.1,
        //     shadowRadius: 3,
        //     elevation: 3,
    },
    pressedItem: {
        // backgroundColor: "#f0f0f0",
    },
    reorderButton: {
        alignItems: "center",
        backgroundColor: "#4a86e8",
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        width: "80%",
    },
    selectedItem: {
        // backgroundColor: "#e3f2fd",
        // borderColor: "#1976d2",
        // borderWidth: 1,
    },
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
