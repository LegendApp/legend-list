import { AnimatedLegendList } from "@legendapp/list";
import { type TCountryCode, countries, getEmojiFlag } from "countries-list";
import { memo, useCallback, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, {
    CurvedTransition,
    EntryExitTransition,
    FadeIn,
    FadeOut,
    FadingTransition,
    JumpingTransition,
    LayoutAnimationConfig,
    LinearTransition,
    SequencedTransition,
} from "react-native-reanimated";

type Country = {
    id: string;
    name: string;
    flag: string;
};

const ORIGINAL_DATA: Country[] = Object.entries(countries)
    .map(([code, country]) => ({
        id: code,
        name: country.name,
        flag: getEmojiFlag(code as TCountryCode),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30);

const LAYOUT_TRANSITIONS = [
    LinearTransition,
    FadingTransition,
    SequencedTransition,
    JumpingTransition,
    CurvedTransition,
    EntryExitTransition,
];

const CountryItem = memo(({ item, onPress }: { item: Country; onPress: (id: string) => void }) => (
    <TouchableOpacity onPress={() => onPress(item.id)} style={styles.listItem}>
        <View style={styles.flagContainer}>
            <Text style={styles.flag}>{item.flag}</Text>
        </View>
        <View style={styles.contentContainer}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.subtitle}>({item.id}) - Tap to remove</Text>
        </View>
    </TouchableOpacity>
));

const App = () => {
    const [countriesData, setCountriesData] = useState<Country[]>(ORIGINAL_DATA);

    const [search, setSearch] = useState("");

    const [currentTransitionIndex, setCurrentTransitionIndex] = useState(0);

    const [layoutTransitionEnabled, setLayoutTransitionEnabled] = useState(true);

    const layout = layoutTransitionEnabled ? LAYOUT_TRANSITIONS[currentTransitionIndex] : undefined;

    const removeItem = (id: string) => {
        setCountriesData((prev) => prev.filter((c) => c.id !== id));
    };

    const addItem = () => {
        const unused = ORIGINAL_DATA.find((c) => !countriesData.some((d) => d.id === c.id));
        if (unused) {
            setCountriesData((prev) => [unused, ...prev]);
        }
    };

    const reorderItems = () => {
        setCountriesData((prev) => [...prev].sort(() => Math.random() - 0.5));
    };

    const resetItems = () => {
        setCountriesData(ORIGINAL_DATA);
        setSearch("");
    };

    const renderItem = useCallback(
        ({ item }: { item: Country }) => <CountryItem item={item} onPress={removeItem} />,
        [removeItem],
    );

    const keyExtractor = useCallback((item: Country) => item.id, []);

    const filteredData = countriesData.filter(
        (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <LayoutAnimationConfig skipEntering>
            <SafeAreaView style={styles.container}>
                <View style={styles.controls}>
                    <TextInput
                        placeholder="Search country..."
                        value={search}
                        onChangeText={setSearch}
                        style={styles.input}
                    />

                    <TouchableOpacity onPress={() => setLayoutTransitionEnabled((v) => !v)}>
                        <Text style={styles.buttonText}>Layout: {layoutTransitionEnabled ? "On" : "Off"}</Text>
                    </TouchableOpacity>

                    {layout && (
                        <Animated.View style={styles.row} entering={FadeIn} exiting={FadeOut}>
                            <Text style={styles.transitionText}>Current: {layout?.presetName ?? "Unknown"}</Text>
                            <TouchableOpacity
                                onPress={() =>
                                    setCurrentTransitionIndex((prev) => (prev + 1) % LAYOUT_TRANSITIONS.length)
                                }
                            >
                                <Text style={styles.buttonText}>Change</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                </View>

                <AnimatedLegendList
                    data={filteredData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    estimatedItemSize={70}
                    // @ts-ignore
                    itemLayoutAnimation={layout}
                    // @ts-ignore
                    layout={layout}
                    entering={FadeIn}
                    exiting={FadeOut}
                    contentContainerStyle={styles.listContainer}
                />

                <Animated.View style={styles.controls} layout={layout}>
                    <TouchableOpacity onPress={addItem}>
                        <Text style={styles.buttonText}>Add Country</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={reorderItems}>
                        <Text style={styles.buttonText}>Reorder</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={resetItems}>
                        <Text style={styles.buttonText}>Reset</Text>
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>
        </LayoutAnimationConfig>
    );
};

export default App;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    controls: {
        padding: 12,
        alignItems: "center",
        gap: 12,
    },
    row: {
        flexDirection: "row",
        gap: 16,
        alignItems: "center",
    },
    input: {
        width: "90%",
        height: 40,
        backgroundColor: "#f0f0f0",
        borderRadius: 8,
        paddingHorizontal: 10,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#7a42f4",
    },
    transitionText: {
        fontSize: 16,
        color: "#333",
    },
    listContainer: {
        padding: 12,
        gap: 8,
    },
    listItem: {
        padding: 16,
        backgroundColor: "#e3d7fb",
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
    },
    flagContainer: {
        marginRight: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
    },
    flag: {
        fontSize: 26,
    },
    contentContainer: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: "500",
        color: "#222",
    },
    subtitle: {
        fontSize: 13,
        color: "#666",
    },
});
