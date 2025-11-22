import { useState } from "react";
import { StatusBar, StyleSheet, Text, TouchableOpacity } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list";

type ItemData = {
    id: string;
    title: string;
};

const DATA: ItemData[] = [
    {
        id: "bd7acbea-c1b1-46c2-aed5-3ad53abb28ba",
        title: "First Item",
    },
    {
        id: "3ac68afc-c605-48d3-a4f8-fbd91aa97f63",
        title: "Second Item",
    },
    {
        id: "58694a0f-3da1-471f-bd96-145571e29d72",
        title: "Third Item",
    },
];

type ItemProps = {
    item: ItemData;
    onPress: () => void;
    backgroundColor: string;
    textColor: string;
};

const Item = ({ item, onPress, backgroundColor, textColor }: ItemProps) => (
    <TouchableOpacity onPress={onPress} style={[styles.item, { backgroundColor }]}>
        <Text style={[styles.title, { color: textColor }]}>{item.title}</Text>
    </TouchableOpacity>
);

const App = () => {
    const [selectedId, setSelectedId] = useState<string>();

    const renderItem = ({ item }: { item: ItemData }) => {
        const backgroundColor = item.id === selectedId ? "#6e3b6e" : "#f9c2ff";
        const color = item.id === selectedId ? "white" : "black";

        return (
            <Item
                backgroundColor={backgroundColor}
                item={item}
                onPress={() => setSelectedId(item.id)}
                textColor={color}
            />
        );
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                <LegendList
                    data={DATA}
                    estimatedItemSize={100}
                    extraData={selectedId}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                />
            </SafeAreaView>
        </SafeAreaProvider>
    );
};

export default App;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: StatusBar.currentHeight || 0,
    },
    item: {
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 20,
    },
    title: {
        fontSize: 32,
    },
});
