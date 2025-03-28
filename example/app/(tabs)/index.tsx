import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LegendList } from "@legendapp/list";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Link, type LinkProps } from "expo-router";
import { useCallback } from "react";
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ListElement = {
    id: number;
    title: string;
    url: LinkProps["href"];
};

const data: ListElement[] = [
    {
        title: "Video feed",
        url: "/video-feed",
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
        title: "Chat example",
        url: "/chat-example",
    },
    {
        title: "Cards FlatList",
        url: "/cards-flatlist",
    },
    {
        title: "Cards FlashList",
        url: "/cards-flashlist",
    },
    {
        title: "Cards Columns",
        url: "/cards-columns",
    },
    {
        title: "Movies FlashList",
        url: "/movies-flashlist",
    },
    {
        title: "Bidirectional Infinite List",
        url: "/bidirectional-infinite-list",
    },
    {
        title: "🚧🚧🚧Infinite chat🚧🚧🚧",
        url: "/chat-infinite",
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
        title: "Countries List",
        url: "/countries",
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
        title: "Accurate scrollToIndex",
        url: "/accurate-scrollto",
    },
    {
        title: "Columns",
        url: "/columns",
    },
    // Add more items as needed
].map(
    (v, i) =>
        ({
            ...v,
            id: i + 1,
        }) as ListElement,
);

const RightIcon = () => <ThemedText type="subtitle">›</ThemedText>;

const ListItem = ({ title, url }: ListElement) => {
    const theme = useColorScheme() ?? "light";

    return (
        <Link href={url} asChild>
            <Pressable>
                <ThemedView style={[styles.item, { borderBottomColor: theme === "light" ? "#ccc" : "#666" }]}>
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
                renderItem={({ item }) => <ListItem {...item} />}
                keyExtractor={(item) => item.id.toString()}
                onItemSizeChanged={(info) => {
                    console.log("item size changed", info);
                }}
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
