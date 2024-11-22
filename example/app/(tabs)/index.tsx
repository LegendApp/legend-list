import { LegendList } from "@legendapp/list";
import { useRef, useState } from "react";
import {
  LogBox,
  Platform,
  type ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { type Item, renderItem } from "../renderItem";

LogBox.ignoreLogs(["Open debugger"]);

// @ts-ignore
const uiManager = global?.nativeFabricUIManager ? "Fabric" : "Paper";

console.log(`Using ${uiManager}`);

const ESTIMATED_ITEM_LENGTH = 200;

export default function HomeScreen() {
  const scrollViewRef = useRef<ScrollView>(null);

  const [data, setData] = useState<Item[]>(() =>
    Array.from({ length: 500 }, (_, i) => ({
      id: i.toString(),
    })),
  );

  //   useEffect(() => {
  //     let num = 0;
  //     const interval = setInterval(() => {
  //       setData((prev) => [prev[0], { id: "new" + num++ }, ...prev.slice(1)]);
  //       if (num > 10) {
  //         clearInterval(interval);
  //       }
  //     }, 2000);
  //   }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.outerContainer]}>
      <LegendList
        ref={scrollViewRef}
        style={[StyleSheet.absoluteFill, styles.scrollContainer]}
        contentContainerStyle={styles.listContainer}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemLength={() => ESTIMATED_ITEM_LENGTH}
        drawDistance={1000}
        recycleItems={true}
        // autoScrollToBottom
        // autoScrollToBottomAnimated
        onEndReached={({ distanceFromEnd }) => {
          console.log("onEndReached", distanceFromEnd);
        }}
        ListHeaderComponent={<View />}
        ListHeaderComponentStyle={styles.listHeader}

        // initialScrollOffset={20000}
        // initialScrollIndex={500}
        // inverted
        // horizontal
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    alignSelf: "center",
    height: 100,
    width: 100,
    backgroundColor: "#456AAA",
    borderRadius: 12,
    marginHorizontal: 8,
    marginTop: 8,
  },
  outerContainer: {
    backgroundColor: "#456",
    bottom: Platform.OS === "ios" ? 82 : 0,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    // paddingrVertical: 48,
  },

  itemContainer: {
    // padding: 4,
    // borderBottomWidth: 1,
    // borderBottomColor: "#ccc",
  },
  listContainer: {
    // paddingHorizontal: 16,
    paddingTop: 48,
  },
});
