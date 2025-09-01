import React from "react";

import { LegendList } from "@legendapp/list";

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
        <div
            style={{
                backgroundColor: index % 2 === 0 ? "#f0f0f0" : "#f8f8f8",
                borderRadius: 8,
                marginBottom: 8,
                minHeight: 80,
                padding: 16,
            }}
        >
            <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>{item.title}</div>
            <div style={{ color: "#666", fontSize: 14 }}>{item.description}</div>
        </div>
    );

    const keyExtractor = (item: (typeof data)[0]) => item?.id;

    return (
        <div
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
        </div>
    );
};

export default LegendListTest;
