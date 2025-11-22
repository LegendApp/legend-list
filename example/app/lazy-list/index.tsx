import { useRef, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list";
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

export default function LazyList() {
    const listRef = useRef<LegendListRef>(null);
    const [selectedId, setSelectedId] = useState<string>();

    return (
        <View style={styles.container}>
            <LegendList maintainVisibleContentPosition recycleItems ref={listRef}>
                <View style={styles.heading}>
                    <Text style={styles.headingText}>Countries lazy scrollview</Text>
                </View>
                {DATA.map((country) => (
                    <Pressable
                        key={country.id}
                        onPress={() => setSelectedId(country.id)}
                        style={({ pressed }) => [
                            styles.item,
                            selectedId === country.id && styles.selectedItem,
                            pressed && styles.pressedItem,
                        ]}
                    >
                        <View style={styles.flagContainer}>
                            <Text style={styles.flag}>{country.flag}</Text>
                        </View>
                        <View style={styles.contentContainer}>
                            <Text style={[styles.title, selectedId === country.id && styles.selectedText]}>
                                {country.name}
                                <Text style={styles.countryCode}> ({country.id})</Text>
                            </Text>
                        </View>
                    </Pressable>
                ))}
            </LegendList>
        </View>
    );
}

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
    heading: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    headingText: {
        fontWeight: "bold",
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
