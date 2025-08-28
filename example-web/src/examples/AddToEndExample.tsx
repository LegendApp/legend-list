import React from "react";

import { LegendList } from "@/components/LegendList";
import { Text } from "@/platform/Text";
import { View } from "@/platform/View";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function AddToEndExample() {
    const [data, setData] = React.useState(() => generateItems(50));
    const addMore = () => setData((d) => [...d, ...generateItems(20, d.length)]);
    return (
        <View style={{ display: "flex", flex: 1, flexDirection: "column", gap: 8, minHeight: 0 }}>
            <button onClick={addMore} type="button">
                Add 20 items
            </button>
            <LegendList<SimpleItem>
                data={data}
                estimatedItemSize={80}
                keyExtractor={(it) => it?.id}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <View style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: 12 }}>
                        <Text>Item {item.id}</Text>
                    </View>
                )}
                style={{ flex: 1, minHeight: 0 }}
            />
        </View>
    );
}
