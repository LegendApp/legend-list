import React from "react";

import { LegendList } from "@legendapp/list/react";

export default function MVCPTestExample() {
    const [heights, setHeights] = React.useState<Record<number, number>>({});
    const [first, setFirst] = React.useState(0);
    const data = React.useMemo(() => Array.from({ length: 30 - first }, (_, i) => ({ id: i + first })), [first]);

    const getHeight = (index: number) => heights[index] ?? 300;

    return (
        <div className="relative flex min-h-0 flex-1 flex-col bg-[#456]">
            <button onClick={() => setFirst((value) => value - 1)} type="button">
                Prepend row
            </button>
            <LegendList
                className="mvcp-test-list min-h-0 flex-1"
                data={data}
                estimatedItemSize={300}
                initialScrollIndex={10}
                keyExtractor={(it) => String(it.id)}
                maintainVisibleContentPosition={{ autoscrollToTopThreshold: 50, data: true }}
                recycleItems
                renderItem={({ item: { id } }) => {
                    const h = getHeight(id);
                    const bg = ["#f87171", "#34d399", "#facc15", "#a78bfa", "#60a5fa", "#fb923c", "#d1d5db"][
                        Math.abs(id) % 7
                    ];
                    return (
                        <button
                            className="relative flex w-full items-center justify-center text-white"
                            onClick={() => setHeights((prev) => ({ ...prev, [id - 1]: (prev[id - 1] ?? 300) + 100 }))}
                            style={{
                                background: bg,
                                height: h,
                            }}
                            type="button"
                        >
                            <div className="absolute left-2.5 top-2 text-xs">
                                item #{id} height: {h}
                            </div>
                            <span className="text-white">Change</span>
                        </button>
                    );
                }}
            />
        </div>
    );
}
