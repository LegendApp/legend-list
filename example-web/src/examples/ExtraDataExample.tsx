import React from "react";

import { LegendList } from "@legendapp/list";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function ExtraDataExample() {
    const [selectedId, setSelectedId] = React.useState<string | undefined>();
    const data = React.useMemo(() => generateItems(100), []);
    return (
        <LegendList<SimpleItem>
            data={data}
            estimatedItemSize={60}
            extraData={selectedId}
            keyExtractor={(it) => it?.id}
            renderItem={({ item }: { item: SimpleItem }) => (
                <button
                    onClick={() => setSelectedId(item.id)}
                    style={{
                        background: item.id === selectedId ? "#eef6ff" : undefined,
                        borderBottom: "1px solid #f0f0f0",
                        padding: 12,
                        textAlign: "left",
                        width: "100%",
                    }}
                    type="button"
                >
                    <div>Item {item.id}</div>
                </button>
            )}
            style={{ flex: 1, minHeight: 0 }}
        />
    );
}
