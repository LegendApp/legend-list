import { LegendList } from "@legendapp/list";
import { useCallback, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

// Dummy data: 50 items
const DATA = Array.from({ length: 70 }, (_, i) => ({ label: `Item ${i}`, height: ((i * 7919) % 100) + 10 }));

export default function App() {
    const [scrollToIdx, setScrollToIdx] = useState(0);

    console.log("keyed");

    const renderItem = useCallback(
        ({ item }) => (
            <View style={[styles.item, { height: item.height }]}>
                <Text>{item.label}</Text>
            </View>
        ),
        [],
    );

    return (
        <View style={styles.container}>
            <View style={styles.buttons}>
                <Button title="Scroll to 10" onPress={() => setScrollToIdx(10)} />
                <Button title="Scroll to 20" onPress={() => setScrollToIdx(20)} />
                <Button title="Scroll to 30" onPress={() => setScrollToIdx(30)} />
                <Button title="Scroll to 40" onPress={() => setScrollToIdx(40)} />
            </View>

            <View key={scrollToIdx} style={styles.list}>
                <LegendList
                    data={DATA}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.label}
                    estimatedItemSize={60}
                    style={styles.list}
                    initialScrollIndex={scrollToIdx}
                    maintainVisibleContentPosition
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    buttons: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginBottom: 10,
    },
    list: { flex: 1 },
    item: {
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fafafa",
        marginVertical: 4,
        marginHorizontal: 16,
        borderRadius: 8,
    },
});
