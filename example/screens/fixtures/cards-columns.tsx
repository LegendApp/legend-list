import { useState } from "react";
import { LogBox, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import Cards from "~/components/Cards";

LogBox.ignoreLogs(["Open debugger"]);

export default function CardsColumns() {
    const [numColumns, setNumColumns] = useState(2);

    return (
        <View style={styles.container}>
            <Cards numColumns={numColumns} />
            <View pointerEvents="box-none" style={styles.controlsOverlay}>
                <View style={styles.controls}>
                    <Pressable
                        disabled={numColumns <= 1}
                        onPress={() => setNumColumns((value) => Math.max(1, value - 1))}
                        style={[styles.button, numColumns <= 1 && styles.buttonDisabled]}
                    >
                        <Text style={styles.buttonText}>-</Text>
                    </Pressable>
                    <Text style={styles.label}>{numColumns} columns</Text>
                    <Pressable
                        disabled={numColumns >= 6}
                        onPress={() => setNumColumns((value) => Math.min(6, value + 1))}
                        style={[styles.button, numColumns >= 6 && styles.buttonDisabled]}
                    >
                        <Text style={styles.buttonText}>+</Text>
                    </Pressable>
                </View>
            </View>
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
    container: {
        flex: 1,
    },
    controls: {
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 14,
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    controlsOverlay: {
        alignItems: "center",
        left: 16,
        position: "absolute",
        right: 16,
        top: 16,
        zIndex: 1,
    },
    label: {
        color: "#111827",
        fontSize: 14,
        fontWeight: "700",
        minWidth: 88,
        textAlign: "center",
    },
    listContainer: {
        marginHorizontal: "auto",
        maxWidth: "100%",
        width: 400,
    },
    listEmpty: {
        alignItems: "center",
        backgroundColor: "#6789AB",
        flex: 1,
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
    outerContainer: {
        backgroundColor: "#456",
        bottom: Platform.OS === "ios" ? 82 : 0,
    },
    scrollContainer: {},
});
