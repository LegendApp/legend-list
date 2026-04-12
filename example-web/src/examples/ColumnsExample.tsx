import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function ColumnsExample() {
    const [data, setData] = React.useState(generateItems(8));
    React.useEffect(() => {
        const t = setTimeout(() => setData(generateItems(20)), 1000);
        return () => clearTimeout(t);
    }, []);
    return (
        <div className="flex min-h-0 flex-1 bg-white">
            <LegendList
                className="min-h-0 flex-1"
                columnWrapperStyle={{ columnGap: 16, rowGap: 16 }}
                data={data}
                keyExtractor={(it) => it?.id}
                numColumns={3}
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
