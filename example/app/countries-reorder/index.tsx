import { LegendList } from "@legendapp/list";
import { type TCountryCode, countries, getEmojiFlag } from "countries-list";
import { useMemo, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

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
    .slice(0, 5)
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
        return <Item item={item} onPress={() => setSelectedId(item.id)} isSelected={isSelected} />;
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                <View style={styles.headerContainer}>
                    <Pressable style={styles.reorderButton} onPress={() => setRandomSeed(randomSeed + 1)}>
                        <Text style={styles.buttonText}>Randomize Order</Text>
                    </Pressable>
                </View>
                <LegendList
                    data={displayData}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    extraData={selectedId}
                    estimatedItemSize={70}
                    recycleItems
                    onStartReachedThreshold={0.1}
                    onStartReached={({ distanceFromStart }) => {
                        console.log("onStartReached", distanceFromStart);
                    }}
                    onEndReachedThreshold={0.1}
                    onEndReached={({ distanceFromEnd }) => {
                        console.log("onEndReached", distanceFromEnd);
                    }}
                    // ListHeaderComponent={<View style={{ height: 200, backgroundColor: "red" }} />}
                    // ListFooterComponent={<View style={{ height: 200, backgroundColor: "blue" }} />}
                    ItemSeparatorComponent={Separator}
                />
            </SafeAreaView>
        </SafeAreaProvider>
    );
};

const Separator = () => <View style={{ height: 5, backgroundColor: "green" }} />;

export default App;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: StatusBar.currentHeight || 0,
        backgroundColor: "#f5f5f5",
    },
    headerContainer: {
        padding: 8,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
        alignItems: "center",
    },
    reorderButton: {
        backgroundColor: "#4a86e8",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        width: "80%",
        alignItems: "center",
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "500",
    },
    item: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        //     shadowColor: "#000",
        //     shadowOffset: {
        //         width: 0,
        //         height: 2,
        //     },
        //     shadowOpacity: 0.1,
        //     shadowRadius: 3,
        //     elevation: 3,
    },
    selectedItem: {
        // backgroundColor: "#e3f2fd",
        // borderColor: "#1976d2",
        // borderWidth: 1,
    },
    pressedItem: {
        // backgroundColor: "#f0f0f0",
    },
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
