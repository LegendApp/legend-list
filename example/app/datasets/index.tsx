import { useCallback, useMemo, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { LegendListDatasets } from "@legendapp/list";
import type { DatasetEntry } from "@legendapp/list";
import { countries, getEmojiFlag, type TCountryCode } from "countries-list";

export const unstable_settings = {
    initialRouteName: "index",
};

type Country = {
    id: string;
    name: string;
    flag: string;
    continent: string;
};

// Convert countries object to array with continent info
const ALL_COUNTRIES: Country[] = Object.entries(countries)
    .map(([code, country]) => ({
        continent: country.continent,
        flag: getEmojiFlag(code as TCountryCode),
        id: code,
        name: country.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

// Split into datasets by continent
const CONTINENT_NAMES: Record<string, string> = {
    AF: "Africa",
    AN: "Antarctica",
    AS: "Asia",
    EU: "Europe",
    NA: "North America",
    OC: "Oceania",
    SA: "South America",
};

const TABS = ["All", "EU", "AS", "NA", "AF"] as const;
type Tab = (typeof TABS)[number];

const DATASETS: Record<Tab, Country[]> = {
    AF: ALL_COUNTRIES.filter((c) => c.continent === "AF"),
    AS: ALL_COUNTRIES.filter((c) => c.continent === "AS"),
    All: ALL_COUNTRIES,
    EU: ALL_COUNTRIES.filter((c) => c.continent === "EU"),
    NA: ALL_COUNTRIES.filter((c) => c.continent === "NA"),
};

const TAB_LABELS: Record<Tab, string> = {
    AF: "Africa",
    AS: "Asia",
    All: "All",
    EU: "Europe",
    NA: "N. America",
};

const TabBar = ({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) => (
    <View style={styles.tabBar}>
        {TABS.map((tab) => (
            <Pressable
                key={tab}
                onPress={() => onTabChange(tab)}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
            >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                    {TAB_LABELS[tab]}
                </Text>
                <Text style={[styles.tabCount, activeTab === tab && styles.activeTabCount]}>
                    {DATASETS[tab].length}
                </Text>
            </Pressable>
        ))}
    </View>
);

const CountryItem = ({ item }: { item: Country }) => (
    <View style={styles.item}>
        <View style={styles.flagContainer}>
            <Text style={styles.flag}>{item.flag}</Text>
        </View>
        <View style={styles.contentContainer}>
            <Text style={styles.title}>
                {item.name}
                <Text style={styles.countryCode}> ({item.id})</Text>
            </Text>
            <Text style={styles.continent}>{CONTINENT_NAMES[item.continent] ?? item.continent}</Text>
        </View>
    </View>
);

const App = () => {
    const [activeTab, setActiveTab] = useState<Tab>("All");

    const datasets: DatasetEntry<Country>[] = useMemo(
        () =>
            TABS.map((tab) => ({
                active: activeTab === tab,
                data: DATASETS[tab],
                key: tab,
            })),
        [activeTab],
    );

    const renderItem = useCallback(({ item }: { item: Country }) => <CountryItem item={item} />, []);

    const keyExtractor = useCallback((item: Country) => item.id, []);

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                <LegendListDatasets
                    datasets={datasets}
                    estimatedItemSize={60}
                    keyExtractor={keyExtractor}
                    ListHeaderComponent={
                        <View>
                            <View style={styles.header}>
                                <Text style={styles.heading}>Countries by Continent</Text>
                                <Text style={styles.subheading}>
                                    Datasets demo — {ALL_COUNTRIES.length} countries across {TABS.length} tabs
                                </Text>
                            </View>
                            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
                        </View>
                    }
                    recycleItems
                    renderItem={renderItem}
                />
            </SafeAreaView>
        </SafeAreaProvider>
    );
};

export default App;

const styles = StyleSheet.create({
    activeTab: {
        backgroundColor: "#1976d2",
        borderColor: "#1976d2",
    },
    activeTabCount: {
        color: "rgba(255, 255, 255, 0.8)",
    },
    activeTabText: {
        color: "#fff",
        fontWeight: "600",
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
    continent: {
        color: "#999",
        fontSize: 13,
        marginTop: 1,
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
        backgroundColor: "#fff",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
    },
    heading: {
        color: "#333",
        fontSize: 22,
        fontWeight: "700",
    },
    item: {
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        flexDirection: "row",
        marginHorizontal: 8,
        marginVertical: 2,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    subheading: {
        color: "#999",
        fontSize: 14,
        marginTop: 4,
    },
    tab: {
        alignItems: "center",
        borderColor: "#ddd",
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    tabBar: {
        backgroundColor: "#fff",
        borderBottomColor: "#e0e0e0",
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
    },
    tabCount: {
        color: "#999",
        fontSize: 11,
        marginTop: 2,
    },
    tabText: {
        color: "#666",
        fontSize: 14,
    },
    title: {
        color: "#333",
        fontSize: 16,
        fontWeight: "500",
    },
});
