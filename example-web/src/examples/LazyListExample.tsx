import React from "react";

import { LazyLegendList } from "@/components/LazyLegendList";
import { Text } from "@/platform/Text";
import { View } from "@/platform/View";
import { generateItems } from "./utils";

export default function LazyListExample() {
    const data = React.useMemo(() => generateItems(120), []);
    const [selectedId, setSelectedId] = React.useState<string | undefined>();
    return (
        <View style={{ border: "1px solid #eee", borderRadius: 8, display: "flex", flex: 1, minHeight: 0 }}>
            <LazyLegendList maintainVisibleContentPosition recycleItems style={{ flex: 1, minHeight: 0 }}>
                <View style={{ padding: 12 }}>
                    <Text style={{ fontWeight: "bold" }}>Countries lazy scrollview (demo data)</Text>
                </View>
                {data.map((item, index) => (
                    <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            alignItems: "center",
                            background: selectedId === item.id ? "#eef6ff" : "#fff",
                            borderBottom: "1px solid #f0f0f0",
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            textAlign: "left",
                            width: "100%",
                        }}
                        type="button"
                    >
                        <Text>Item {index}</Text>
                        <Text style={{ color: "#666", fontSize: 12 }}>id: {item.id}</Text>
                    </button>
                ))}
            </LazyLegendList>
        </View>
    );
}
