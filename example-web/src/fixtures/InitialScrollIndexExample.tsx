import React from "react";

import { LegendList } from "@legendapp/list/react";
import { random } from "../random";

type Row = { id: string; type: "item" | "separator" };

const heights = new Map<string, number>();

const seed = 9;
const getHeight = (id: string) => {
    if (heights.has(id)) {
        return heights.get(id)!;
    }
    const height = Math.floor(random(seed) * 100) + 50;
    heights.set(id, height);
    return height;
};
export default function InitialScrollIndexExample() {
    const data = React.useMemo<Row[]>(
        () => Array.from({ length: 500 }, (_, i) => ({ id: String(i), type: i % 3 === 0 ? "separator" : "item" })),
        [],
    );
    return (
        <div className="relative flex min-h-0 flex-1 bg-[#456]">
            <LegendList<Row>
                className="min-h-0 flex-1"
                data={data}
                drawDistance={2000}
                // getEstimatedItemSize={(item) => (item.type === "separator" ? 52 : 400)}
                estimatedItemSize={200}
                initialScrollIndex={200}
                keyExtractor={(it) => it?.id}
                recycleItems
                renderItem={({ item, index }: { item: Row; index: number }) =>
                    item.type === "separator" ? (
                        <div className="flex h-[52px] items-center justify-center bg-black">
                            <div className="text-white">Separator {item.id}</div>
                        </div>
                    ) : (
                        <div
                            className="flex items-center justify-center"
                            style={{
                                background: index % 2 ? "#f0f0f0" : "#ccc",
                                height: getHeight(item.id),
                            }}
                        >
                            <div>Item {item.id}</div>
                        </div>
                    )
                }
            />
        </div>
    );
}
