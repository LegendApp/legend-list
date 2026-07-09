import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { InfiniteLegendList } from "@legendapp/list/infinite";
import { useRecyclingState } from "@legendapp/list/react-native";

type CarouselItem = {
    id: string;
    title: string;
    emoji: string;
    color: string;
    likes: number;
};

const ITEMS: CarouselItem[] = [
    { color: "#F94144", emoji: "🌋", id: "volcano", likes: 0, title: "Volcano" },
    { color: "#F3722C", emoji: "🏜️", id: "desert", likes: 0, title: "Desert" },
    { color: "#F8961E", emoji: "🏞️", id: "canyon", likes: 0, title: "Canyon" },
    { color: "#90BE6D", emoji: "🌴", id: "jungle", likes: 0, title: "Jungle" },
    { color: "#43AA8B", emoji: "🏝️", id: "island", likes: 0, title: "Island" },
    { color: "#277DA1", emoji: "❄️", id: "glacier", likes: 0, title: "Glacier" },
];

const CAROUSEL_HEIGHT = 420;

const CounterRow = ({
    label,
    sublabel,
    value,
    onPress,
    tone,
}: {
    label: string;
    sublabel: string;
    value: number;
    onPress: () => void;
    tone: "good" | "warn" | "bad";
}) => (
    <Pressable onPress={onPress} style={[styles.counterRow, styles[`counterRow_${tone}`]]}>
        <View style={styles.counterText}>
            <Text style={styles.counterLabel}>{label}</Text>
            <Text style={styles.counterSublabel}>{sublabel}</Text>
        </View>
        <Text style={styles.counterValue}>{value}</Text>
    </Pressable>
);

const Card = ({
    item,
    index,
    infiniteIndex,
    itemWidth,
    onLike,
}: {
    item: CarouselItem;
    index: number;
    infiniteIndex: number;
    itemWidth: number;
    onLike: (id: string) => void;
}) => {
    const likeCount = item.likes;
    const [copyCount, setCopyCount] = useRecyclingState(() => 0);
    const [containerCount, setContainerCount] = useState(0);

    return (
        <View style={[styles.card, { backgroundColor: item.color, width: itemWidth - 16 }]}>
            <Text style={styles.cardEmoji}>{item.emoji}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardIndex}>
                item {index} · copy {Math.floor(infiniteIndex / ITEMS.length)}
            </Text>
            <View style={styles.counters}>
                <CounterRow
                    label="❤️ Likes"
                    onPress={() => onLike(item.id)}
                    sublabel="stored in the data item — persists everywhere"
                    tone="good"
                    value={likeCount}
                />
                <CounterRow
                    label="useRecyclingState"
                    onPress={() => setCopyCount((prev: number) => prev + 1)}
                    sublabel="per container key — resets on other copies"
                    tone="warn"
                    value={copyCount}
                />
                <CounterRow
                    label="useState"
                    onPress={() => setContainerCount((prev) => prev + 1)}
                    sublabel="per container — bleeds across items!"
                    tone="bad"
                    value={containerCount}
                />
            </View>
        </View>
    );
};

export default function InfiniteCarouselStateFixtureScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const itemWidth = Math.round(windowWidth * 0.8);
    const sidePadding = (windowWidth - itemWidth) / 2;

    const [items, setItems] = useState(ITEMS);
    const handleLike = useCallback((id: string) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, likes: item.likes + 1 } : item)));
    }, []);

    return (
        <View style={styles.container}>
            <View style={{ height: CAROUSEL_HEIGHT }}>
                <InfiniteLegendList
                    contentContainerStyle={{ paddingHorizontal: sidePadding }}
                    data={items}
                    decelerationRate="fast"
                    getFixedItemSize={() => itemWidth}
                    horizontal
                    keyExtractor={(item) => item.id}
                    recycleItems
                    renderItem={({ item, index, infiniteIndex }) => (
                        <Card
                            index={index}
                            infiniteIndex={infiniteIndex}
                            item={item}
                            itemWidth={itemWidth}
                            onLike={handleLike}
                        />
                    )}
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={itemWidth}
                    style={{ height: CAROUSEL_HEIGHT }}
                />
            </View>
            <View style={styles.explainer}>
                <Text style={styles.explainerTitle}>Local state in an infinite (recycled) carousel</Text>
                <Text style={styles.explainerText}>
                    Tap the counters on a card, then swipe a full loop back to it (or just keep swiping one direction).
                    The card header shows which virtual copy you are looking at.
                </Text>
                <Text style={styles.explainerText}>
                    ❤️ Likes persist — they live in the data item itself, updated immutably at the screen level (the
                    mutable-cells pattern). Every copy renders the same item object.{"\n"}
                    ⚠️ useRecyclingState is scoped to one virtual copy — it resets when you reach the item via another
                    copy.{"\n"}❌ useState sticks to the recycled container and shows up on unrelated items.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        alignItems: "center",
        borderRadius: 20,
        height: CAROUSEL_HEIGHT - 40,
        marginHorizontal: 8,
        marginTop: 16,
        paddingHorizontal: 14,
        paddingTop: 18,
    },
    cardEmoji: {
        fontSize: 44,
    },
    cardIndex: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 13,
        fontWeight: "600",
        marginTop: 2,
    },
    cardTitle: {
        color: "#FFFFFF",
        fontSize: 20,
        fontWeight: "700",
        marginTop: 6,
    },
    container: {
        backgroundColor: "#F8F5F2",
        flex: 1,
        paddingTop: 12,
    },
    counterLabel: {
        color: "#1f1f1f",
        fontSize: 14,
        fontWeight: "700",
    },
    counterRow: {
        alignItems: "center",
        borderRadius: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    counterRow_bad: {
        backgroundColor: "rgba(255,255,255,0.72)",
        borderColor: "#B3261E",
        borderWidth: 1,
    },
    counterRow_good: {
        backgroundColor: "rgba(255,255,255,0.92)",
    },
    counterRow_warn: {
        backgroundColor: "rgba(255,255,255,0.82)",
    },
    counterSublabel: {
        color: "#5B5650",
        fontSize: 11,
        marginTop: 1,
    },
    counters: {
        alignSelf: "stretch",
        gap: 8,
        marginTop: 14,
    },
    counterText: {
        flex: 1,
        paddingRight: 8,
    },
    counterValue: {
        color: "#1f1f1f",
        fontSize: 22,
        fontWeight: "800",
        minWidth: 34,
        textAlign: "right",
    },
    explainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    explainerText: {
        color: "#5B5650",
        fontSize: 13,
        lineHeight: 19,
        marginTop: 8,
    },
    explainerTitle: {
        color: "#1f1f1f",
        fontSize: 16,
        fontWeight: "700",
    },
});
