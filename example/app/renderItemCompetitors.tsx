import { MaterialIcons } from "@expo/vector-icons";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { EMULATE_SLOW_RENDER } from "@/constants/constants";
import type { ListRenderItem as ListRenderItemFlashList } from "@shopify/flash-list";
import { useState } from "react";
import type { ListRenderItem as ListRenderItemFlatList } from "react-native";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { RectButton } from "react-native-gesture-handler";
import {} from "react-native-reanimated";

export interface Item {
  id: string;
}

// Generate random metadata
const randomAvatars = Array.from(
  { length: 20 },
  (_, i) => `https://i.pravatar.cc/150?img=${i + 1}`,
);

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

interface ItemCardProps {
  item: Item;
  index: number;
}

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

export const ItemCard = ({ item }: ItemCardProps) => {
  const now = performance.now();
  if (EMULATE_SLOW_RENDER) {
    while (performance.now() - now < EMULATE_SLOW_RENDER) {
      // Just wait
    }
  }
  const [isExpanded, setIsExpanded] = useState(false);

  const indexForData = item.id.includes("new")
    ? 100 + +item.id.replace("new", "")
    : +item.id;

  // Generate 1-5 random sentences
  const numSentences = ((indexForData * 7919) % loremSentences.length) + 2; // Using prime number 7919 for better distribution
  //   const indexForData =
  //     item.id === "0" ? 0 : item.id === "1" ? 1 : item.id === "new0" ? 2 : 3;
  //   const numSentences =
  //     item.id === "0" ? 1 : item.id === "1" ? 2 : item.id === "new0" ? 4 : 8;
  const randomText = Array.from(
    { length: numSentences },
    (_, i) => loremSentences[i],
  ).join(" ");

  // Use randomIndex to deterministically select random data
  const avatarUrl = randomAvatars[indexForData % randomAvatars.length];
  const authorName = randomNames[indexForData % randomNames.length];
  const timestamp = `${Math.max(1, indexForData % 24)}h ago`;

  return (
    <View style={styles.itemOuterContainer}>
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight={true}
        containerStyle={{ backgroundColor: "#4CAF50", borderRadius: 12 }}
      >
        <Pressable
          onPress={() => {
            //   LinearTransition.easing(Easing.ease);

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
    </View>
  );
};

export const renderItemFlashList: ListRenderItemFlashList<Item> = ({
  item,
  index,
}) => <ItemCard item={item} index={index} />;

export const renderItemFlatList: ListRenderItemFlatList<Item> = ({
  item,
  index,
}) => <ItemCard item={item} index={index} />;

const styles = StyleSheet.create({
  itemOuterContainer: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    // marginTop: 16,
    maxWidth: 360,
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
});
