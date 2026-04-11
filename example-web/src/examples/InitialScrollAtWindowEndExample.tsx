import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

type Mode = "end" | "window-end";

const COPY_VARIANTS = [
    "Compact row.",
    "This row adds enough text to wrap and vary the measured height in the window-scroll initial-positioning demo.",
    "Medium-length copy with a second sentence so the list contains mixed measured heights.",
    "Longer copy variant that spans multiple lines on desktop widths to make the end-alignment differences easier to inspect when the page first loads.",
];

const MODE_META: Record<Mode, { description: string; label: string; query: string }> = {
    end: {
        description:
            "Uses initialScrollAtEnd. The list aligns its last row to the viewport end, but the page can still continue below the list.",
        label: "initialScrollAtEnd",
        query: "mode=end",
    },
    "window-end": {
        description:
            "Uses initialScrollAtWindowEnd. In window-scroll mode, the initial browser scroll targets the page end instead of only the list end.",
        label: "initialScrollAtWindowEnd",
        query: "mode=window-end",
    },
};

function useWindowMetrics() {
    const [metrics, setMetrics] = React.useState({
        documentHeight: 0,
        remainingToWindowEnd: 0,
        scrollTop: 0,
        windowBottom: 0,
    });

    const updateMetrics = React.useCallback(() => {
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY;
        const windowBottom = window.scrollY + window.innerHeight;

        setMetrics({
            documentHeight,
            remainingToWindowEnd: Math.max(0, documentHeight - windowBottom),
            scrollTop: Math.round(scrollTop),
            windowBottom: Math.round(windowBottom),
        });
    }, []);

    React.useEffect(() => {
        setMetrics({
            documentHeight: 0,
            remainingToWindowEnd: 0,
            scrollTop: 0,
            windowBottom: 0,
        });

        updateMetrics();

        const onScroll = () => updateMetrics();
        const onResize = () => updateMetrics();

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onResize);
        };
    }, [updateMetrics]);

    return {
        metrics,
        refreshMetrics: updateMetrics,
    };
}

function getModeFromUrl(): Mode {
    if (typeof window === "undefined") {
        return "end";
    }

    const mode = new URLSearchParams(window.location.search).get("mode");
    return mode === "window-end" ? "window-end" : "end";
}

function navigateToMode(mode: Mode) {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.location.assign(url.toString());
}

export default function InitialScrollAtWindowEndExample() {
    const data = React.useMemo(() => generateItems(120), []);
    const mode = React.useMemo(getModeFromUrl, []);
    const { metrics, refreshMetrics } = useWindowMetrics();
    const modeMeta = MODE_META[mode];

    return (
        <div style={{ alignItems: "flex-start", display: "flex", gap: 16, paddingBottom: 32 }}>
            <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 20, minWidth: 0 }}>
                <div
                    style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    <h4 style={{ margin: "0 0 8px" }}>Initial window-scroll behavior</h4>
                    <p style={{ color: "#334155", margin: "0 0 8px" }}>
                        This page compares the two initial-end props when <code>useWindowScroll</code> is enabled. Extra
                        content below the list makes the difference visible on first load.
                    </p>
                    <p style={{ color: "#334155", margin: 0 }}>
                        Current mode: <code>{modeMeta.label}</code>. {modeMeta.description}
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
                    {...(mode === "window-end" ? { initialScrollAtWindowEnd: true } : { initialScrollAtEnd: true })}
                    key={`${mode}-${modeMeta.query}`}
                    keyExtractor={(item) => item.id}
                    onLoad={refreshMetrics}
                    onScroll={refreshMetrics}
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
                                {COPY_VARIANTS[index % COPY_VARIANTS.length]}
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
                        In <code>initialScrollAtEnd</code> mode, this area is still reachable after the initial scroll.
                        In <code>initialScrollAtWindowEnd</code> mode, the page starts at the actual window end instead.
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
                    Additional footer space to make the first-paint difference obvious and keep the page end visibly
                    separate from the list end.
                </div>
            </div>

            <aside
                style={{
                    alignSelf: "flex-start",
                    background: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: 16,
                    color: "#e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    padding: 16,
                    position: "sticky",
                    top: 0,
                    width: 340,
                }}
            >
                <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Mode switcher</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(Object.keys(MODE_META) as Mode[]).map((nextMode) => {
                            const isActive = nextMode === mode;
                            return (
                                <button
                                    key={nextMode}
                                    onClick={() => navigateToMode(nextMode)}
                                    style={{
                                        background: isActive ? "#1d4ed8" : "#0f172a",
                                        border: isActive ? "1px solid #60a5fa" : "1px solid #334155",
                                        borderRadius: 10,
                                        color: "#f8fafc",
                                        cursor: "pointer",
                                        padding: "10px 12px",
                                        textAlign: "left",
                                    }}
                                    type="button"
                                >
                                    {MODE_META[nextMode].label}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: "#0f172a",
                                border: "1px solid #334155",
                                borderRadius: 10,
                                color: "#f8fafc",
                                cursor: "pointer",
                                padding: "10px 12px",
                                textAlign: "left",
                            }}
                            type="button"
                        >
                            Reload current mode
                        </button>
                    </div>
                </div>

                <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Feature summary</div>
                    <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>
                        <div>
                            <code>initialScrollAtEnd</code>: align the last list item to the viewport end.
                        </div>
                        <div>
                            <code>initialScrollAtWindowEnd</code>: in web <code>useWindowScroll</code> mode, align the
                            browser window to the page end.
                        </div>
                    </div>
                </div>

                <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>How to use this page</div>
                    <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>
                        <div>
                            1. Pick a mode from the sidebar. The page navigates and reloads to replay initial scroll.
                        </div>
                        <div>2. Watch which content is visible immediately after load.</div>
                    </div>
                </div>
            </aside>

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
                {JSON.stringify(metrics, null, 2)}
            </pre>
        </div>
    );
}
