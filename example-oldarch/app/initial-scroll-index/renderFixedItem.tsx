import { MaterialIcons } from "@expo/vector-icons";
import { Image, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { loremSentences, randomNames } from "~/app/cards-renderItem";

export interface Item {
    id: string;
}

// Generate random metadata
const randomAvatars = Array.from({ length: 20 }, (_, i) => `https://i.pravatar.cc/150?img=${i + 1}`);

interface ItemCardProps {
    item: Item;
    index: number;
    height: number;
}

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

export const ItemCard = ({ item, height }: ItemCardProps) => {
    const indexForData = item.id.includes("new") ? 100 + +item.id.replace("new", "") : +item.id;

    // Generate 1-5 random sentences
    const numSentences = 5;
    //   const indexForData =
    //     item.id === "0" ? 0 : item.id === "1" ? 1 : item.id === "new0" ? 2 : 3;
    //   const numSentences =
    //     item.id === "0" ? 1 : item.id === "1" ? 2 : item.id === "new0" ? 4 : 8;
    const randomText = Array.from({ length: numSentences }, (_, i) => loremSentences[i]).join(" ");

    // Use randomIndex to deterministically select random data
    const avatarUrl = randomAvatars[indexForData % randomAvatars.length];
    const authorName = randomNames[indexForData % randomNames.length];
    const timestamp = `${Math.max(1, indexForData % 24)}h ago`;

    return (
        <View style={[styles.itemOuterContainer, { height }]}>
            <Swipeable
                containerStyle={{ backgroundColor: "#4CAF50", borderRadius: 12 }}
                overshootRight={true}
                renderRightActions={renderRightActions}
            >
                <Pressable
                    onPress={() => {
                        //   LinearTransition.easing(Easing.ease);
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
                        </Text>
                        <View style={styles.itemFooter}>
                            <Text style={styles.footerText}>❤️ 42</Text>
                            <Text style={styles.footerText}>💬 12</Text>
                            <Text style={styles.footerText}>🔄 8</Text>
                        </View>
                    </View>
                </Pressable>
            </Swipeable>
        </View>
    );
};

export const renderItem = ({ item, index, height }: ItemCardProps) => (
    <ItemCard height={height} index={index} item={item} />
);

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
        // marginTop: 16,
        //  maxWidth: 360,
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
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
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
