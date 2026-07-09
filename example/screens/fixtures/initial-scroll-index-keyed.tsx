import { useCallback, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";

// Dummy data: 50 items
const DATA = Array.from({ length: 70 }, (_, i) => ({ height: ((i * 7919) % 100) + 10, label: `Item ${i}` }));
type DataItem = (typeof DATA)[number];

export default function App() {
    const [scrollToIdx, setScrollToIdx] = useState(0);

    console.log("keyed");

    const renderItem = useCallback(
        ({ item }: { item: DataItem }) => (
            <View style={[styles.item, { height: item.height }]}>
                <Text>{item.label}</Text>
            </View>
        ),
        [],
    );

    return (
        <View style={styles.container}>
            <View style={styles.buttons}>
                <Button onPress={() => setScrollToIdx(10)} title="Goto 10" />
                <Button onPress={() => setScrollToIdx(20)} title="Goto 20" />
                <Button onPress={() => setScrollToIdx(30)} title="Goto 30" />
                <Button onPress={() => setScrollToIdx(69)} title="Goto 69" />
            </View>

            <View key={scrollToIdx} style={styles.list}>
                <LegendList
                    data={DATA}
                    estimatedItemSize={60}
                    initialScrollIndex={scrollToIdx}
                    keyExtractor={(item) => item.label}
                    maintainVisibleContentPosition
                    recycleItems
                    renderItem={renderItem}
                    style={styles.list}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    buttons: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginBottom: 10,
    },
    container: { flex: 1 },
    item: {
        alignItems: "center",
        backgroundColor: "#fafafa",
        borderRadius: 8,
        justifyContent: "center",
        marginHorizontal: 16,
        marginVertical: 4,
    },
    list: { flex: 1 },
});
