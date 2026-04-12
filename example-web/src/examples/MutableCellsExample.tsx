import React from "react";

import { LegendList } from "@legendapp/list/react";

type SimpleItem = { id: string };

export default function MutableCellsExample() {
    const [data] = React.useState<SimpleItem[]>(() => Array.from({ length: 60 }, (_, i) => ({ id: String(i) })));
    const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
    return (
        <LegendList<SimpleItem>
            className="min-h-0 flex-1"
            data={data}
            estimatedItemSize={100}
            keyExtractor={(it) => it?.id}
            renderItem={({ item }: { item: SimpleItem }) => {
                const isOpen = !!expanded[item.id];
                return (
                    <div className="border-b border-[#f0f0f0] p-3">
                        <div className="flex items-center justify-between">
                            <div>Item {item.id}</div>
                            <button
                                onClick={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
                                type="button"
                            >
                                {isOpen ? "Collapse" : "Expand"}
                            </button>
                        </div>
                        {isOpen && (
                            <div className="mt-2 rounded-md bg-[#fafafa] p-2">
                                <div>
                                    Extra content for item {item.id}. Click the button to toggle height and test
                                    measurement updates.
                                </div>
                            </div>
                        )}
                    </div>
                );
            }}
        />
    );
}
