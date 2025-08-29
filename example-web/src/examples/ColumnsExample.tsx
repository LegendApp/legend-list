import React from "react";

import { LegendList } from "@/components/LegendList";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function ColumnsExample() {
    const [data, setData] = React.useState(generateItems(8));
    React.useEffect(() => {
        const t = setTimeout(() => setData(generateItems(20)), 1000);
        return () => clearTimeout(t);
    }, []);
    return (
        <div style={{ background: "#fff", display: "flex", flex: 1, minHeight: 0 }}>
            <LegendList
                columnWrapperStyle={{ columnGap: 16, rowGap: 16 }}
                data={data}
                keyExtractor={(it) => it?.id}
                numColumns={3}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <div style={{ aspectRatio: 1 }}>
                        <div style={{ backgroundColor: "red", borderRadius: 8, height: "100%", width: "100%" }} />
                        <div>Item {item.id}</div>
                    </div>
                )}
                style={{ flex: 1, minHeight: 0 }}
            />
        </div>
    );
}
