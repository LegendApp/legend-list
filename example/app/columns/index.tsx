import { LegendList } from "@legendapp/list";
import { useState } from "react";
import { useEffect } from "react";
import { LogBox, StyleSheet, Text, View } from "react-native";

LogBox.ignoreLogs(["Open debugger"]);

const initialData = Array.from({ length: 8 }, (_, index) => ({ id: index.toString() }));

export default function Columns() {
    const [data, setData] = useState(initialData);

    useEffect(() => {
        setTimeout(() => {
            setData(Array.from({ length: 20 }, (_, index) => ({ id: index.toString() })));
        }, 1000);
    });

    return (
        <View style={styles.container}>
            <LegendList
                data={data}
                renderItem={Item}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={{
                    columnGap: 16,
                    rowGap: 16,
                }}
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
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    redRectangle: {
        aspectRatio: 1,
    },
    redRectangleInner: {
        height: "100%",
        width: "100%",
        backgroundColor: "red",
        borderRadius: 8,
    },
    columnWrapper: {
        justifyContent: "space-between",
    },
    listHeader: {
        alignSelf: "center",
        height: 100,
        width: 100,
        backgroundColor: "#456AAA",
        borderRadius: 12,
        marginHorizontal: 8,
        marginVertical: 8,
    },
    listEmpty: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#6789AB",
        paddingVertical: 16,
        height: 100,
    },
});
