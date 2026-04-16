import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list/react-native";
import { buildMediaRails, type MediaPoster, type MediaRail } from "../../../examples-shared/media";

function PosterCard({ item }: { item: MediaPoster }) {
    return (
        <View style={styles.poster}>
            <View style={[styles.posterFallback, { backgroundColor: item.color }]} />
            <Image source={{ uri: item.imageUrl }} style={styles.posterImage} />
            <LinearGradient
                colors={["rgba(9, 9, 11, 0)", "rgba(9, 9, 11, 0.04)", "rgba(9, 9, 11, 0.88)"]}
                locations={[0, 0.62, 1]}
                style={styles.posterOverlay}
            />
            <View style={styles.posterText}>
                <Text numberOfLines={1} style={styles.posterSubtitle}>
                    {item.subtitle}
                </Text>
                <Text numberOfLines={2} style={styles.posterTitle}>
                    {item.title}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingVertical: 16,
    },
    poster: {
        borderRadius: 18,
        height: 180,
        marginLeft: 16,
        overflow: "hidden",
        width: 138,
    },
    posterFallback: {
        ...StyleSheet.absoluteFillObject,
    },
    posterImage: {
        ...StyleSheet.absoluteFillObject,
    },
    posterOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    posterSubtitle: {
        color: "#F9FAFB",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.2,
        lineHeight: 12,
        marginBottom: 6,
        textTransform: "uppercase",
    },
    posterText: {
        flex: 1,
        justifyContent: "flex-end",
        padding: 12,
    },
    posterTitle: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "800",
        lineHeight: 18,
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

export function MediaRailsExample() {
    const rails = buildMediaRails();

    return (
        <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
            <LegendList<MediaRail>
                contentContainerStyle={styles.listContent}
                data={rails}
                estimatedItemSize={220}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
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
    );
}
