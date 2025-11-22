import { useState } from "react";
import { Button, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list";

const ListComponent = () => {
    const [items, setItems] = useState<{ id: string; title: string }[]>([]);
    const [counter, setCounter] = useState(0);

    const addSixtyItems = () => {
        const newItems = [];
        const startIndex = counter;

        for (let i = 0; i < 60; i++) {
            newItems.push({
                id: `item-${startIndex + i}`,

                title: `Item ${startIndex + i}`,
            });
        }

        setItems([...items, ...newItems]);
        setCounter((prev) => prev + 60);
    };

    const renderItem = ({ item }: { item: { id: string; title: string } }) => (
        <View style={styles.itemContainer}>
            <Text style={styles.itemText}>{item.title}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Button color="#4285F4" onPress={addSixtyItems} title="Add 60 Items" />

                <LegendList
                    contentContainerStyle={styles.listContent}
                    data={items}
                    keyExtractor={(item) => item.id}
                    maintainScrollAtEnd
                    renderItem={renderItem}
                    style={styles.list}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#f5f5f5",
        flex: 1,
        padding: 16,
    },
    itemContainer: {
        backgroundColor: "white",
        borderRadius: 8,
        elevation: 2,
        marginVertical: 8,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { height: 1, width: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    itemText: {
        fontSize: 16,
    },
    list: {
        flex: 1,
        marginTop: 16,
    },
    listContent: {
        paddingBottom: 16,
    },
    safeArea: {
        backgroundColor: "#f5f5f5",
        flex: 1,
    },
});

export default ListComponent;
