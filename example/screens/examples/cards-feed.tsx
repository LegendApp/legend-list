import { Stack } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegendList } from "@legendapp/list/react-native";
import { buildFeedCards } from "../../../examples-shared/commerce";

const avatar = "https://i.pravatar.cc/120?img=12";

export default function CardsFeedScreen() {
    const data = buildFeedCards();

    return (
        <>
            <Stack.Screen options={{ headerTitle: "Cards Feed", headerTransparent: false }} />
            <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
                <LegendList
                    contentContainerStyle={styles.listContent}
                    data={data}
                    estimatedItemSize={260}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <View style={styles.authorRow}>
                                <Image source={{ uri: avatar }} style={styles.avatar} />
                                <View style={styles.authorText}>
                                    <Text style={styles.author}>{item.author}</Text>
                                    <Text style={styles.subtitle}>{item.title}</Text>
                                </View>
                            </View>
                            <Text style={styles.body}>{item.body}</Text>
                            <View style={styles.footer}>
                                <Text style={styles.footerLabel}>{item.reactionCount} reactions</Text>
                                <Text style={styles.footerLabel}>Open thread</Text>
                            </View>
                        </View>
                    )}
                />
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    author: {
        color: "#111827",
        fontSize: 16,
        fontWeight: "700",
    },
    authorRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
    },
    authorText: {
        flex: 1,
    },
    avatar: {
        borderRadius: 20,
        height: 40,
        width: 40,
    },
    body: {
        color: "#1F2937",
        fontSize: 15,
        lineHeight: 22,
        marginTop: 18,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        marginBottom: 16,
        padding: 18,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 20,
    },
    footerLabel: {
        color: "#6B7280",
        fontSize: 13,
        fontWeight: "600",
    },
    listContent: {
        padding: 20,
    },
    safeArea: {
        backgroundColor: "#EEF1F7",
        flex: 1,
    },
    subtitle: {
        color: "#6B7280",
        marginTop: 2,
    },
});
