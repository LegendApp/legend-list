import Constants from "expo-constants";
import { Link, type LinkProps } from "expo-router";
import { useCallback } from "react";
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list/react-native";
import { ThemedText } from "~/components/ThemedText";
import { ThemedView } from "~/components/ThemedView";

// @ts-expect-error nativeFabricUIManager is not defined in the global object types
export const IsNewArchitecture = Platform.OS === "web" || global.nativeFabricUIManager != null;
const appExtra = (Constants.expoConfig?.extra ?? {}) as {
    expoVersion?: string;
    legendListVersion?: string;
};
const legendListVersion = typeof appExtra.legendListVersion === "string" ? appExtra.legendListVersion : "unknown";
const expoVersion = typeof appExtra.expoVersion === "string" ? appExtra.expoVersion : "unknown";

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
        title: "AI Chat",
        url: "/ai-chat",
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
        title: "Countries with headers",
        url: "/countries-with-headers",
    },
    {
        title: "Countries with headers fixed",
        url: "/countries-with-headers-fixed",
    },
    {
        title: "Countries with headers sticky",
        url: "/countries-with-headers-sticky",
    },
    {
        title: "Lazy List",
        url: "/lazy-list",
    },
    {
        title: "Always render",
        url: "/always-render",
    },
    {
        title: "MVCP test",
        url: "/mvcp-test",
    },
    {
        title: "Reanimated Layout",
        url: "/layout-animation",
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
        title: "Product shelf",
        url: "/product-shelf",
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
        title: "Initial scroll index",
        url: "/initial-scroll-index",
    },
    {
        title: "Initial scroll index (free element height)",
        url: "/initial-scroll-index-free-height",
    },
    {
        title: "Initial scroll index (start at the end)",
        url: "/initial-scroll-start-at-the-end",
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
    {
        title: "Add to the end",
        url: "/add-to-end",
    },
    {
        title: "Chat resize outer",
        url: "/chat-resize-outer",
    },
    {
        title: "Accurate scrollToHuge",
        url: "/accurate-scrollto-huge",
    },
    {
        title: "Chat keyboard big",
        url: "/chat-keyboard-big",
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
        <Link asChild href={url}>
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
    const insets = useSafeAreaInsets();
    const height = Platform.OS === "ios" ? 49 + insets.bottom : 0;
    const onLayout = useCallback((event: LayoutChangeEvent) => {
        console.log("onlayout", event.nativeEvent.layout);
    }, []);
    return (
        <SafeAreaView style={styles.container}>
            <LegendList
                data={data}
                estimatedItemSize={60}
                keyExtractor={(item) => item.id.toString()}
                ListFooterComponent={<View />}
                ListFooterComponentStyle={{ height: Platform.OS === "ios" ? height : 0 }}
                ListHeaderComponent={
                    <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                        <ThemedText style={{ fontWeight: "bold" }}>
                            {__DEV__ ? "DEV" : "PROD"}, LL {legendListVersion}, Expo {expoVersion}
                        </ThemedText>
                    </View>
                }
                onItemSizeChanged={(info) => {
                    console.log("item size changed", info);
                }}
                onLayout={onLayout}
                renderItem={({ item, index }) => <ListItem {...item} index={index} />}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    item: {
        borderBottomWidth: 1,
        flexDirection: "row",
        height: 60,
        justifyContent: "space-between",
        padding: 16,
        width: "100%",
    },
});

export default ListElements;
