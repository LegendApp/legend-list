import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function ExtraDataExample() {
    const [selectedId, setSelectedId] = React.useState<string | undefined>();
    const data = React.useMemo(() => generateItems(100), []);
    return (
        <LegendList<SimpleItem>
            className="min-h-0 flex-1"
            data={data}
            estimatedItemSize={60}
            extraData={selectedId}
            keyExtractor={(it) => it?.id}
            renderItem={({ item }: { item: SimpleItem }) => (
                <button
                    className="w-full border-b border-[#f0f0f0] p-3 text-left"
                    onClick={() => setSelectedId(item.id)}
                    style={{
                        background: item.id === selectedId ? "#eef6ff" : undefined,
                    }}
                    type="button"
                >
                    <div>Item {item.id}</div>
                </button>
            )}
        />
    );
}
