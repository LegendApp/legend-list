import { ThemedText } from "@/components/ThemedText";
import { LegendList } from "@legendapp/list";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Link, type LinkProps } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ListElement = {
    id: number;
    title: string;
    url: LinkProps["href"];
};

const data: ListElement[] = [
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
    }
    // Add more items as needed
].map(
    (v, i) =>
        ({
            ...v,
            id: i + 1,
        }) as ListElement,
);

const RightIcon = () => <ThemedText type="subtitle">›</ThemedText>;

const ListItem = ({ title, url }: ListElement) => (
    <Link href={url} asChild>
        <Pressable>
            <View style={styles.item}>
                <ThemedText>{title}</ThemedText>
                <RightIcon />
            </View>
        </Pressable>
    </Link>
);

const ListElements = () => {
    const height = useBottomTabBarHeight();
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
        borderBottomColor: "#ccc",
        borderBottomWidth: 1,
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
    },
});

export default ListElements;
