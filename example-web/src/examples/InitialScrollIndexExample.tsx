import React from "react";

import { LegendList } from "@legendapp/list";

type Row = { id: string; type: "item" | "separator" };

export default function InitialScrollIndexExample() {
    const data = React.useMemo<Row[]>(
        () => Array.from({ length: 500 }, (_, i) => ({ id: String(i), type: i % 3 === 0 ? "separator" : "item" })),
        [],
    );
    return (
        <div style={{ background: "#456", display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
            <LegendList<Row>
                data={data}
                drawDistance={2000}
                estimatedItemSize={200}
                // getEstimatedItemSize={(i) => (data[i].type === "separator" ? 52 : 400)}
                initialScrollIndex={200}
                keyExtractor={(it) => it?.id}
                renderItem={({ item, index }: { item: Row; index: number }) =>
                    item.type === "separator" ? (
                        <div
                            style={{
                                alignItems: "center",
                                backgroundColor: "black",
                                height: 52,
                                justifyContent: "center",
                            }}
                        >
                            <div style={{ color: "white" }}>Separator {item.id}</div>
                        </div>
                    ) : (
                        <div
                            style={{
                                alignItems: "center",
                                background: index % 2 ? "#f0f0f0" : "#ccc",
                                height: 200 + Math.random() * 200,
                                justifyContent: "center",
                            }}
                        >
                            <div>Item {item.id}</div>
                        </div>
                    )
                }
                style={{ flex: 1, minHeight: 0, padding: 16 }}
            />
        </div>
    );
}
