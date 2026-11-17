import React from "react";

import { LegendList } from "@legendapp/list/react";

type Row = { id: string };

// An ancestor CSS transform scales what getBoundingClientRect reports, but not the layout box.
export default function ScaledContainerExample() {
    const [data] = React.useState<Row[]>(() => Array.from({ length: 200 }, (_, i) => ({ id: String(i) })));
    const scale = new URLSearchParams(window.location.search).get("scale") ?? "0.5";
    return (
        <div style={{ height: 600, transform: `scale(${scale})`, transformOrigin: "top left", width: 400 }}>
            <LegendList<Row>
                data={data}
                estimatedItemSize={80}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <div
                        data-row={item.id}
                        style={{ borderBottom: "1px solid #ddd", boxSizing: "border-box", height: 50 }}
                    >
                        Row {item.id}
                    </div>
                )}
                style={{ height: 600 }}
            />
        </div>
    );
}
