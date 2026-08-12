import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { CatalogEntry, CatalogGroup } from "~/lib/catalogTypes";

function CatalogCard({ entry, onNavigate }: { entry: CatalogEntry; onNavigate: (href: string) => void }) {
    const cardHeader = (
        <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{entry.title}</Text>
            <Text style={styles.cardDescription}>{entry.description}</Text>
        </View>
    );

    return entry.actions ? (
        <View style={styles.card}>
            {cardHeader}
            <View style={styles.cardActions}>
                {entry.actions.map((action) => (
                    <Pressable
                        accessibilityLabel={`Open ${entry.title} with ${action.label}`}
                        accessibilityRole="button"
                        key={action.href}
                        onPress={() => onNavigate(action.href)}
                        style={styles.cardAction}
                    >
                        <Text style={styles.cardActionText}>{action.label}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    ) : (
        <Pressable onPress={() => onNavigate(entry.href)} style={styles.card}>
            {cardHeader}
        </Pressable>
    );
}

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
                            <CatalogCard
                                entry={entry}
                                key={entry.id}
                                onNavigate={(href) => router.push(href as never)}
                            />
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
    cardAction: {
        alignItems: "center",
        backgroundColor: "#EEF2FF",
        borderColor: "#C7D2FE",
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        minHeight: 40,
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    cardActions: {
        flexDirection: "row",
        gap: 8,
    },
    cardActionText: {
        color: "#3730A3",
        fontSize: 13,
        fontWeight: "700",
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
