import React from "react";

import { LegendList } from "@/components/LegendList";
import { Text } from "@/platform/Text";
import { View } from "@/platform/View";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function ColumnsExample() {
    const [data, setData] = React.useState(generateItems(8));
    React.useEffect(() => {
        const t = setTimeout(() => setData(generateItems(20)), 1000);
        return () => clearTimeout(t);
    }, []);
    return (
        <View style={{ background: "#fff", display: "flex", flex: 1, minHeight: 0 }}>
            <LegendList
                columnWrapperStyle={{ columnGap: 16, rowGap: 16 }}
                data={data}
                keyExtractor={(it) => it?.id}
                numColumns={3}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <View style={{ aspectRatio: 1 }}>
                        <View style={{ backgroundColor: "red", borderRadius: 8, height: "100%", width: "100%" }} />
                        <Text>Item {item.id}</Text>
                    </View>
                )}
                style={{ flex: 1, minHeight: 0 }}
            />
        </View>
    );
}
