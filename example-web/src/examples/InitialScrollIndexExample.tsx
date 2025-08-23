import React from "react";

import { LegendList } from "@/components/LegendList";
import { Text } from "@/platform/Text";
import { View } from "@/platform/View";

type Row = { id: string; type: "item" | "separator" };

export default function InitialScrollIndexExample() {
    const data = React.useMemo<Row[]>(
        () => Array.from({ length: 500 }, (_, i) => ({ id: String(i), type: "item" })),
        [],
    );
    return (
        <View style={{ background: "#456", display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
            <LegendList<Row>
                data={data}
                drawDistance={1000}
                estimatedItemSize={200}
                // getEstimatedItemSize={(i) => (data[i].type === "separator" ? 52 : 400)}
                initialScrollIndex={300}
                keyExtractor={(it) => it?.id}
                maintainVisibleContentPosition
                renderItem={({ item, index }: { item: Row; index: number }) =>
                    item.type === "separator" ? (
                        <View
                            style={{
                                alignItems: "center",
                                backgroundColor: "red",
                                height: 52,
                                justifyContent: "center",
                            }}
                        >
                            <Text style={{ color: "white" }}>Separator {item.id}</Text>
                        </View>
                    ) : (
                        <View
                            style={{
                                alignItems: "center",
                                background: index % 2 ? "#f0f0f0" : "#eaeaea",
                                height: 400,
                                justifyContent: "center",
                            }}
                        >
                            <Text>Item {item.id}</Text>
                        </View>
                    )
                }
                style={{ flex: 1, minHeight: 0, padding: 16 }}
            />
        </View>
    );
}
