import React from "react";

import { LegendList } from "@legendapp/list";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function BidirectionalInfiniteListExample() {
    const [start, setStart] = React.useState(-50);
    const [end, setEnd] = React.useState(50);
    const data = React.useMemo(() => generateItems(end - start + 1, start), [start, end]);
    return (
        <LegendList
            data={data}
            estimatedItemSize={60}
            keyExtractor={(it) => it?.id}
            onEndReached={() => setEnd((e) => e + 50)}
            onEndReachedThreshold={0.2}
            onStartReached={() => setStart((s) => s - 50)}
            onStartReachedThreshold={0.2}
            renderItem={({ item }: { item: SimpleItem }) => (
                <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: 12 }}>
                    <div>Item {item.id}</div>
                </div>
            )}
            style={{ flex: 1, minHeight: 0 }}
        />
    );
}
