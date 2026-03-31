import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

type DebugMetrics = {
    contentLength: number;
    end: number;
    endBuffered: number;
    hostRectHeight: number | null;
    isWindowScroll: boolean | null;
    numContainers: number | null;
    numContainersPooled: number | null;
    scrollLength: number;
    start: number;
    startBuffered: number;
    windowInnerHeight: number | null;
};

export default function WindowScrollExample() {
    const data = React.useMemo(() => generateItems(220), []);
    const listRef = React.useRef<LegendListRef | null>(null);
    const [selectedId, setSelectedId] = React.useState<string | undefined>();
    const [_showScrollToEnd, setShowScrollToEnd] = React.useState(true);
    const [metrics, setMetrics] = React.useState<DebugMetrics>({
        contentLength: 0,
        end: 0,
        endBuffered: 0,
        hostRectHeight: null,
        isWindowScroll: null,
        numContainers: null,
        numContainersPooled: null,
        scrollLength: 0,
        start: 0,
        startBuffered: 0,
        windowInnerHeight: null,
    });
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

    const updateMetricsFromState = React.useCallback((partial?: Partial<DebugMetrics>) => {
        const state = listRef.current?.getState();
        if (!state) return;
        const nativeRef = listRef.current?.getNativeScrollRef?.() as any;
        const hostRect = nativeRef?.getBoundingClientRect?.();
        setMetrics((prev) => ({
            ...prev,
            ...partial,
            contentLength: state.contentLength,
            end: state.end,
            endBuffered: state.endBuffered,
            hostRectHeight: typeof hostRect?.height === "number" ? hostRect.height : null,
            isWindowScroll: typeof nativeRef?.isWindowScroll === "function" ? nativeRef.isWindowScroll() : null,
            scrollLength: state.scrollLength,
            start: state.start,
            startBuffered: state.startBuffered,
            windowInnerHeight: typeof window !== "undefined" ? window.innerHeight : null,
        }));
    }, []);

    React.useEffect(() => {
        let raf = 0;
        let unlistenContainers: (() => void) | undefined;
        let unlistenPooled: (() => void) | undefined;

        const subscribe = () => {
            const state = listRef.current?.getState();
            if (!state) {
                raf = requestAnimationFrame(subscribe);
                return;
            }

            updateMetricsFromState();
            unlistenContainers = state.listen("numContainers", (value) => {
                updateMetricsFromState({ numContainers: value });
            });
            unlistenPooled = state.listen("numContainersPooled", (value) => {
                updateMetricsFromState({ numContainersPooled: value });
            });
        };

        subscribe();
        return () => {
            cancelAnimationFrame(raf);
            unlistenContainers?.();
            unlistenPooled?.();
        };
    }, [updateMetricsFromState]);

    const updateScrollToEndVisibility = React.useCallback(() => {
        const state = listRef.current?.getState();
        if (state) {
            const isNearEnd = state.isEndReached;
            setShowScrollToEnd(!isNearEnd);
            updateMetricsFromState();
        }
    }, [updateMetricsFromState]);

    return (
        <div>
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
                enableDeferredOptimization
                contentContainerStyle={{ padding: 8 }}
                data={data}
                estimatedItemSize={82}
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                onEndReachedThreshold={0.5}
                onLoad={updateScrollToEndVisibility}
                onScroll={updateScrollToEndVisibility}
                ref={listRef}
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
                {"Example metrics\n"}
                {JSON.stringify(metrics, null, 2)}
            </pre>
        </div>
    );
}
