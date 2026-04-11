import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { CatalogGroup } from "~/lib/catalogTypes";

export function CatalogScreen({ groups, subtitle, title }: { groups: CatalogGroup[]; subtitle: string; title: string }) {
    const router = useRouter();

    return (
        <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.hero}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
                {groups.map((group) => (
                    <View key={group.key} style={styles.group}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        {group.entries.map((entry) => (
                            <Pressable key={entry.href} onPress={() => router.push(entry.href as never)} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{entry.title}</Text>
                                </View>
                                <View style={styles.tagRow}>
                                    {entry.tags.map((tag) => (
                                        <View key={tag} style={styles.tag}>
                                            <Text style={styles.tagLabel}>{tag}</Text>
                                        </View>
                                    ))}
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
    tag: {
        backgroundColor: "#E2E8F0",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    tagLabel: {
        color: "#334155",
        fontSize: 12,
        fontWeight: "600",
    },
    tagRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    title: {
        color: "#FFFFFF",
        fontSize: 28,
        fontWeight: "800",
    },
});
