import React from "react";

import { LegendList } from "@legendapp/list/react";
import { generateItems } from "./utils";

export default function LazyListExample() {
    const data = React.useMemo(() => generateItems(120), []);
    const [selectedId, setSelectedId] = React.useState<string | undefined>();
    return (
        <div className="flex min-h-0 flex-1 rounded-lg border border-[#eee]">
            <LegendList className="min-h-0 flex-1" maintainVisibleContentPosition recycleItems>
                <div className="p-3">
                    <div className="font-bold">Countries lazy scrollview (demo data)</div>
                </div>
                {data.map((item, index) => (
                    <button
                        className="flex w-full items-center justify-between border-b border-[#f0f0f0] px-3 py-2.5 text-left"
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            background: selectedId === item.id ? "#eef6ff" : "#fff",
                        }}
                        type="button"
                    >
                        <div>Item {index}</div>
                        <div className="text-xs text-[#666]">id: {item.id}</div>
                    </button>
                ))}
            </LegendList>
        </div>
    );
}
