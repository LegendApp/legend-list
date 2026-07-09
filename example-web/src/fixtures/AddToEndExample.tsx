import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function AddToEndExample() {
    const [data, setData] = React.useState(() => generateItems(50));
    const addMore = () => setData((d) => [...d, ...generateItems(20, d.length)]);
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
            <button onClick={addMore} type="button">
                Add 20 items
            </button>
            <LegendList<SimpleItem>
                className="min-h-0 flex-1"
                data={data}
                estimatedItemSize={80}
                keyExtractor={(it) => it?.id}
                recycleItems
                renderItem={({ item }: { item: SimpleItem }) => (
                    <div className="border-b border-[#f0f0f0] bg-white p-3">
                        <div>Item {item.id}</div>
                    </div>
                )}
            />
        </div>
    );
}
