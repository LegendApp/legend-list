import { useEffect, useState } from "react";
import { LogBox, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list";

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
                columnWrapperStyle={{
                    columnGap: 16,
                    rowGap: 16,
                }}
                data={data}
                keyExtractor={(item) => item.id}
                numColumns={3}
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
    columnWrapper: {
        justifyContent: "space-between",
    },
    container: {
        backgroundColor: "#fff",
        flex: 1,
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
