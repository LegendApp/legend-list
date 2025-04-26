import { LegendList } from "@legendapp/list";
import { useState } from "react";
import { useEffect } from "react";
import { Dimensions, LogBox, StyleSheet, Text, View } from "react-native";

LogBox.ignoreLogs(["Open debugger"]);

const WINDOW_HEIGHT = Dimensions.get("window").height;
const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5", "#9B59B6", "#3498DB"];

const initialData = Array.from({ length: 8 }, (_, index) => ({
    id: index.toString(),
    color: colors[index % colors.length],
}));

export default function VideoFeed() {
    const [data, setData] = useState(initialData);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        setTimeout(() => {
            setData(
                Array.from({ length: 20 }, (_, index) => ({
                    id: index.toString(),
                    color: colors[index % colors.length],
                })),
            );
        }, 1000);
    }, []);

    return (
        <View style={styles.container} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
            {!!height && (
                <LegendList
                    data={data}
                    renderItem={Item}
                    keyExtractor={(item) => item.id}
                    snapToInterval={height}
                    decelerationRate="fast"
                    snapToAlignment="start"
                    showsVerticalScrollIndicator={false}
                    estimatedItemSize={height}
                    drawDistance={1}
                    extraData={height}
                />
            )}
        </View>
    );
}

function Item({ item, extraData }: { item: { id: string; color: string }; extraData: number }) {
    return (
        <View style={[styles.rectangle, { height: extraData }]}>
            <View style={[styles.rectangleInner, { backgroundColor: item.color }]} />
            <Text style={styles.itemText}>Item {item.id}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    rectangle: {
        height: WINDOW_HEIGHT,
        width: "100%",
        position: "relative",
    },
    rectangleInner: {
        height: "100%",
        width: "100%",
    },
    itemText: {
        position: "absolute",
        bottom: 20,
        left: 20,
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
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
