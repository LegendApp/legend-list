import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

const MIN_COLUMNS = 1;
const MAX_COLUMNS = 6;

export default function ColumnsExample() {
    const [data, setData] = React.useState(generateItems(8));
    const [numColumns, setNumColumns] = React.useState(3);

    React.useEffect(() => {
        const t = setTimeout(() => setData(generateItems(20)), 1000);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="flex items-center justify-center gap-3 p-4">
                <button
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gray-900 text-[20px] font-bold text-white disabled:opacity-40"
                    disabled={numColumns <= MIN_COLUMNS}
                    onClick={() => setNumColumns((value) => Math.max(MIN_COLUMNS, value - 1))}
                    type="button"
                >
                    -
                </button>
                <div className="min-w-[88px] text-center text-[14px] font-bold text-gray-900">{numColumns} columns</div>
                <button
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gray-900 text-[20px] font-bold text-white disabled:opacity-40"
                    disabled={numColumns >= MAX_COLUMNS}
                    onClick={() => setNumColumns((value) => Math.min(MAX_COLUMNS, value + 1))}
                    type="button"
                >
                    +
                </button>
            </div>
            <LegendList
                className="min-h-0 flex-1"
                columnWrapperStyle={{ columnGap: 16, rowGap: 16 }}
                data={data}
                keyExtractor={(it) => it?.id}
                numColumns={numColumns}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <div className="aspect-square">
                        <div className="h-full w-full rounded-lg bg-red-500" />
                        <div>Item {item.id}</div>
                    </div>
                )}
            />
        </div>
    );
}
