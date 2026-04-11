import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegendList } from "@legendapp/list/react-native";
import { buildMediaRails, type MediaPoster, type MediaRail } from "@examples/media";

function PosterCard({ item }: { item: MediaPoster }) {
    return (
        <View style={[styles.poster, { backgroundColor: item.color }]}>
            <Text style={styles.posterTitle}>{item.title}</Text>
            <Text style={styles.posterSubtitle}>{item.subtitle}</Text>
        </View>
    );
}

export default function MediaRailsScreen() {
    const rails = buildMediaRails();

    return (
        <>
            <Stack.Screen options={{ headerTitle: "Media Rails", headerTransparent: false }} />
            <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
                <LegendList<MediaRail>
                    contentContainerStyle={styles.listContent}
                    data={rails}
                    estimatedItemSize={220}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.rail}>
                            <Text style={styles.railTitle}>{item.title}</Text>
                            <LegendList<MediaPoster>
                                data={item.posters}
                                estimatedItemSize={156}
                                horizontal
                                keyExtractor={(poster) => poster.id}
                                renderItem={({ item: poster }) => <PosterCard item={poster} />}
                            />
                        </View>
                    )}
                />
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingVertical: 16,
    },
    poster: {
        borderRadius: 18,
        height: 180,
        justifyContent: "space-between",
        marginLeft: 16,
        padding: 14,
        width: 138,
    },
    posterSubtitle: {
        color: "#F9FAFB",
        fontSize: 12,
        fontWeight: "600",
    },
    posterTitle: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "800",
    },
    rail: {
        marginBottom: 20,
    },
    railTitle: {
        color: "#F9FAFB",
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 14,
        marginLeft: 16,
    },
    safeArea: {
        backgroundColor: "#09090B",
        flex: 1,
    },
});
