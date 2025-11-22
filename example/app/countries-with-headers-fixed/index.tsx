import { useMemo, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list";
import { countries, getEmojiFlag, type TCountryCode } from "countries-list";

export const unstable_settings = {
    initialRouteName: "index",
};

export const createTitle = () => "Countries with Headers + Average Sizes";

type Country = {
    id: string;
    name: string;
    flag: string;
    type: "country";
    population?: number;
};

type Header = {
    id: string;
    letter: string;
    type: "header";
};

type BigCountry = {
    id: string;
    name: string;
    flag: string;
    type: "big-country";
    population: number;
    capital: string;
    continent: string;
};

type ListItem = Country | Header | BigCountry;

// Convert countries object to array and add an id
const COUNTRIES: (Country | BigCountry)[] = Object.entries(countries)
    .map(([code, country]) => {
        const baseCountry = {
            flag: getEmojiFlag(code as TCountryCode),
            id: code,
            name: country.name,
        };

        // Make some countries "big" with extra info (these will be taller)
        const bigCountryCodes = ["US", "CN", "IN", "BR", "RU", "JP", "DE", "GB", "FR", "IT", "CA", "AU"];
        if (bigCountryCodes.includes(code)) {
            return {
                ...baseCountry,
                capital: country.capital || "Unknown",
                continent: "Unknown", // In real scenario you'd have actual data
                population: Math.floor(Math.random() * 1000000000) + 10000000,
                type: "big-country" as const,
            };
        }

        return {
            ...baseCountry,
            type: "country" as const,
        };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

// Group countries by first letter and create data with headers
const createDataWithHeaders = (countriesData: (Country | BigCountry)[]): ListItem[] => {
    const grouped = countriesData.reduce(
        (acc, country) => {
            const letter = country.name[0].toUpperCase();
            if (!acc[letter]) {
                acc[letter] = [];
            }
            acc[letter].push(country);
            return acc;
        },
        {} as Record<string, (Country | BigCountry)[]>,
    );

    const result: ListItem[] = [];
    Object.keys(grouped)
        .sort()
        .forEach((letter) => {
            // Add header
            result.push({
                id: `header-${letter}`,
                letter,
                type: "header",
            });
            // Add countries for this letter
            result.push(...grouped[letter]);
        });

    return result;
};

const DATA_WITH_HEADERS = createDataWithHeaders(COUNTRIES);

type CountryItemProps = {
    item: Country;
    onPress: () => void;
    isSelected: boolean;
};

type BigCountryItemProps = {
    item: BigCountry;
    onPress: () => void;
    isSelected: boolean;
};

const CountryItem = ({ item, onPress, isSelected }: CountryItemProps) => (
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

const BigCountryItem = ({ item, onPress, isSelected }: BigCountryItemProps) => (
    <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.bigItem, isSelected && styles.selectedItem, pressed && styles.pressedItem]}
    >
        <View style={styles.flagContainer}>
            <Text style={styles.flag}>{item.flag}</Text>
        </View>
        <View style={styles.contentContainer}>
            <Text style={[styles.title, isSelected && styles.selectedText]}>
                {item.name}
                <Text style={styles.countryCode}> ({item.id})</Text>
            </Text>
            <Text style={styles.subtitle}>
                Capital: {item.capital} • Pop: {item.population.toLocaleString()}
            </Text>
        </View>
    </Pressable>
);

const HeaderItem = ({ item }: { item: Header }) => (
    <View style={styles.header}>
        <Text style={styles.headerText}>{item.letter}</Text>
    </View>
);

const App = () => {
    const [selectedId, setSelectedId] = useState<string>();
    const [searchQuery, setSearchQuery] = useState("");

    const filteredData = useMemo(() => {
        if (!searchQuery) {
            return DATA_WITH_HEADERS;
        }

        const query = searchQuery.toLowerCase();
        const filteredCountries = COUNTRIES.filter(
            (country) => country.name.toLowerCase().includes(query) || country.id.toLowerCase().includes(query),
        );

        return createDataWithHeaders(filteredCountries);
    }, [searchQuery]);

    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === "header") {
            return <HeaderItem item={item} />;
        }

        const isSelected = item.id === selectedId;
        const onPress = () => setSelectedId(item.id);

        if (item.type === "big-country") {
            return <BigCountryItem isSelected={isSelected} item={item} onPress={onPress} />;
        }

        return <CountryItem isSelected={isSelected} item={item} onPress={onPress} />;
    };

    const getItemType = (item: ListItem) => {
        return item.type;
    };

    const keyExtractor = (item: ListItem) => item.id;

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
                <LegendList
                    data={filteredData}
                    extraData={selectedId}
                    getFixedItemSize={(index, item, type) => {
                        if (type === "header") {
                            return 84;
                        }
                        if (type === "big-country") {
                            return 68;
                        }
                        return 60;
                    }}
                    getItemType={getItemType}
                    keyExtractor={keyExtractor}
                    onEndReached={({ distanceFromEnd }) => {
                        console.log("onEndReached", distanceFromEnd);
                    }}
                    onEndReachedThreshold={0.1}
                    onItemSizeChanged={({ size, index, itemKey, itemData }) => {
                        console.log("onItemSizeChanged", size, index, itemKey, itemData);
                    }}
                    onStartReached={({ distanceFromStart }) => {
                        console.log("onStartReached", distanceFromStart);
                    }}
                    onStartReachedThreshold={0.1}
                    recycleItems
                    renderItem={renderItem}
                />
            </SafeAreaView>
        </SafeAreaProvider>
    );
};

export default App;

const styles = StyleSheet.create({
    bigItem: {
        alignItems: "center",
        backgroundColor: "#fff3e0",
        borderLeftColor: "#ff9800",
        borderLeftWidth: 4,
        borderRadius: 12,
        elevation: 2,
        flexDirection: "row",
        marginHorizontal: 8,
        marginVertical: 2,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: "#000",
        shadowOffset: {
            height: 1,
            width: 0,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
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
    header: {
        backgroundColor: "#e3f2fd",
        borderBottomColor: "#1976d2",
        borderBottomWidth: 2,
        paddingBottom: 12,
        paddingHorizontal: 16,
        paddingTop: 48,
    },
    headerText: {
        color: "#1976d2",
        fontSize: 18,
        fontWeight: "700",
        letterSpacing: 1,
    },
    item: {
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        elevation: 2,
        flexDirection: "row",
        marginHorizontal: 8,
        marginVertical: 2,
        paddingHorizontal: 16,
        paddingVertical: 8,
        shadowColor: "#000",
        shadowOffset: {
            height: 1,
            width: 0,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    pressedItem: {
        backgroundColor: "#f0f0f0",
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
        backgroundColor: "#e3f2fd",
        borderColor: "#1976d2",
        borderWidth: 1,
    },
    selectedText: {
        color: "#1976d2",
        fontWeight: "600",
    },
    subtitle: {
        color: "#666",
        fontSize: 14,
        marginTop: 2,
    },
    title: {
        color: "#333",
        fontSize: 16,
        fontWeight: "500",
    },
});
