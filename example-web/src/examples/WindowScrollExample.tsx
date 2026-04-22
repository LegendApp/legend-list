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
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <h4 className="mb-2 mt-0">Window Scroll Example</h4>
                <p className="m-0 text-[#334155]">
                    This list uses <code>useWindowScroll</code>, so the page scrollbar drives the list instead of an
                    internal scroll container.
                </p>
            </div>

            <div className="flex h-[220px] items-center justify-center rounded-xl border border-[#bfdbfe] bg-gradient-to-b from-[#dbeafe] to-[#eff6ff] font-semibold text-[#1e3a8a]">
                Content above the list
            </div>

            <LegendList<SimpleItem>
                className="rounded-xl border border-[#e2e8f0]"
                contentContainerStyle={{ padding: 8 }}
                data={data}
                estimatedItemSize={82}
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                onEndReachedThreshold={0.5}
                onLoad={updateScrollToEndVisibility}
                onScroll={updateScrollToEndVisibility}
                recycleItems
                ref={listRef}
                renderItem={({ index, item }: { index: number; item: SimpleItem }) => (
                    <button
                        className="mb-2 block w-full cursor-pointer rounded-[10px] border border-[#e2e8f0] px-[14px] py-3 text-left"
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            background: selectedId === item.id ? "#eff6ff" : "#fff",
                        }}
                        type="button"
                    >
                        <div className="mb-1 font-semibold">Row {index}</div>
                        <div className="text-sm text-[#475569]">{copyVariants[index % copyVariants.length]}</div>
                    </button>
                )}
                useWindowScroll
            />
            <pre className="fixed bottom-4 right-4 z-[1000] m-0 max-w-[340px] rounded-lg border border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.8)] p-3 text-xs text-[#a7f3d0] pointer-events-none">
                {"Example metrics\n"}
                {JSON.stringify(metrics, null, 2)}
            </pre>
        </div>
    );
}
