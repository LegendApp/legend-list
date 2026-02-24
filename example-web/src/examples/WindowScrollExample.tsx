import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function WindowScrollExample() {
    const data = React.useMemo(() => generateItems(220), []);
    const [selectedId, setSelectedId] = React.useState<string | undefined>();
    const copyVariants = React.useMemo(
        () => [
            "Compact row.",
            "This row is intentionally longer and includes enough words to wrap on most desktop resolutions. It helps demonstrate how virtualization handles mixed measured heights while the window drives scroll.",
            "Medium-length example text with a second sentence so item height differs from compact rows.",
            "Very long row copy: when this row renders, it should span multiple lines even on large monitors because the sentence keeps going with descriptive details about window scrolling, list measurement, and stable positioning during rapid wheel movement.",
            "Another short row.",
            "Long variant with punctuation and structure. First, it adds detail. Second, it continues with additional context about list behavior under dynamic content. Third, it closes with one more sentence to force a clearly taller cell.",
        ],
        [],
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40 }}>
            <div
                style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 16,
                }}
            >
                <h4 style={{ margin: "0 0 8px" }}>Window Scroll Example</h4>
                <p style={{ color: "#334155", margin: 0 }}>
                    This list uses <code>useWindowScroll</code>, so the page scrollbar drives the list instead of an
                    internal scroll container.
                </p>
            </div>

            <div
                style={{
                    alignItems: "center",
                    background: "linear-gradient(180deg, #dbeafe 0%, #eff6ff 100%)",
                    border: "1px solid #bfdbfe",
                    borderRadius: 12,
                    color: "#1e3a8a",
                    display: "flex",
                    fontWeight: 600,
                    height: 220,
                    justifyContent: "center",
                }}
            >
                Content above the list
            </div>

            <LegendList<SimpleItem>
                contentContainerStyle={{ padding: 8 }}
                data={data}
                estimatedItemSize={82}
                keyExtractor={(item) => item.id}
                renderItem={({ index, item }: { index: number; item: SimpleItem }) => (
                    <button
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            background: selectedId === item.id ? "#eff6ff" : "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 10,
                            cursor: "pointer",
                            display: "block",
                            marginBottom: 8,
                            padding: "12px 14px",
                            textAlign: "left",
                            width: "100%",
                        }}
                        type="button"
                    >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Row {index}</div>
                        <div style={{ color: "#475569", fontSize: 14 }}>
                            {copyVariants[index % copyVariants.length]}
                        </div>
                    </button>
                )}
                style={{ border: "1px solid #e2e8f0", borderRadius: 12 }}
                useWindowScroll
            />

            <div
                style={{
                    alignItems: "center",
                    background: "#fef9c3",
                    border: "1px solid #fde68a",
                    borderRadius: 12,
                    color: "#854d0e",
                    display: "flex",
                    fontWeight: 600,
                    height: 220,
                    justifyContent: "center",
                }}
            >
                Content below the list
            </div>
        </div>
    );
}
