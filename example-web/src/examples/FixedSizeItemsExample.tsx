import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

const ITEM_HEIGHT = 74;

export default function FixedSizeItemsExample() {
    const data = React.useMemo(() => generateItems(150), []);

    return (
        <LegendList<SimpleItem>
            className="min-h-0 flex-1"
            data={data}
            estimatedItemSize={ITEM_HEIGHT}
            getFixedItemSize={() => ITEM_HEIGHT}
            keyExtractor={(item) => item?.id}
            recycleItems
            renderItem={({ item, index }: { item: SimpleItem; index: number }) => (
                <div
                    className="box-border flex items-center gap-3 border-b border-[#ececec] px-4"
                    style={{
                        background: index % 2 === 0 ? "#ffffff" : "#f7f7f8",
                        height: ITEM_HEIGHT,
                    }}
                >
                    <div className="font-semibold">Row {index + 1}</div>
                    <div className="text-xs text-[#666]">id: {item.id}</div>
                </div>
            )}
        />
    );
}
