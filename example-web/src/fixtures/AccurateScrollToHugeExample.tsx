import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

const Size = 100;

export default function AccurateScrollToHugeExample() {
    const ref = React.useRef<any>(null);
    const data = React.useMemo(() => generateItems(20000), []);
    return (
        <div className="flex min-h-0 flex-1 gap-2">
            <div className="flex gap-2">
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 12345 })} type="button">
                    Scroll to 12,345
                </button>
                <button onClick={() => ref.current?.scrollToEnd?.({ animated: true })} type="button">
                    Scroll to end
                </button>
            </div>
            <LegendList
                className="min-h-0 flex-1"
                data={data}
                estimatedItemSize={Size}
                keyExtractor={(it) => it?.id}
                recycleItems
                ref={ref}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <div className="border-b border-[#f0f0f0] bg-white p-2">
                        <div>Item {item.id}</div>
                    </div>
                )}
            />
        </div>
    );
}
