import { useEffect, useState } from "react";
import { Dimensions, LogBox, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";

LogBox.ignoreLogs(["Open debugger"]);

const WINDOW_HEIGHT = Dimensions.get("window").height;
const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5", "#9B59B6", "#3498DB"];

const initialData = Array.from({ length: 8 }, (_, index) => ({
    color: colors[index % colors.length],
    id: index.toString(),
}));

function Item({ item, extraData }: { item: { id: string; color: string }; extraData: number }) {
    return (
        <View style={[styles.rectangle, { height: extraData }]}>
            <View style={[styles.rectangleInner, { backgroundColor: item.color }]} />
            <Text style={styles.itemText}>Item {item.id}</Text>
        </View>
    );
}

export default function VideoFeedFixtureScreen() {
    const [data, setData] = useState(initialData);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setData(
                Array.from({ length: 10 }, (_, index) => ({
                    color: colors[index % colors.length],
                    id: index.toString(),
                })),
            );
        }, 1000);

        return () => clearTimeout(timer);
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
                    recycleItems
                    onEndReached={() => {
                        setData((current) => [
                            ...current,
                            ...Array.from({ length: 10 }, (_, index) => ({
                                color: colors[index % colors.length],
                                id: (current.length + index).toString(),
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

const styles = StyleSheet.create({
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
    rectangle: {
        height: WINDOW_HEIGHT,
        position: "relative",
        width: "100%",
    },
    rectangleInner: {
        height: "100%",
        width: "100%",
    },
});
