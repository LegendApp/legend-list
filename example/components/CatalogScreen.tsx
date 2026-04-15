import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { CatalogGroup } from "~/lib/catalogTypes";

export function CatalogScreen({
    groups,
    subtitle,
    title,
}: {
    groups: CatalogGroup[];
    subtitle?: string;
    title?: string;
}) {
    const router = useRouter();
    const showHero = Boolean(title || subtitle);

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.content}>
                {showHero ? (
                    <View style={styles.hero}>
                        {title ? <Text style={styles.title}>{title}</Text> : null}
                        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                    </View>
                ) : null}
                {groups.map((group, index) => (
                    <View key={group.key} style={index === 0 && !showHero ? styles.groupFirst : styles.group}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        {group.entries.map((entry) => (
                            <Pressable
                                key={entry.href}
                                onPress={() => router.push(entry.href as never)}
                                style={styles.card}
                            >
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{entry.title}</Text>
                                    <Text style={styles.cardDescription}>{entry.description}</Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderColor: "#D7DCE5",
        borderRadius: 18,
        borderWidth: 1,
        gap: 10,
        marginTop: 12,
        padding: 16,
    },
    cardDescription: {
        color: "#475569",
        fontSize: 14,
        lineHeight: 20,
    },
    cardHeader: {
        gap: 6,
    },
    cardTitle: {
        color: "#0F172A",
        fontSize: 16,
        fontWeight: "700",
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    group: {
        marginTop: 24,
    },
    groupFirst: {
        marginTop: 0,
    },
    groupTitle: {
        color: "#334155",
        fontSize: 14,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    hero: {
        backgroundColor: "#0F172A",
        borderRadius: 24,
        gap: 8,
        padding: 20,
    },
    safeArea: {
        backgroundColor: "#EEF2FF",
        flex: 1,
    },
    subtitle: {
        color: "#CBD5E1",
        fontSize: 14,
        lineHeight: 20,
    },
    title: {
        color: "#FFFFFF",
        fontSize: 28,
        fontWeight: "800",
    },
});
