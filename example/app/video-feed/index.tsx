import { useEffect, useState } from "react";
import { Dimensions, LogBox, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list";

LogBox.ignoreLogs(["Open debugger"]);

const WINDOW_HEIGHT = Dimensions.get("window").height;
const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5", "#9B59B6", "#3498DB"];

const initialData = Array.from({ length: 8 }, (_, index) => ({
    color: colors[index % colors.length],
    id: index.toString(),
}));

export default function VideoFeed() {
    const [data, setData] = useState(initialData);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        setTimeout(() => {
            setData(
                Array.from({ length: 10 }, (_, index) => ({
                    color: colors[index % colors.length],
                    id: index.toString(),
                })),
            );
        }, 1000);
    }, []);

    return (
        <View onLayout={(e) => setHeight(e.nativeEvent.layout.height)} style={styles.container}>
            {!!height && (
                <LegendList
                    data={data}
                    decelerationRate="fast"
                    drawDistance={1}
                    estimatedItemSize={height}
                    extraData={height}
                    keyExtractor={(item) => item.id}
                    onEndReached={() => {
                        setData([
                            ...data,
                            ...Array.from({ length: 10 }, (_, index) => ({
                                color: colors[index % colors.length],
                                id: (data.length + index).toString(),
                            })),
                        ]);
                    }}
                    pagingEnabled
                    renderItem={Item}
                    showsVerticalScrollIndicator={false}
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
    columnWrapper: {
        justifyContent: "space-between",
    },
    container: {
        backgroundColor: "#fff",
        flex: 1,
    },
    itemText: {
        bottom: 20,
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
        left: 20,
        position: "absolute",
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
    rectangle: {
        height: WINDOW_HEIGHT,
        position: "relative",
        width: "100%",
    },
    rectangleInner: {
        height: "100%",
        width: "100%",
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
