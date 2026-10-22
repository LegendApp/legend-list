import React from "react";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

const ROW_HEIGHT = 100;
const VIEWPORT_HEIGHT = 400;
const COUNT = 12;
const LAST_INDEX = COUNT - 1;

export default function AnchoredEndSpaceExactEstimateExample() {
    const listRef = React.useRef<LegendListRef | null>(null);
    const data = React.useMemo(() => generateItems(COUNT), []);
    const [mountKey, setMountKey] = React.useState(0);
    const [space, setSpace] = React.useState<number>();
    const [readyCount, setReadyCount] = React.useState(0);
    const [rowTop, setRowTop] = React.useState<number>();
    const [targetIndex, setTargetIndex] = React.useState(LAST_INDEX);

    const onSizeChanged = React.useCallback((size: number) => setSpace(size), []);
    const onReady = React.useCallback(() => setReadyCount((count) => count + 1), []);

    React.useEffect(() => {
        const id = setInterval(() => {
            const node = listRef.current?.getScrollableNode();
            const row = node?.querySelector<HTMLElement>(`[data-row="${targetIndex}"]`);
            if (node && row) {
                setRowTop(Math.round(row.getBoundingClientRect().top - node.getBoundingClientRect().top));
            } else {
                setRowTop(undefined);
            }
        }, 100);
        return () => clearInterval(id);
    }, [targetIndex]);

    const remount = React.useCallback(() => {
        setSpace(undefined);
        setReadyCount(0);
        setMountKey((key) => key + 1);
    }, []);

    const scrollTo = React.useCallback((index: number) => {
        setTargetIndex(index);
        listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0 });
    }, []);

    const renderItem = React.useCallback(
        ({ index }: LegendListRenderItemProps<SimpleItem>) => (
            <div
                className="flex items-center justify-center border-2 border-[#64748b] text-[#0f172a]"
                data-row={index}
                style={{ background: index % 2 ? "#e2e8f0" : "#cbd5e1", height: ROW_HEIGHT }}
            >
                Item {index}
            </div>
        ),
        [],
    );

    const aligned = rowTop === 0;

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 bg-[#456] p-2 text-white">
            <div className="flex flex-wrap gap-2">
                <button onClick={() => scrollTo(LAST_INDEX)} type="button">
                    scrollToIndex({LAST_INDEX})
                </button>
                <button onClick={() => scrollTo(LAST_INDEX - 2)} type="button">
                    scrollToIndex({LAST_INDEX - 2})
                </button>
                <button onClick={remount} type="button">
                    Remount (initialScrollIndex {LAST_INDEX})
                </button>
            </div>
            <div className="font-mono">
                anchored end space: {space ?? "unset"} / onReady calls: {readyCount}
            </div>
            <div className="font-mono" style={{ color: aligned ? "#86efac" : "#fca5a5" }}>
                Item {targetIndex} top: {rowTop ?? "n/a"}px (expected 0 = aligned to viewport start)
            </div>
            <div className="border-2 border-[#fbbf24] bg-[#123]" style={{ height: VIEWPORT_HEIGHT, width: 360 }}>
                <LegendList<SimpleItem>
                    anchoredEndSpace={{ anchorIndex: LAST_INDEX, onReady, onSizeChanged }}
                    data={data}
                    estimatedItemSize={ROW_HEIGHT}
                    initialScrollIndex={{ index: LAST_INDEX, viewPosition: 0 }}
                    key={mountKey}
                    keyExtractor={(item) => item.id}
                    ref={listRef}
                    renderItem={renderItem}
                    style={{ height: "100%", width: "100%" }}
                />
            </div>
        </div>
    );
}
