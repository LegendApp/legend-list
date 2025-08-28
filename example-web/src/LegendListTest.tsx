import React from "react";

import { LegendList } from "@/components/LegendList";
import { Text } from "@/platform/Text";
import { View } from "@/platform/View";

const generateData = (count: number) => {
    return Array.from({ length: count }, (_, index) => ({
        description: `This is the description for item ${index + 1}. It has some text to make it variable height. ${
            index % 3 === 0
                ? "This item has extra content to demonstrate variable heights in the virtualized list."
                : ""
        }`,
        height: Math.floor(Math.random() * 100) + 50, // Random height between 50-150
        id: `item-${index}`,
        title: `Item ${index + 1}`,
    }));
};

const LegendListTest: React.FC = () => {
    const data = React.useMemo(() => generateData(1000), []); // More items to show virtualization

    const renderItem = ({ item, index }: { item: (typeof data)[0]; index: number }) => (
        <View
            style={{
                backgroundColor: index % 2 === 0 ? "#f0f0f0" : "#f8f8f8",
                borderRadius: 8,
                marginBottom: 8,
                minHeight: 80,
                padding: 16,
            }}
        >
            <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>{item.title}</Text>
            <Text style={{ color: "#666", fontSize: 14 }}>{item.description}</Text>
        </View>
    );

    const keyExtractor = (item: (typeof data)[0]) => item?.id;

    return (
        <View
            style={{
                border: "1px solid #ccc",
                display: "flex",
                flexDirection: "column",
                height: 400,
                width: "100%",
            }}
        >
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={keyExtractor}
                recycleItems={true}
                renderItem={renderItem}
                style={{
                    flex: 1,
                    minHeight: 0,
                }}
            />
        </View>
    );
};

export default LegendListTest;
