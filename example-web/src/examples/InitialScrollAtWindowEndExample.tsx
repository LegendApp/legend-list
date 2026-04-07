import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

type WindowMetrics = {
    documentHeight: number;
    scrollTop: number;
    windowBottom: number;
};

const copyVariants = [
    "Compact row.",
    "This row adds enough text to wrap and vary the measured height in the window-scrolling reproduction.",
    "Medium-length copy with a second sentence so the list contains mixed heights.",
    "Longer copy variant that spans multiple lines on desktop widths to make the list height less uniform and easier to visually inspect during initial positioning.",
];

export default function InitialScrollAtWindowEndExample() {
    const data = React.useMemo(() => generateItems(120), []);
    const [metrics, setMetrics] = React.useState<WindowMetrics>({
        documentHeight: 0,
        scrollTop: 0,
        windowBottom: 0,
    });

    const updateMetrics = React.useCallback(() => {
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY;
        const windowBottom = window.scrollY + window.innerHeight;

        setMetrics({
            documentHeight,
            scrollTop,
            windowBottom,
        });
    }, []);

    React.useEffect(() => {
        updateMetrics();

        window.addEventListener("scroll", updateMetrics, { passive: true });
        window.addEventListener("resize", updateMetrics);

        return () => {
            window.removeEventListener("scroll", updateMetrics);
            window.removeEventListener("resize", updateMetrics);
        };
    }, [updateMetrics]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 32 }}>
            <div
                style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 16,
                }}
            >
                <h4 style={{ margin: "0 0 8px" }}>Initial scroll at end vs window end</h4>
                <p style={{ color: "#334155", margin: 0 }}>
                    This reproduces the current behavior of <code>initialScrollAtEnd</code> with{" "}
                    <code>useWindowScroll</code>. The list starts at its last item, but not at the actual end of the
                    page when extra content exists below the list.
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
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                onLoad={updateMetrics}
                onScroll={updateMetrics}
                renderItem={({ index, item }: { index: number; item: SimpleItem }) => (
                    <div
                        style={{
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 10,
                            marginBottom: 8,
                            padding: "12px 14px",
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Row {index}</div>
                        <div style={{ color: "#475569", fontSize: 14 }}>
                            {copyVariants[index % copyVariants.length]}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>id: {item.id}</div>
                    </div>
                )}
                style={{ border: "1px solid #e2e8f0", borderRadius: 12 }}
                useWindowScroll
            />

            <div
                style={{
                    background: "linear-gradient(180deg, #fef3c7 0%, #fde68a 100%)",
                    border: "1px solid #f59e0b",
                    borderRadius: 12,
                    color: "#78350f",
                    padding: 20,
                }}
            >
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Content below the list</div>
                <p style={{ margin: 0 }}>
                    If the page had started at the true window end, this section would already be visible on first
                    paint. Instead, you can still scroll further down after <code>initialScrollAtEnd</code> runs.
                </p>
            </div>

            <div
                style={{
                    background: "#fff",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 12,
                    color: "#475569",
                    minHeight: 220,
                    padding: 20,
                }}
            >
                Additional footer space to make the missing window-end scroll position obvious.
            </div>

            <pre
                style={{
                    background: "rgba(0, 0, 0, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: 8,
                    bottom: 16,
                    color: "#a7f3d0",
                    fontSize: 12,
                    margin: 0,
                    maxWidth: 340,
                    padding: 12,
                    pointerEvents: "none",
                    position: "fixed",
                    right: 16,
                    zIndex: 1000,
                }}
            >
                {"Window metrics\n"}
                {JSON.stringify(
                    {
                        ...metrics,
                        remainingToWindowEnd: Math.max(0, metrics.documentHeight - metrics.windowBottom),
                    },
                    null,
                    2,
                )}
            </pre>
        </div>
    );
}
