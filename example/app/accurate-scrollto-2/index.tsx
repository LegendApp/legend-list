import { useEffect, useRef } from "react";
import { Text, View } from "react-native";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list";

const App = () => {
    const dummyData = Array.from({ length: 100 }, (_, index) => ({
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString(),
        height: Math.floor(Math.random() * 200) + 50, // Random height between 50 and 250
        id: index,
        isActive: Math.random() > 0.5,
        name: `Item ${index}`,
        value: Math.floor(Math.random() * 1000),
    }));
    const renderItem = (props: LegendListRenderItemProps<any>) => {
        return (
            <View
                style={{
                    backgroundColor: "#fff",
                    borderColor: "#ddd",
                    borderRadius: 12,
                    borderWidth: 1,
                    height: props.item.height,
                    padding: 10,
                }}
            >
                <Text style={{ fontWeight: "bold" }}>{props.item.name}</Text>
            </View>
        );
    };
    const listRef = useRef<LegendListRef>(null);
    useEffect(() => {
        setTimeout(() => {
            listRef.current?.scrollToIndex({
                animated: true,
                index: 80,
            });
        }, 1000);
    }, []);
    return (
        <View style={{ backgroundColor: "gray", flex: 1, padding: 20 }}>
            <LegendList
                data={dummyData}
                estimatedItemSize={25}
                keyExtractor={(item) => `id${item.id}`}
                maintainVisibleContentPosition
                recycleItems
                ref={listRef}
                renderItem={renderItem}
            />
        </View>
    );
};
export default App;
