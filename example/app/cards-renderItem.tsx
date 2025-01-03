import { MaterialIcons } from "@expo/vector-icons";
import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";
import { useRef, useState } from "react";
import {
    Animated,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    UIManager,
    View,
    useAnimatedValue,
} from "react-native";
import { RectButton } from "react-native-gesture-handler";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

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
            style={{
                width: 80,
                height: "100%",
                backgroundColor: "#4CAF50",
                justifyContent: "center",
                alignItems: "center",
                borderTopRightRadius: 12,
                borderBottomRightRadius: 12,
                shadowColor: "#000",
                shadowOffset: { width: 2, height: 0 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            }}
            onPress={() => {
                console.log("Marked as complete");
            }}
        >
            <MaterialIcons name="check-circle" size={24} color="white" />
            <Text
                style={{
                    color: "white",
                    fontSize: 12,
                    marginTop: 4,
                    fontWeight: "600",
                }}
            >
                Complete
            </Text>
        </RectButton>
    );
};

export const ItemCard = ({
    item,
    index,
    useRecyclingEffect,
    useRecyclingState,
    useViewability,
    useViewabilityAmount,
}: LegendListRenderItemProps<Item>) => {
    const refSwipeable = useRef<SwipeableMethods>();

    // A useState that resets when the item is recycled
    const [isExpanded, setIsExpanded] = useRecyclingState ? useRecyclingState(() => false) : useState(() => false);

    // A callback when the item is recycled
    useRecyclingEffect?.(({ item, prevItem, index, prevIndex }) => {
        refSwipeable?.current?.close();
    });

    // A callback when the item viewability (from viewabilityConfig) changes
    useViewability?.("viewability", ({ item, isViewable, index }) => {
        // console.log('viewable', viewToken.index, viewToken.isViewable);
    });

    // @ts-ignore
    const opacity = useViewabilityAmount ? useAnimatedValue(1) : 1;
    useViewabilityAmount?.(({ sizeVisible, size, percentOfScroller }) => {
        // @ts-ignore
        // opacity.setValue(Math.max(0, Math.min(1, sizeVisible / Math.min(400, size || 400)) ** 1.5));
        // console.log('viewable', sizeVisible, size, percentOfScroller);
    });

    // Math.abs needed for negative indices
    const indexForData = Math.abs(item.id.includes("new") ? 100 + +item.id.replace("new", "") : +item.id);

    // Generate 1-5 random sentences
    const numSentences = ((indexForData * 7919) % loremSentences.length) + 2; // Using prime number 7919 for better distribution
    //   const indexForData =
    //     item.id === "0" ? 0 : item.id === "1" ? 1 : item.id === "new0" ? 2 : 3;
    //   const numSentences =
    //     item.id === "0" ? 1 : item.id === "1" ? 2 : item.id === "new0" ? 4 : 8;
    const randomText = Array.from({ length: numSentences }, (_, i) => loremSentences[i]).join(" ");

    // Use randomIndex to deterministically select random data
    const avatarUrl = randomAvatars[indexForData % randomAvatars.length];
    const authorName = randomNames[indexForData % randomNames.length];
    const timestamp = `${Math.max(1, indexForData % 24)}h ago`;

    if (index === 1 && demoNestedList) {
        return (
            <Animated.View style={[styles.nestedListContainer, { opacity }]}>
                <LegendList
                    showsHorizontalScrollIndicator={false}
                    horizontal
                    estimatedItemSize={400}
                    keyExtractor={(item) => item.text}
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
                    ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
                    renderItem={({ item }) => (
                        <View style={styles.nestedListItem}>
                            <Text>{item.text}</Text>
                        </View>
                    )}
                />
            </Animated.View>
        );
    }

    return (
        <Animated.View style={{ ...styles.itemOuterContainer, opacity }}>
            <Swipeable
                renderRightActions={renderRightActions}
                overshootRight={true}
                containerStyle={styles.swipeableContainer}
                ref={refSwipeable as any}
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
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                                // marginVertical: 8,
                                overflow: "hidden",
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
                        </View>
                    </View>
                    {/* <Breathe /> */}
                </Pressable>
            </Swipeable>
        </Animated.View>
    );
};

export const renderItem = (props: LegendListRenderItemProps<Item>) => <ItemCard {...props} />;

const styles = StyleSheet.create({
    nestedListContainer: {
        paddingVertical: 8,
        paddingHorizontal: 8,
        height: 200,
    },
    nestedListItem: {
        backgroundColor: "white",
        height: 200,
        width: 200,
        justifyContent: "center",
        alignItems: "center",
    },
    itemOuterContainer: {
        paddingVertical: 8,
        paddingHorizontal: 8,
        //width: 380,
        //marginLeft: 6,
    },
    itemContainer: {
        padding: 16,
        // borderBottomWidth: 1,
        // borderBottomColor: "#ccc",
    },
    titleContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
    listContainer: {
        paddingHorizontal: 16,
    },
    itemTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 8,
        color: "#1a1a1a",
    },
    itemBody: {
        fontSize: 14,
        color: "#666666",
        lineHeight: 20,
        // flex: 1,
    },
    itemFooter: {
        flexDirection: "row",
        justifyContent: "flex-start",
        gap: 16,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
    },
    footerText: {
        fontSize: 14,
        color: "#888888",
    },
    headerContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    authorName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1a1a1a",
    },
    timestamp: {
        fontSize: 12,
        color: "#888888",
        marginTop: 2,
    },
    swipeableContainer: { backgroundColor: "#4CAF50", borderRadius: 12 },
});

export default renderItem;
