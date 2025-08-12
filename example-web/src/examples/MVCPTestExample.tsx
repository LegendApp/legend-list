import React from "react";

import { LegendList } from "@/components/LegendList";

export default function MVCPTestExample() {
    const [heights, setHeights] = React.useState<Record<number, number>>({});
    const data = React.useMemo(() => Array.from({ length: 30 }, (_, i) => ({ id: String(i) })), []);

    const getHeight = (index: number) => heights[index] ?? 300;

    return (
        <div style={{ background: "#456", display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
            <LegendList
                data={data}
                estimatedItemSize={300}
                initialScrollIndex={10}
                keyExtractor={(it) => it?.id}
                recycleItems
                renderItem={({ index }: { index: number }) => {
                    const h = getHeight(index);
                    const bg = ["#f87171", "#34d399", "#facc15", "#a78bfa", "#60a5fa", "#fb923c", "#d1d5db"][index % 7];
                    return (
                        <button
                            onClick={() =>
                                setHeights((prev) => ({ ...prev, [index - 1]: (prev[index - 1] ?? 300) + 100 }))
                            }
                            style={{
                                alignItems: "center",
                                background: bg,
                                color: "white",
                                display: "flex",
                                height: h,
                                justifyContent: "center",
                                position: "relative",
                                width: "100%",
                            }}
                            type="button"
                        >
                            <div style={{ fontSize: 12, left: 10, position: "absolute", top: 8 }}>
                                item #{index} height: {h}
                            </div>
                            <span style={{ color: "white" }}>Change</span>
                        </button>
                    );
                }}
                style={{ flex: 1, minHeight: 0 }}
            />
        </div>
    );
}
