import React from "react";

import { LegendList } from "@legendapp/list/react";

export default function MVCPTestExample() {
    const [heights, setHeights] = React.useState<Record<number, number>>({});
    const data = React.useMemo(() => Array.from({ length: 30 }, (_, i) => ({ id: String(i) })), []);

    const getHeight = (index: number) => heights[index] ?? 300;

    return (
        <div className="relative flex min-h-0 flex-1 bg-[#456]">
            <LegendList
                className="min-h-0 flex-1"
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
                            className="relative flex w-full items-center justify-center text-white"
                            onClick={() =>
                                setHeights((prev) => ({ ...prev, [index - 1]: (prev[index - 1] ?? 300) + 100 }))
                            }
                            style={{
                                background: bg,
                                height: h,
                            }}
                            type="button"
                        >
                            <div className="absolute left-2.5 top-2 text-xs">
                                item #{index} height: {h}
                            </div>
                            <span className="text-white">Change</span>
                        </button>
                    );
                }}
            />
        </div>
    );
}
