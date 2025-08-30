import React from "react";

import { LegendList } from "@/components/LegendList";
import { generateItems } from "./utils";

export default function LazyListExample() {
    const data = React.useMemo(() => generateItems(500), []);
    const [selectedId, setSelectedId] = React.useState<string | undefined>();
    return (
        <div style={{ border: "1px solid #eee", borderRadius: 8, display: "flex", flex: 1, minHeight: 0 }}>
            <LegendList maintainVisibleContentPosition recycleItems style={{ flex: 1, minHeight: 0 }}>
                <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: "bold" }}>Countries lazy scrollview (demo data)</div>
                </div>
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
                        <div>Item {index}</div>
                        <div style={{ color: "#666", fontSize: 12 }}>id: {item.id}</div>
                    </button>
                ))}
            </LegendList>
        </div>
    );
}
