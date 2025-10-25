import React from "react";

import { LegendList } from "@legendapp/list";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

const Size = 100;

export default function AccurateScrollToHugeExample() {
    const ref = React.useRef<any>(null);
    const data = React.useMemo(() => generateItems(20000), []);
    return (
        <div style={{ display: "flex", flex: 1, gap: 8, minHeight: 0 }}>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 12345 })} type="button">
                    Scroll to 12,345
                </button>
                <button onClick={() => ref.current?.scrollToEnd?.({ animated: true })} type="button">
                    Scroll to end
                </button>
            </div>
            <LegendList
                data={data}
                estimatedItemSize={Size}
                keyExtractor={(it) => it?.id}
                recycleItems
                ref={ref}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                        <div>Item {item.id}</div>
                    </div>
                )}
                style={{ flex: 1, minHeight: 0 }}
            />
        </div>
    );
}
