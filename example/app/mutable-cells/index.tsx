import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";

const fakeData = Array.from({ length: 100 }, (_, index) => ({
    id: index,
    score: 0,
    title: `Item ${index + 1}`,
}));

type Item = (typeof fakeData)[number];

const DataContext = createContext({
    data: fakeData,
    increment: (_id: number) => {},
});

export const DataProvider = ({ initialData, children }: { initialData: Item[]; children: React.ReactNode }) => {
    const [data, setData] = useState(initialData);

    const increment = useCallback((id: number) => {
        setData((prevData) => {
            return prevData.map((item) => {
                if (item.id === id) {
                    return { ...item, score: item.score + 1 };
                }
                return item;
            });
        });
    }, []);

    return <DataContext.Provider value={{ data, increment }}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);

const Item = ({ item }: { item: Item }) => {
    const { increment } = useData();
    return (
        <View
            style={{
                backgroundColor: "#fefefe",
                borderRadius: 16,
                height: 100,
                justifyContent: "center",
                paddingHorizontal: 24,
            }}
        >
            <Text style={{ fontSize: 24, fontWeight: "bold" }}>{`${item.title} - Score:${item.score}`}</Text>
            <Button
                onPress={() => {
                    increment(item.id);
                }}
                title="Increment"
            />
        </View>
    );
};

const ItemSeparatorComponent = () => <View style={{ height: 16 }} />;

export const List = () => {
    const { data } = useData();
    const renderItem = ({ item }: LegendListRenderItemProps<Item>) => <Item item={item} />;
    return (
        <View style={{ flex: 1, marginTop: 70, paddingHorizontal: 16 }}>
            <LegendList
                data={data}
                estimatedItemSize={116}
                ItemSeparatorComponent={ItemSeparatorComponent}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
            />
        </View>
    );
};

export default function HomeScreen() {
    return (
        <DataProvider initialData={fakeData}>
            <List />
        </DataProvider>
    );
}

const _styles = StyleSheet.create({
    reactLogo: {
        bottom: 0,
        height: 178,
        left: 0,
        position: "absolute",
        width: 290,
    },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
    titleContainer: {
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
    },
});
