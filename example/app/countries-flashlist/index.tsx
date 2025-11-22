import { useMemo, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { FlashList } from "@shopify/flash-list";
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
    const [searchQuery, setSearchQuery] = useState("");

    const filteredData = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return DATA.filter(
            (country) => country.name.toLowerCase().includes(query) || country.id.toLowerCase().includes(query),
        );
    }, [searchQuery]);

    const renderItem = ({ item }: { item: Country }) => {
        const isSelected = item.id === selectedId;
        return <Item isSelected={isSelected} item={item} onPress={() => setSelectedId(item.id)} />;
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                <View style={styles.searchContainer}>
                    <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        clearButtonMode="while-editing"
                        onChangeText={setSearchQuery}
                        placeholder="Search country or code..."
                        style={styles.searchInput}
                        value={searchQuery}
                    />
                </View>
                <FlashList
                    data={filteredData}
                    disableAutoLayout
                    estimatedItemSize={70}
                    extraData={selectedId}
                    keyExtractor={(item) => item.id}
                    //scrollEventThrottle={200}
                    renderItem={renderItem}
                />
            </SafeAreaView>
        </SafeAreaProvider>
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
        // elevation: 3,
    },
    pressedItem: {
        // backgroundColor: "#f0f0f0",
    },
    searchContainer: {
        backgroundColor: "#fff",
        borderBottomColor: "#e0e0e0",
        borderBottomWidth: 1,
        padding: 8,
    },
    searchInput: {
        backgroundColor: "#f5f5f5",
        borderRadius: 8,
        fontSize: 16,
        height: 40,
        paddingHorizontal: 12,
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
