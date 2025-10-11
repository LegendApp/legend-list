import { MaterialIcons } from "@expo/vector-icons";
import { memo, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { LegendList, type LegendListRenderItemProps, useRecyclingState } from "@legendapp/list";
import { PERF_TEST } from "../constants/constants";

export interface Item {
    id: string;
}
const demoNestedList = false;

// Generate random metadata
const randomAvatars = Array.from({ length: 20 }, (_, i) => `https://i.pravatar.cc/150?img=${i + 1}`);

export const randomNames = [
    "Alex Thompson",
    "Jordan Lee",
    "Sam Parker",
    "Taylor Kim",
    "Morgan Chen",
    "Riley Zhang",
    "Casey Williams",
    "Quinn Anderson",
    "Blake Martinez",
    "Avery Rodriguez",
    "Drew Campbell",
    "Jamie Foster",
    "Skylar Patel",
    "Charlie Wright",
    "Sage Mitchell",
    "River Johnson",
    "Phoenix Garcia",
    "Jordan Taylor",
    "Reese Cooper",
    "Morgan Bailey",
];

// Array of lorem ipsum sentences to randomly choose from
export const loremSentences = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
    "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.",
    "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
    "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.",
    "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
];

if (Platform.OS === "android") {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const renderRightActions = () => {
    return (
        <RectButton
            onPress={() => {
                console.log("Marked as complete");
            }}
            style={{
                alignItems: "center",
                backgroundColor: "#4CAF50",
                borderBottomRightRadius: 12,
                borderTopRightRadius: 12,
                height: "100%",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOffset: { height: 0, width: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                width: 80,
            }}
        >
            <MaterialIcons color="white" name="check-circle" size={24} />
            <Text
                style={{
                    color: "white",
                    fontSize: 12,
                    fontWeight: "600",
                    marginTop: 4,
                }}
            >
                Complete
            </Text>
        </RectButton>
    );
};

// Inline Separator makes containers rerender each data change
const Separator = () => <View style={{ height: 10 }} />;

export const ItemCard = memo(
    ({
        item,
        index,
        extraData,
        numSentences: numSentencesProp,
    }: LegendListRenderItemProps<Item> & { numSentences?: number | ((index: number) => number) }) => {
        const refSwipeable = useRef<SwipeableMethods | null>(null);

        // A useState that resets when the item is recycled
        const [isExpandedValue, setIsExpanded] = extraData?.recycleState
            ? useRecyclingState(() => false)
            : useState(false);
        const isExpanded = isExpandedValue ?? false;

        const swipeableState = useRef(false);

        // console.log(Math.round(performance.now()), "renderItem", index);

        // A callback when the item is recycled
        // useRecyclingEffect?.(({ item, prevItem, index, prevIndex }) => {
        //     if (swipeableState.current) {
        //         // this is expensive operation, run .close() only if the swipeable is open
        //         refSwipeable?.current?.close();
        //     }
        // });

        // A callback when the item viewability (from viewabilityConfig) changes
        // useViewability?.("viewability", ({ item, isViewable, index }) => {
        //     // console.log('viewable', viewToken.index, viewToken.isViewable);
        // });

        // @ts-ignore
        // const opacity = useViewabilityAmount ? useAnimatedValue(1) : 1;
        // useViewabilityAmount?.(({ sizeVisible, size, percentOfScroller }) => {
        //     // @ts-ignore
        //     // opacity.setValue(Math.max(0, Math.min(1, sizeVisible / Math.min(400, size || 400)) ** 1.5));
        //     // console.log('viewable', sizeVisible, size, percentOfScroller);
        // });

        // Math.abs needed for negative indices
        const indexForData = Math.abs(item.id.includes("new") ? 100 + +item.id.replace("new", "") : +item.id);

        // EXPENSIVE COMPUTATIONS (for performance testing)
        let perfTestResults = null;
        if (PERF_TEST) {
            // COMPUTATION 1: Prime number calculation
            const isPrime = (n: number): boolean => {
                if (n <= 1) return false;
                if (n <= 3) return true;
                if (n % 2 === 0 || n % 3 === 0) return false;
                for (let i = 5; i * i <= n; i += 6) {
                    if (n % i === 0 || n % (i + 2) === 0) return false;
                }
                return true;
            };
            const primeCheck = isPrime(indexForData + 1000);

            // COMPUTATION 2: Fibonacci calculation (intentionally inefficient)
            const fibonacci = (n: number): number => {
                if (n <= 1) return n;
                return fibonacci(n - 1) + fibonacci(n - 2);
            };
            const fibResult = fibonacci(Math.min((indexForData % 20) + 15, 25)); // Cap at 25 to avoid extreme slowness

            // COMPUTATION 3: Complex string manipulation
            const expensiveStringOp = (str: string): string => {
                let result = str;
                for (let i = 0; i < 50; i++) {
                    result = result.split("").reverse().join("").toLowerCase().toUpperCase();
                }
                return result.slice(0, 10);
            };
            const processedString = expensiveStringOp(item.id.repeat(10));

            // COMPUTATION 4: Array sorting and filtering
            const largeArray = Array.from({ length: 1000 }, (_, _i) => Math.random() * indexForData);
            const sortedFiltered = largeArray
                .filter((x) => x > indexForData / 2)
                .sort((a, b) => b - a)
                .slice(0, 10);

            perfTestResults = { fibResult, primeCheck, processedString, sortedFiltered };
        }

        // Generate 1-5 random sentences
        const numSentences = numSentencesProp
            ? typeof numSentencesProp === "function"
                ? numSentencesProp(indexForData)
                : numSentencesProp
            : ((indexForData * 7919) % 12) + 1; // Using prime number 7919 for better distribution
        //   const indexForData =
        //     item.id === "0" ? 0 : item.id === "1" ? 1 : item.id === "new0" ? 2 : 3;
        //   const numSentences =
        //     item.id === "0" ? 1 : item.id === "1" ? 2 : item.id === "new0" ? 4 : 8;
        const randomText = Array.from(
            { length: numSentences },
            (_, i) => loremSentences[i % loremSentences.length],
        ).join(" ");

        // Use randomIndex to deterministically select random data
        const avatarUrl = randomAvatars[indexForData % randomAvatars.length];
        const authorName = randomNames[indexForData % randomNames.length];
        const timestamp = `${Math.max(1, indexForData % 24)}h ago`;

        if (index === 1 && demoNestedList) {
            return (
                <Animated.View style={[styles.nestedListContainer]}>
                    <LegendList
                        data={[
                            {
                                id: "1",
                                text: "List Item 1",
                            },
                            {
                                id: "2",
                                text: "List Item 2",
                            },
                            {
                                id: "3",
                                text: "List Item 3",
                            },
                        ]}
                        estimatedItemSize={400}
                        horizontal
                        ItemSeparatorComponent={Separator}
                        keyExtractor={(item) => item.text}
                        renderItem={({ item }) => (
                            <View style={styles.nestedListItem}>
                                <Text>{item.text}</Text>
                            </View>
                        )}
                        showsHorizontalScrollIndicator={false}
                    />
                </Animated.View>
            );
        }

        return (
            <View style={{ ...styles.itemOuterContainer }}>
                <Swipeable
                    containerStyle={styles.swipeableContainer}
                    onSwipeableWillClose={() => {
                        swipeableState.current = false;
                    }}
                    onSwipeableWillOpen={() => {
                        swipeableState.current = true;
                    }}
                    overshootRight={true}
                    ref={refSwipeable as any}
                    renderRightActions={renderRightActions}
                >
                    <Pressable
                        onPress={(e) => {
                            //   LinearTransition.easing(Easing.ease);

                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        <View
                            style={[
                                styles.itemContainer,
                                {
                                    // padding: 16,
                                    backgroundColor: "#ffffff",
                                    borderRadius: 12,
                                    // marginVertical: 8,
                                    overflow: "hidden",
                                    shadowColor: "#000",
                                    shadowOffset: { height: 2, width: 0 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 4,
                                },
                            ]}
                        >
                            <View style={styles.headerContainer}>
                                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                                <View style={styles.headerText}>
                                    <Text style={styles.authorName}>
                                        {authorName} {item.id}
                                    </Text>
                                    <Text style={styles.timestamp}>{timestamp}</Text>
                                </View>
                            </View>

                            <Text style={styles.itemTitle}>Item #{item.id}</Text>
                            <Text
                                style={styles.itemBody}
                                //   numberOfLines={isExpanded ? undefined : 10}
                            >
                                {randomText}
                                {isExpanded ? randomText : null}
                            </Text>
                            <View style={styles.itemFooter}>
                                <Text style={styles.footerText}>❤️ 42</Text>
                                <Text style={styles.footerText}>💬 12</Text>
                                <Text style={styles.footerText}>🔄 8</Text>
                                {perfTestResults && (
                                    <Text style={styles.footerText}>
                                        🧮 Prime: {perfTestResults.primeCheck ? "✓" : "✗"} | Fib:{" "}
                                        {perfTestResults.fibResult}
                                        {/* | Str: {perfTestResults.processedString} | Array:{" "} */}
                                        {/* {perfTestResults.sortedFiltered.length} */}
                                    </Text>
                                )}
                            </View>
                        </View>
                        {/* <Breathe /> */}
                    </Pressable>
                </Swipeable>
            </View>
        );
    },
);

export const renderItem = (props: LegendListRenderItemProps<Item>) => <ItemCard {...props} />;

const styles = StyleSheet.create({
    authorName: {
        color: "#1a1a1a",
        fontSize: 16,
        fontWeight: "600",
    },
    avatar: {
        borderRadius: 20,
        height: 40,
        marginRight: 12,
        width: 40,
    },
    footerText: {
        color: "#888888",
        fontSize: 14,
    },
    headerContainer: {
        alignItems: "center",
        flexDirection: "row",
        marginBottom: 12,
    },
    headerText: {
        flex: 1,
    },
    itemBody: {
        color: "#666666",
        fontSize: 14,
        lineHeight: 20,
        // flex: 1,
    },
    itemContainer: {
        padding: 16,
        // borderBottomWidth: 1,
        // borderBottomColor: "#ccc",
    },
    itemFooter: {
        borderTopColor: "#f0f0f0",
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 16,
        justifyContent: "flex-start",
        marginTop: 12,
        paddingTop: 12,
    },
    itemOuterContainer: {
        paddingHorizontal: 8,
        paddingVertical: 8,
        //width: 380,
        //marginLeft: 6,
    },
    itemTitle: {
        color: "#1a1a1a",
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 8,
    },
    listContainer: {
        paddingHorizontal: 16,
    },
    nestedListContainer: {
        height: 200,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    nestedListItem: {
        alignItems: "center",
        backgroundColor: "white",
        height: 200,
        justifyContent: "center",
        width: 200,
    },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
    swipeableContainer: { backgroundColor: "#4CAF50", borderRadius: 12 },
    timestamp: {
        color: "#888888",
        fontSize: 12,
        marginTop: 2,
    },
    titleContainer: {
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
    },
});

export default renderItem;
