import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LegendList } from "@legendapp/list";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Link, type LinkProps } from "expo-router";
import { useCallback } from "react";
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// @ts-expect-error nativeFabricUIManager is not defined in the global object types
export const IsNewArchitecture = global.nativeFabricUIManager != null;

type ListElement = {
    id: number;
    title: string;
    url: LinkProps["href"];
    index: number;
};

const data: ListElement[] = [
    {
        title: "Bidirectional Infinite List",
        url: "/bidirectional-infinite-list",
    },
    {
        title: "Chat example",
        url: "/chat-example",
    },
    {
        title: "Infinite chat",
        url: "/chat-infinite",
    },
    {
        title: "Countries List",
        url: "/countries",
    },
    {
        title: "Accurate scrollToIndex",
        url: "/accurate-scrollto",
    },
    {
        title: "Accurate scrollToIndex 2",
        url: "/accurate-scrollto-2",
    },
    {
        title: "Columns",
        url: "/columns",
    },

    {
        title: "Cards Columns",
        url: "/cards-columns",
    },
    {
        title: "Chat keyboard",
        url: "/chat-keyboard",
    },
    {
        title: "Movies FlashList",
        url: "/movies-flashlist",
    },
    {
        title: "Initial scroll index precise navigation",
        url: "/initial-scroll-index",
    },
    {
        title: "Initial scroll index(free element height)",
        url: "/initial-scroll-index-free-height",
    },
    {
        title: "Initial Scroll Index keyed",
        url: "/initial-scroll-index-keyed",
    },
    {
        title: "Mutable elements",
        url: "/mutable-cells",
    },
    {
        title: "Extra data",
        url: "/extra-data",
    },
    {
        title: "Countries List(FlashList)",
        url: "/countries-flashlist",
    },
    {
        title: "Filter elements",
        url: "/filter-elements",
    },
    {
        title: "Video feed",
        url: "/video-feed",
    },
    {
        title: "Countries Reorder",
        url: "/countries-reorder",
    },
    {
        title: "Cards FlashList",
        url: "/cards-flashlist",
    },
    {
        title: "Cards no recycle",
        url: "/cards-no-recycle",
    },
    {
        title: "Cards FlatList",
        url: "/cards-flatlist",
    },
].map(
    (v, i) =>
        ({
            ...v,
            id: i + 1,
        }) as ListElement,
);

const RightIcon = () => <ThemedText type="subtitle">›</ThemedText>;

const ListItem = ({ title, url, index }: ListElement) => {
    const theme = useColorScheme() ?? "light";

    return (
        <Link href={url} asChild>
            <Pressable>
                <ThemedView
                    style={[
                        styles.item,
                        { borderColor: theme === "light" ? "#ccc" : "#666" },
                        index === 0 && { borderTopWidth: 1 },
                    ]}
                >
                    <ThemedText>{title}</ThemedText>
                    <RightIcon />
                </ThemedView>
            </Pressable>
        </Link>
    );
};

const ListElements = () => {
    const height = useBottomTabBarHeight();
    const onLayout = useCallback((event: LayoutChangeEvent) => {
        console.log("onlayout", event.nativeEvent.layout);
    }, []);
    return (
        <SafeAreaView style={styles.container}>
            <LegendList
                estimatedItemSize={60}
                data={data}
                renderItem={({ item, index }) => <ListItem {...item} index={index} />}
                keyExtractor={(item) => item.id.toString()}
                onItemSizeChanged={(info) => {
                    console.log("item size changed", info);
                }}
                ListHeaderComponent={
                    <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                        <ThemedText style={{ fontWeight: "bold" }}>
                            {IsNewArchitecture ? "New" : "Old"} Architecture
                        </ThemedText>
                    </View>
                }
                ListFooterComponent={<View />}
                ListFooterComponentStyle={{ height: Platform.OS === "ios" ? height : 0 }}
                onLayout={onLayout}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    item: {
        padding: 16,
        height: 60,
        borderBottomWidth: 1,
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
    },
});

export default ListElements;
