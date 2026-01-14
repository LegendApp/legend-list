import React from "react";

import { LegendList } from "@legendapp/list";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

const ITEM_HEIGHT = 74;

export default function FixedSizeItemsExample() {
    const data = React.useMemo(() => generateItems(150), []);

    return (
        <LegendList<SimpleItem>
            data={data}
            estimatedItemSize={ITEM_HEIGHT}
            getFixedItemSize={() => ITEM_HEIGHT}
            keyExtractor={(item) => item?.id}
            renderItem={({ item, index }: { item: SimpleItem; index: number }) => (
                <div
                    style={{
                        alignItems: "center",
                        background: index % 2 === 0 ? "#ffffff" : "#f7f7f8",
                        borderBottom: "1px solid #ececec",
                        boxSizing: "border-box",
                        display: "flex",
                        gap: 12,
                        height: ITEM_HEIGHT,
                        padding: "0 16px",
                    }}
                >
                    <div style={{ fontWeight: 600 }}>Row {index + 1}</div>
                    <div style={{ color: "#666", fontSize: 12 }}>id: {item.id}</div>
                </div>
            )}
            style={{ flex: 1, minHeight: 0 }}
        />
    );
}
