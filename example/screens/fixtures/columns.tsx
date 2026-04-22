import { useEffect, useState } from "react";
import { LogBox, Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";

LogBox.ignoreLogs(["Open debugger"]);

const initialData = Array.from({ length: 8 }, (_, index) => ({ id: index.toString() }));
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 6;

export default function Columns() {
    const [data, setData] = useState(initialData);
    const [numColumns, setNumColumns] = useState(3);

    useEffect(() => {
        const timer = setTimeout(() => {
            setData(Array.from({ length: 20 }, (_, index) => ({ id: index.toString() })));
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.controls}>
                <Pressable
                    disabled={numColumns <= MIN_COLUMNS}
                    onPress={() => setNumColumns((value) => Math.max(MIN_COLUMNS, value - 1))}
                    style={[styles.button, numColumns <= MIN_COLUMNS && styles.buttonDisabled]}
                >
                    <Text style={styles.buttonText}>-</Text>
                </Pressable>
                <Text style={styles.label}>{numColumns} columns</Text>
                <Pressable
                    disabled={numColumns >= MAX_COLUMNS}
                    onPress={() => setNumColumns((value) => Math.min(MAX_COLUMNS, value + 1))}
                    style={[styles.button, numColumns >= MAX_COLUMNS && styles.buttonDisabled]}
                >
                    <Text style={styles.buttonText}>+</Text>
                </Pressable>
            </View>
            <LegendList
                columnWrapperStyle={{
                    columnGap: 16,
                    rowGap: 16,
                }}
                data={data}
                keyExtractor={(item) => item.id}
                recycleItems
                numColumns={numColumns}
                renderItem={Item}
            />
        </View>
    );
}

function Item({ item }: { item: { id: string } }) {
    return (
        <View style={styles.redRectangle}>
            <View style={styles.redRectangleInner} />
            <Text>Item {item.id}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        alignItems: "center",
        backgroundColor: "#111827",
        borderRadius: 10,
        height: 36,
        justifyContent: "center",
        width: 36,
    },
    buttonDisabled: {
        opacity: 0.4,
    },
    buttonText: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
        lineHeight: 22,
    },
    columnWrapper: {
        justifyContent: "space-between",
    },
    container: {
        backgroundColor: "#fff",
        flex: 1,
        paddingTop: 16,
    },
    controls: {
        alignItems: "center",
        alignSelf: "center",
        backgroundColor: "#f3f4f6",
        borderRadius: 14,
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    label: {
        color: "#111827",
        fontSize: 14,
        fontWeight: "700",
        minWidth: 88,
        textAlign: "center",
    },
    listEmpty: {
        alignItems: "center",
        backgroundColor: "#6789AB",
        flex: 1,
        height: 100,
        justifyContent: "center",
        paddingVertical: 16,
    },
    listHeader: {
        alignSelf: "center",
        backgroundColor: "#456AAA",
        borderRadius: 12,
        height: 100,
        marginHorizontal: 8,
        marginVertical: 8,
        width: 100,
    },
    redRectangle: {
        aspectRatio: 1,
    },
    redRectangleInner: {
        backgroundColor: "red",
        borderRadius: 8,
        height: "100%",
        width: "100%",
    },
});
