import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list/react-native";
import { CURATED_EXAMPLES, CURATED_GROUP_ORDER } from "@examples/catalog";
import { getAppMode } from "~/lib/appMode";

const FIXTURE_GROUPS = [
    {
        title: "Scrolling",
        items: [
            ["accurate-scrollto", "Accurate scrollTo"],
            ["accurate-scrollto-huge", "Accurate scrollTo huge"],
            ["add-to-end", "Add to the end"],
            ["bidirectional-infinite-list", "Bidirectional infinite list"],
            ["initial-scroll-index", "Initial scroll index"],
            ["initial-scroll-index-free-height", "Initial scroll index free height"],
            ["initial-scroll-index-keyed", "Initial scroll index keyed"],
            ["initial-scroll-start-at-the-end", "Initial scroll start at the end"],
            ["lazy-list", "Lazy list"],
            ["mvcp-test", "MVCP test"],
        ],
    },
    {
        title: "Chat",
        items: [
            ["chat-example", "Chat example"],
            ["chat-infinite", "Chat infinite"],
            ["chat-keyboard", "Chat keyboard"],
            ["chat-keyboard-big", "Chat keyboard big"],
            ["chat-resize-outer", "Chat resize outer"],
            ["ai-chat", "AI chat"],
            ["ai-chat-keyboard", "AI chat keyboard"],
        ],
    },
    {
        title: "Layouts",
        items: [
            ["always-render", "Always render"],
            ["columns", "Columns"],
            ["extra-data", "Extra data"],
            ["filter-elements", "Filter elements"],
            ["layout-animation", "Layout animation"],
            ["mutable-cells", "Mutable cells"],
        ],
    },
    {
        title: "Comparison",
        items: [
            ["cards-columns", "Cards columns"],
            ["cards-flatlist", "Cards FlatList"],
            ["cards-flashlist", "Cards FlashList"],
            ["cards-no-recycle", "Cards no recycle"],
            ["countries-flashlist", "Countries FlashList"],
            ["movies-flashlist", "Movies FlashList"],
        ],
    },
    {
        title: "Data",
        items: [
            ["countries", "Countries"],
            ["countries-reorder", "Countries reorder"],
            ["countries-with-headers", "Countries with headers"],
            ["countries-with-headers-fixed", "Countries with headers fixed"],
            ["countries-with-headers-sticky", "Countries with headers sticky"],
            ["product-shelf", "Product shelf"],
            ["video-feed", "Video feed"],
        ],
    },
];

export function ExamplesHome() {
    const grouped = CURATED_GROUP_ORDER.map((group) => ({
        group,
        items: CURATED_EXAMPLES.filter((example) => example.group === group),
    }));

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.hero}>
                <Text style={styles.kicker}>Legend List</Text>
                <Text style={styles.title}>Examples</Text>
                <Text style={styles.subtitle}>Messaging, Directory, Commerce, Media</Text>
            </View>
            <LegendList
                data={grouped}
                estimatedItemSize={220}
                keyExtractor={(item) => item.group}
                renderItem={({ item }) => (
                    <View style={styles.groupBlock}>
                        <Text style={styles.groupTitle}>{item.group}</Text>
                        {item.items.map((example) => (
                            <Link asChild href={`/${example.slug}` as any} key={example.slug}>
                                <Pressable style={styles.card}>
                                    <Text style={styles.cardTitle}>{example.title}</Text>
                                    <Text style={styles.cardTags}>{example.tags.join(" · ")}</Text>
                                </Pressable>
                            </Link>
                        ))}
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

export function FixturesHome() {
    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.hero}>
                <Text style={styles.kicker}>Legend List</Text>
                <Text style={styles.title}>Fixtures</Text>
                <Text style={styles.subtitle}>Debug and regression screens</Text>
            </View>
            <LegendList
                data={FIXTURE_GROUPS}
                estimatedItemSize={260}
                keyExtractor={(item) => item.title}
                renderItem={({ item }) => (
                    <View style={styles.groupBlock}>
                        <Text style={styles.groupTitle}>{item.title}</Text>
                        {item.items.map(([slug, title]) => (
                            <Link asChild href={`/${slug}` as any} key={slug}>
                                <Pressable style={styles.card}>
                                    <Text style={styles.cardTitle}>{title}</Text>
                                    <Text style={styles.cardTags}>{slug}</Text>
                                </Pressable>
                            </Link>
                        ))}
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

export function ModeHome() {
    return getAppMode() === "fixtures" ? <FixturesHome /> : <ExamplesHome />;
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#fff",
        borderRadius: 18,
        marginBottom: 12,
        padding: 14,
    },
    cardTags: {
        color: "#64748b",
        marginTop: 4,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: "800",
    },
    groupBlock: {
        marginBottom: 18,
    },
    groupTitle: {
        fontSize: 13,
        fontWeight: "900",
        letterSpacing: 1,
        marginBottom: 10,
        textTransform: "uppercase",
    },
    hero: {
        marginBottom: 16,
    },
    kicker: {
        color: "#64748b",
        fontSize: 12,
        letterSpacing: 1.2,
        textTransform: "uppercase",
    },
    root: {
        backgroundColor: "#f6f3ee",
        flex: 1,
        padding: 16,
    },
    subtitle: {
        color: "#475569",
        marginTop: 4,
    },
    title: {
        fontSize: 34,
        fontWeight: "900",
        marginTop: 2,
    },
});
