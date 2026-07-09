import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { InfiniteLegendList } from "@legendapp/list/infinite";
import type { LegendListRef } from "@legendapp/list/react-native";
import { AnimatedLegendList } from "@legendapp/list/reanimated";

type CarouselItem = {
    id: string;
    title: string;
    emoji: string;
    color: string;
};

const ITEMS: CarouselItem[] = [
    { color: "#F94144", emoji: "🌋", id: "volcano", title: "Volcano" },
    { color: "#F3722C", emoji: "🏜️", id: "desert", title: "Desert" },
    { color: "#F8961E", emoji: "🏞️", id: "canyon", title: "Canyon" },
    { color: "#90BE6D", emoji: "🌴", id: "jungle", title: "Jungle" },
    { color: "#43AA8B", emoji: "🏝️", id: "island", title: "Island" },
    { color: "#4D908E", emoji: "🌊", id: "ocean", title: "Ocean" },
    { color: "#577590", emoji: "🏔️", id: "mountain", title: "Mountain" },
    { color: "#277DA1", emoji: "❄️", id: "glacier", title: "Glacier" },
];

const CAROUSEL_HEIGHT = 340;

let mountedCards = 0;
const mountListeners = new Set<() => void>();
const notifyMountListeners = () => {
    for (const listener of mountListeners) {
        listener();
    }
};
const subscribeMounted = (listener: () => void) => {
    mountListeners.add(listener);
    return () => mountListeners.delete(listener);
};
const useMountedCardsCount = () =>
    useSyncExternalStore(
        subscribeMounted,
        () => mountedCards,
        () => mountedCards,
    );

const Card = ({
    item,
    index,
    infiniteIndex,
    scrollOffset,
    itemWidth,
    period,
}: {
    item: CarouselItem;
    index: number;
    infiniteIndex: number;
    scrollOffset: SharedValue<number>;
    itemWidth: number;
    period: number;
}) => {
    useEffect(() => {
        mountedCards++;
        notifyMountListeners();
        return () => {
            mountedCards--;
            notifyMountListeners();
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const raw = scrollOffset.value - infiniteIndex * itemWidth;
        const wrapped = raw - Math.round(raw / period) * period;
        const distance = Math.abs(wrapped / itemWidth);

        return {
            opacity: interpolate(distance, [0, 1, 2], [1, 0.55, 0.4], Extrapolation.CLAMP),
            transform: [
                { scale: interpolate(distance, [0, 1, 2], [1, 0.86, 0.8], Extrapolation.CLAMP) },
                { translateY: interpolate(distance, [0, 1], [0, 24], Extrapolation.CLAMP) },
            ],
        };
    }, [infiniteIndex, itemWidth, period]);

    return (
        <Animated.View style={[styles.card, { backgroundColor: item.color, width: itemWidth - 16 }, animatedStyle]}>
            <Text style={styles.cardEmoji}>{item.emoji}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardIndex}>item {index}</Text>
        </Animated.View>
    );
};

const ITEM_COUNT_OPTIONS = [2, 8, 16, 32, 64];

const buildItems = (count: number): CarouselItem[] =>
    Array.from({ length: count }, (_, i) => {
        const base = ITEMS[i % ITEMS.length];
        return {
            ...base,
            id: `${base.id}-${Math.floor(i / ITEMS.length)}`,
            title: `${base.title} ${i}`,
        };
    });

export default function InfiniteCarouselFixtureScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const itemWidth = windowWidth;
    const sidePadding = (windowWidth - itemWidth) / 2;

    const refList = useRef<LegendListRef>(null);
    const scrollOffset = useSharedValue(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const [itemCount, setItemCount] = useState(8);
    const [loadTimeMs, setLoadTimeMs] = useState<number | undefined>(undefined);
    const mountedCardsCount = useMountedCardsCount();

    const items = useMemo(() => buildItems(itemCount), [itemCount]);
    const period = itemWidth * items.length;

    const jumpTargets = useMemo(
        () =>
            items.length <= 16
                ? items.map((_, index) => index)
                : [0, 1, 2, 3].map((quarter) => Math.floor((items.length / 4) * quarter)),
        [items],
    );

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.countRow}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.countScroll}
            >
                {ITEM_COUNT_OPTIONS.map((count) => (
                    <Pressable
                        key={count}
                        onPress={() => {
                            setActiveIndex(0);
                            setLoadTimeMs(undefined);
                            setItemCount(count);
                        }}
                        style={[styles.countButton, itemCount === count ? styles.countButtonActive : undefined]}
                    >
                        <Text
                            style={[
                                styles.countButtonText,
                                itemCount === count ? styles.countButtonTextActive : undefined,
                            ]}
                        >
                            {count} item{count === 1 ? "" : "s"}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
            <View style={{ height: CAROUSEL_HEIGHT }}>
                <InfiniteLegendList
                    contentContainerStyle={{ paddingHorizontal: sidePadding }}
                    data={items}
                    decelerationRate="fast"
                    getFixedItemSize={() => itemWidth}
                    horizontal
                    key={itemCount}
                    keyExtractor={(item) => item.id}
                    ListComponent={AnimatedLegendList}
                    onLoad={({ elapsedTimeInMs }) => setLoadTimeMs(elapsedTimeInMs)}
                    onViewableItemsChanged={({ viewableItems }) => {
                        const centered = viewableItems.find((token) => token.isViewable);
                        if (centered && centered.index != null) {
                            setActiveIndex(centered.index);
                        }
                    }}
                    recycleItems
                    ref={refList}
                    renderItem={({ item, index, infiniteIndex }) => (
                        <Card
                            index={index}
                            infiniteIndex={infiniteIndex}
                            item={item}
                            itemWidth={itemWidth}
                            period={period}
                            scrollOffset={scrollOffset}
                        />
                    )}
                    sharedValues={{ scrollOffset }}
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={itemWidth}
                    style={{ height: CAROUSEL_HEIGHT }}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
                />
            </View>

            {items.length <= 16 && (
                <View style={styles.dotsRow}>
                    {items.map((item, index) => (
                        <View
                            key={item.id}
                            style={[styles.dot, index === activeIndex ? styles.dotActive : undefined]}
                        />
                    ))}
                </View>
            )}

            <Text style={styles.activeLabel}>
                Active: {items[activeIndex]?.emoji} {items[activeIndex]?.title}
            </Text>
            <Text style={styles.loadLabel}>
                {loadTimeMs !== undefined ? `onLoad: ${Math.round(loadTimeMs)}ms · ${items.length} items · ` : ""}
                mounted cards: {mountedCardsCount}
            </Text>

            <Text style={styles.hint}>Swipe endlessly in either direction, or jump with shortest-path wrap:</Text>
            <View style={styles.buttonsRow}>
                {jumpTargets.map((index) => (
                    <Pressable
                        key={items[index].id}
                        onPress={() => refList.current?.scrollToIndex({ animated: true, index })}
                        style={[styles.jumpButton, { backgroundColor: items[index].color }]}
                    >
                        <Text style={styles.jumpButtonText}>{index}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    activeLabel: {
        color: "#1f1f1f",
        fontSize: 16,
        fontWeight: "700",
        marginTop: 12,
        textAlign: "center",
    },
    buttonsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
        marginTop: 12,
        paddingHorizontal: 16,
    },
    card: {
        alignItems: "center",
        borderRadius: 20,
        height: CAROUSEL_HEIGHT - 60,
        justifyContent: "center",
        marginHorizontal: 8,
        marginTop: 16,
    },
    cardEmoji: {
        fontSize: 64,
    },
    cardIndex: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 14,
        fontWeight: "600",
        marginTop: 4,
    },
    cardTitle: {
        color: "#FFFFFF",
        fontSize: 24,
        fontWeight: "700",
        marginTop: 12,
    },
    container: {
        backgroundColor: "#F8F5F2",
        flex: 1,
        paddingTop: 12,
    },
    countButton: {
        borderColor: "#C9C4BE",
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    countButtonActive: {
        backgroundColor: "#1f1f1f",
        borderColor: "#1f1f1f",
    },
    countButtonText: {
        color: "#1f1f1f",
        fontSize: 13,
        fontWeight: "600",
    },
    countButtonTextActive: {
        color: "#FFFFFF",
    },
    countRow: {
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 16,
    },
    countScroll: {
        flexGrow: 0,
        marginBottom: 8,
    },
    dot: {
        backgroundColor: "#D0D0D0",
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    dotActive: {
        backgroundColor: "#1f1f1f",
        width: 20,
    },
    dotsRow: {
        flexDirection: "row",
        gap: 6,
        justifyContent: "center",
        marginTop: 8,
    },
    hint: {
        color: "#6B6B6B",
        fontSize: 13,
        marginTop: 20,
        paddingHorizontal: 24,
        textAlign: "center",
    },
    jumpButton: {
        alignItems: "center",
        borderRadius: 18,
        height: 36,
        justifyContent: "center",
        width: 36,
    },
    jumpButtonText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "700",
    },
    loadLabel: {
        color: "#8A8580",
        fontSize: 12,
        marginTop: 4,
        minHeight: 16,
        textAlign: "center",
    },
});
