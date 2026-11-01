import React from "react";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

const ITEM_SIZE = 200;

export default function AnchoredEndSpaceExample() {
    const listRef = React.useRef<LegendListRef | null>(null);
    const data = React.useMemo(() => generateItems(10), []);
    const [horizontal, setHorizontal] = React.useState(true);
    const [flexScroller, setFlexScroller] = React.useState(false);
    const [metrics, setMetrics] = React.useState("");
    const [space, setSpace] = React.useState<number>();

    const measure = React.useCallback(() => {
        const node = listRef.current?.getScrollableNode();
        if (node) {
            const [content, viewport] = horizontal
                ? [node.scrollWidth, node.clientWidth]
                : [node.scrollHeight, node.clientHeight];
            setMetrics(`scroll size ${content} / viewport ${viewport} / max offset ${content - viewport}`);
        }
    }, [horizontal]);

    React.useEffect(() => {
        const id = setTimeout(measure, 300);
        return () => clearTimeout(id);
    }, [measure, flexScroller]);

    const renderItem = React.useCallback(
        ({ index }: LegendListRenderItemProps<SimpleItem>) => (
            <div
                className="flex items-center justify-center border border-[#94a3b8] text-[#0f172a]"
                style={{
                    backgroundColor: index === data.length - 1 ? "#fde68a" : "#e2e8f0",
                    ...(horizontal ? { height: 160, width: ITEM_SIZE } : { height: ITEM_SIZE }),
                }}
            >
                Item {index}
                {index === data.length - 1 ? " (anchor)" : ""}
            </div>
        ),
        [horizontal, data.length],
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 bg-[#456] p-2 text-white">
            <div className="flex gap-2">
                <button onClick={() => setHorizontal((value) => !value)} type="button">
                    Axis: {horizontal ? "horizontal" : "vertical"}
                </button>
                <button onClick={() => setFlexScroller((value) => !value)} type="button">
                    Scroller: {flexScroller ? "flex + padding" : "block"}
                </button>
                <button onClick={() => listRef.current?.scrollToEnd({ animated: false })} type="button">
                    Scroll to end
                </button>
                <button onClick={measure} type="button">
                    Measure
                </button>
            </div>
            <div>
                {metrics} / anchored end space {space}
            </div>
            <div
                style={{
                    backgroundColor: "#0f172a",
                    outline: "2px solid #facc15",
                    ...(horizontal ? { height: 160, width: 800 } : { height: 400, width: 800 }),
                }}
            >
                <LegendList<SimpleItem>
                    anchoredEndSpace={{ anchorIndex: data.length - 1, onSizeChanged: setSpace }}
                    className={flexScroller ? (horizontal ? "flex px-14" : "flex flex-col py-14") : undefined}
                    data={data}
                    estimatedItemSize={ITEM_SIZE - 50}
                    horizontal={horizontal}
                    key={`${horizontal}-${flexScroller}`}
                    keyExtractor={(item) => item.id}
                    ref={listRef}
                    renderItem={renderItem}
                    style={{ height: "100%", width: "100%" }}
                />
            </div>
        </div>
    );
}
