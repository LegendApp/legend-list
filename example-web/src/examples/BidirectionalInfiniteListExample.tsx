import React from "react";

import { LegendList } from "@legendapp/list";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

// A random number generator to simulate the size of the items
// that we can seed with a consistent value between runs
function mulberry32(seed: number) {
    return () => {
        // biome-ignore lint/suspicious/noAssignInExpressions: This is the algorithm
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const sizeCache = new Map<string, number>();
const getSizeForId = (id: string) => {
    if (sizeCache.get(id) !== undefined) {
        return sizeCache.get(id);
    }
    const size = getRand() * 300 + 40;
    sizeCache.set(id, size);
    return size;
};

const getRand = mulberry32(0);

export default function BidirectionalInfiniteListExample() {
    const [start, setStart] = React.useState(-50);
    const [end, setEnd] = React.useState(50);
    const data = React.useMemo(() => generateItems(end - start + 1, start), [start, end]);

    return (
        <LegendList
            data={data}
            estimatedItemSize={30}
            initialScrollIndex={data.length - 1}
            keyExtractor={(it) => it?.id}
            // onEndReached={() => setEnd((e) => e + 50)}
            // onEndReachedThreshold={0.2}
            onStartReached={() => {
                setStart((s) => s - 50);
                console.log("onStartReached");
            }}
            onStartReachedThreshold={0.5}
            renderItem={({ item }: { item: SimpleItem }) => (
                <div
                    style={{
                        background: "#fff",
                        borderBottom: "1px solid #ddd",
                        height: getSizeForId(item.id),
                        padding: 12,
                    }}
                >
                    <div>Item {item.id}</div>
                </div>
            )}
            style={{ flex: 1, minHeight: 0 }}
        />
    );
}
