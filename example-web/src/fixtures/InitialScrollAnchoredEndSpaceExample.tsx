import React from "react";
import { createRoot } from "react-dom/client";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { generateItems, type SimpleItem } from "./utils";

const ITEM_HEIGHT = 100;
const LIST_HEIGHT = 480;

type Metrics = { scrollTop: number; selectedTop: number | undefined; scrollHeight: number };

/*
 * The playground wraps the app in React.StrictMode. Its double-invoked mount effects restart the
 * bootstrap session after the first layout pass, which hides the race this fixture exists for
 * (the first settled bootstrap pass runs before anchoredEndSpace is measured). Mount the list in
 * its own root so it runs like a production build.
 */
export default function InitialScrollAnchoredEndSpaceExample() {
    const hostRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const container = document.createElement("div");
        hostRef.current?.appendChild(container);
        const root = createRoot(container);
        root.render(<InitialScrollAnchoredEndSpaceList />);
        return () => {
            queueMicrotask(() => {
                root.unmount();
                container.remove();
            });
        };
    }, []);

    return <div ref={hostRef} />;
}

function InitialScrollAnchoredEndSpaceList() {
    const params = new URLSearchParams(window.location.search);
    const estimatedItemSize = Number(params.get("estimate") ?? 50);
    const count = Number(params.get("count") ?? 4);
    const initialIndex = Number(params.get("index") ?? count - 1);
    const data = React.useMemo(() => generateItems(count), [count]);
    const listRef = React.useRef<LegendListRef>(null);
    const frameRef = React.useRef<HTMLDivElement>(null);
    const [metrics, setMetrics] = React.useState<Metrics>({ scrollHeight: 0, scrollTop: 0, selectedTop: undefined });

    React.useEffect(() => {
        let frame = 0;
        const read = () => {
            const scroller = frameRef.current?.querySelector<HTMLElement>("[style*='overflow: auto']");
            const selected = frameRef.current?.querySelector<HTMLElement>(`[data-testid='item-${initialIndex}']`);
            if (scroller) {
                const scrollerTop = scroller.getBoundingClientRect().top;
                setMetrics((previous) => {
                    const next = {
                        scrollHeight: Math.round(scroller.scrollHeight),
                        scrollTop: Math.round(scroller.scrollTop),
                        selectedTop: selected
                            ? Math.round(selected.getBoundingClientRect().top - scrollerTop)
                            : undefined,
                    };
                    return previous.scrollHeight === next.scrollHeight &&
                        previous.scrollTop === next.scrollTop &&
                        previous.selectedTop === next.selectedTop
                        ? previous
                        : next;
                });
            }
            frame = requestAnimationFrame(read);
        };
        frame = requestAnimationFrame(read);
        return () => cancelAnimationFrame(frame);
    }, [initialIndex]);

    const isAtTop = metrics.selectedTop === 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 480 }}>
            <div
                ref={frameRef}
                style={{ border: "2px solid #3b5bdb", boxSizing: "content-box", height: LIST_HEIGHT, width: 480 }}
            >
                <LegendList<SimpleItem>
                    anchoredEndSpace={{ anchorIndex: count - 1 }}
                    data={data}
                    drawDistance={ITEM_HEIGHT * 2}
                    estimatedItemSize={estimatedItemSize}
                    initialScrollIndex={initialIndex}
                    keyExtractor={(item) => item.id}
                    ref={listRef}
                    renderItem={({ item, index }) => (
                        <div
                            data-testid={`item-${index}`}
                            style={{
                                alignItems: "center",
                                background: index === initialIndex ? "#ffd8a8" : "#e8eefc",
                                border: index === initialIndex ? "4px solid #e8590c" : "2px solid #3b5bdb",
                                boxSizing: "border-box",
                                display: "flex",
                                fontSize: 28,
                                height: ITEM_HEIGHT,
                                justifyContent: "center",
                            }}
                        >
                            {`Item ${Number(item.id) + 1}`}
                            {index === initialIndex ? " (selected)" : ""}
                        </div>
                    )}
                    style={{ height: LIST_HEIGHT }}
                />
            </div>
            <div
                data-testid="status"
                style={{
                    background: isAtTop ? "#d3f9d8" : "#ffe3e3",
                    fontFamily: "monospace",
                    fontSize: 18,
                    padding: 8,
                }}
            >
                {`count=${count}, estimatedItemSize=${estimatedItemSize}, selected=Item ${initialIndex + 1}, scrollTop=${metrics.scrollTop}, scrollHeight=${metrics.scrollHeight}, selected top=${metrics.selectedTop ?? "-"}px (${isAtTop ? "at the top" : "not at the top"})`}
            </div>
        </div>
    );
}
