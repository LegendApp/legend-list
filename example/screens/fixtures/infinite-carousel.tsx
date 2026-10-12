import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
    Extrapolation,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
} from "react-native-reanimated";

import { InfiniteLegendList } from "@legendapp/list/infinite";
import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { AnimatedLegendList } from "@legendapp/list/reanimated";

type CarouselItem = {
    id: string;
    title: string;
    emoji: string;
    color: string;
};

const TEAMS: CarouselItem[] = [
    { color: "#3C3B6E", emoji: "🇺🇸", id: "usa", title: "USA" },
    { color: "#006847", emoji: "🇲🇽", id: "mexico", title: "Mexico" },
    { color: "#D52B1E", emoji: "🇨🇦", id: "canada", title: "Canada" },
    { color: "#74ACDF", emoji: "🇦🇷", id: "argentina", title: "Argentina" },
    { color: "#009C3B", emoji: "🇧🇷", id: "brazil", title: "Brazil" },
    { color: "#262626", emoji: "🇩🇪", id: "germany", title: "Germany" },
    { color: "#0055A4", emoji: "🇫🇷", id: "france", title: "France" },
    { color: "#BC002D", emoji: "🇯🇵", id: "japan", title: "Japan" },
    { color: "#AA151B", emoji: "🇪🇸", id: "spain", title: "Spain" },
    { color: "#21366C", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", id: "england", title: "England" },
    { color: "#046A38", emoji: "🇵🇹", id: "portugal", title: "Portugal" },
    { color: "#F36C21", emoji: "🇳🇱", id: "netherlands", title: "Netherlands" },
    { color: "#C8102E", emoji: "🇧🇪", id: "belgium", title: "Belgium" },
    { color: "#1D3F94", emoji: "🇭🇷", id: "croatia", title: "Croatia" },
    { color: "#55A8CE", emoji: "🇺🇾", id: "uruguay", title: "Uruguay" },
    { color: "#C99700", emoji: "🇨🇴", id: "colombia", title: "Colombia" },
    { color: "#23407E", emoji: "🇪🇨", id: "ecuador", title: "Ecuador" },
    { color: "#B9314F", emoji: "🇵🇾", id: "paraguay", title: "Paraguay" },
    { color: "#00205B", emoji: "🇳🇴", id: "norway", title: "Norway" },
    { color: "#005293", emoji: "🇸🇪", id: "sweden", title: "Sweden" },
    { color: "#8B1A1A", emoji: "🇨🇭", id: "switzerland", title: "Switzerland" },
    { color: "#9E1B32", emoji: "🇦🇹", id: "austria", title: "Austria" },
    { color: "#123C7D", emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", id: "scotland", title: "Scotland" },
    { color: "#7A1220", emoji: "🇹🇷", id: "turkiye", title: "Türkiye" },
    { color: "#11457E", emoji: "🇨🇿", id: "czechia", title: "Czechia" },
    { color: "#002F6C", emoji: "🇧🇦", id: "bosnia", title: "Bosnia and Herzegovina" },
    { color: "#7C1F24", emoji: "🇲🇦", id: "morocco", title: "Morocco" },
    { color: "#00853F", emoji: "🇸🇳", id: "senegal", title: "Senegal" },
    { color: "#A31621", emoji: "🇪🇬", id: "egypt", title: "Egypt" },
    { color: "#006233", emoji: "🇩🇿", id: "algeria", title: "Algeria" },
    { color: "#A02128", emoji: "🇹🇳", id: "tunisia", title: "Tunisia" },
    { color: "#B08900", emoji: "🇬🇭", id: "ghana", title: "Ghana" },
    { color: "#E06D10", emoji: "🇨🇮", id: "ivory-coast", title: "Ivory Coast" },
    { color: "#003893", emoji: "🇨🇻", id: "cape-verde", title: "Cape Verde" },
    { color: "#007749", emoji: "🇿🇦", id: "south-africa", title: "South Africa" },
    { color: "#0085CA", emoji: "🇨🇩", id: "dr-congo", title: "DR Congo" },
    { color: "#7D1128", emoji: "🇰🇷", id: "south-korea", title: "South Korea" },
    { color: "#2E7D32", emoji: "🇮🇷", id: "iran", title: "Iran" },
    { color: "#556B2F", emoji: "🇮🇶", id: "iraq", title: "Iraq" },
    { color: "#165B33", emoji: "🇸🇦", id: "saudi-arabia", title: "Saudi Arabia" },
    { color: "#8A1538", emoji: "🇶🇦", id: "qatar", title: "Qatar" },
    { color: "#365314", emoji: "🇯🇴", id: "jordan", title: "Jordan" },
    { color: "#0099B5", emoji: "🇺🇿", id: "uzbekistan", title: "Uzbekistan" },
    { color: "#B8860B", emoji: "🇦🇺", id: "australia", title: "Australia" },
    { color: "#101820", emoji: "🇳🇿", id: "new-zealand", title: "New Zealand" },
    { color: "#002B7F", emoji: "🇨🇼", id: "curacao", title: "Curaçao" },
    { color: "#00209F", emoji: "🇭🇹", id: "haiti", title: "Haiti" },
    { color: "#26428B", emoji: "🇵🇦", id: "panama", title: "Panama" },
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

const Dot = ({ index, position, totalCount }: { index: number; position: SharedValue<number>; totalCount: number }) => {
    const animatedStyle = useAnimatedStyle(() => {
        const distance = Math.abs(position.value - index);
        const wrappedDistance = Math.min(distance, totalCount - distance);

        return {
            backgroundColor: interpolateColor(wrappedDistance, [0, 1], ["#1f1f1f", "#D0D0D0"]),
            width: interpolate(wrappedDistance, [0, 1], [20, 8], Extrapolation.CLAMP),
        };
    }, [index, totalCount]);

    return <Animated.View style={[styles.dot, animatedStyle]} />;
};

const ITEM_COUNT_OPTIONS = [2, 8, 16, 32, 48];

export default function InfiniteCarouselFixtureScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const itemWidth = windowWidth;
    const sidePadding = (windowWidth - itemWidth) / 2;

    const refList = useRef<LegendListRef>(null);
    const scrollOffset = useSharedValue(0);
    const [itemCount, setItemCount] = useState(8);
    const [loadTimeMs, setLoadTimeMs] = useState<number | undefined>(undefined);
    const mountedCardsCount = useMountedCardsCount();

    const items = useMemo(() => TEAMS.slice(0, itemCount), [itemCount]);
    const period = itemWidth * items.length;

    const position = useDerivedValue(() => {
        const rawPosition = scrollOffset.value / itemWidth;
        return ((rawPosition % itemCount) + itemCount) % itemCount;
    }, [itemWidth, itemCount]);

    return (
        <View style={styles.container}>
            <LegendList
                contentContainerStyle={styles.countRow}
                data={ITEM_COUNT_OPTIONS}
                extraData={itemCount}
                horizontal
                keyExtractor={(count) => String(count)}
                recycleItems={false}
                renderItem={({ item: count }) => (
                    <Pressable
                        onPress={() => {
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
                            {count} team{count === 1 ? "" : "s"}
                        </Text>
                    </Pressable>
                )}
                showsHorizontalScrollIndicator={false}
                style={styles.countScroll}
            />
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
                />
            </View>

            {items.length <= 16 && (
                <View style={styles.dotsRow}>
                    {items.map((item, index) => (
                        <Dot index={index} key={item.id} position={position} totalCount={items.length} />
                    ))}
                </View>
            )}

            <Text style={styles.loadLabel}>
                {loadTimeMs !== undefined ? `onLoad: ${Math.round(loadTimeMs)}ms · ${items.length} teams · ` : ""}
                mounted cards: {mountedCardsCount}
            </Text>

            <Text style={styles.hint}>Swipe endlessly in either direction, or jump with shortest-path wrap:</Text>
            <View style={styles.buttonsRow}>
                {items.map((item, index) => (
                    <Pressable
                        key={item.id}
                        onPress={() => refList.current?.scrollToIndex({ animated: true, index })}
                        style={[styles.jumpButton, { backgroundColor: item.color }]}
                    >
                        <Text style={styles.jumpButtonText}>{item.emoji}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
        gap: 8,
        paddingHorizontal: 16,
    },
    countScroll: {
        flexGrow: 0,
        height: 34,
        marginBottom: 8,
    },
    dot: {
        backgroundColor: "#D0D0D0",
        borderRadius: 4,
        height: 8,
        width: 8,
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
        fontSize: 18,
    },
    loadLabel: {
        color: "#8A8580",
        fontSize: 12,
        marginTop: 4,
        minHeight: 16,
        textAlign: "center",
    },
});
