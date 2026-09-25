import { useCallback, useRef, useState } from "react";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react";

type Row = { id: string; height: number };
const initialRows = Array.from({ length: 500 }, (_, i) => ({ height: i % 7 === 0 ? 96 : 40, id: String(i) }));
const keyExtractor = (row: Row) => row.id;
const renderItem = ({ item }: LegendListRenderItemProps<Row>) => (
    <button
        data-row={item.id}
        style={{ borderBottom: "1px solid #888", height: item.height, width: "100%" }}
        type="button"
    >
        Row {item.id} ({item.height}px)
    </button>
);

export default function ExternalScrollExample() {
    const [owner, setOwner] = useState<HTMLDivElement | null>(null);
    const [headerHeight, setHeaderHeight] = useState(180);
    const [extraHeader, setExtraHeader] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [rows, setRows] = useState(initialRows);
    const firstRef = useRef<LegendListRef>(null);
    const secondRef = useRef<LegendListRef>(null);
    const [metrics, setMetrics] = useState("");
    const report = useCallback(() => {
        setMetrics(
            [firstRef, secondRef]
                .map((ref) => {
                    const state = ref.current?.getState();
                    return state ? `${state.start}-${state.end} / ${state.scrollLength}` : "pending";
                })
                .join("; "),
        );
    }, []);
    return (
        <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button onClick={() => setHeaderHeight((h) => (h === 180 ? 380 : 180))} type="button">
                    Resize header
                </button>
                <button onClick={() => setExtraHeader((shown) => !shown)} type="button">
                    Insert/remove header
                </button>
                <button onClick={() => setHidden((h) => !h)} type="button">
                    Hide/restore
                </button>
                <button onClick={() => firstRef.current?.scrollToIndex({ animated: false, index: 250 })} type="button">
                    First: row 250
                </button>
                <button onClick={() => secondRef.current?.scrollToIndex({ animated: false, index: 250 })} type="button">
                    Second: row 250
                </button>
                <button onClick={() => secondRef.current?.scrollToEnd({ animated: false })} type="button">
                    Second: end
                </button>
                <button
                    onClick={() => setRows((items) => [{ height: 64, id: `new-${items.length}` }, ...items])}
                    type="button"
                >
                    Prepend
                </button>
                <button
                    onClick={() =>
                        setRows((items) => items.map((item) => ({ ...item, height: item.height === 40 ? 72 : 40 })))
                    }
                    type="button"
                >
                    Resize rows
                </button>
            </div>
            <output data-metrics>{metrics}</output>
            <div
                data-scroll-owner
                ref={setOwner}
                style={{ border: "3px solid #888", height: 500, overflow: "auto", padding: 12 }}
            >
                {extraHeader && <div style={{ height: 240 }}>Inserted section before both lists</div>}
                <div data-header style={{ height: headerHeight }}>
                    Content before both lists
                </div>
                <div style={{ display: hidden ? "none" : undefined }}>
                    <LegendList
                        data={initialRows}
                        data-testid="first-list"
                        estimatedItemSize={48}
                        keyExtractor={keyExtractor}
                        maintainVisibleContentPosition
                        onScroll={report}
                        recycleItems
                        ref={firstRef}
                        renderItem={renderItem}
                        scrollElement={owner}
                    />
                    <div style={{ height: 120 }}>Content between lists</div>
                    <LegendList
                        data={rows}
                        data-testid="second-list"
                        estimatedItemSize={48}
                        keyExtractor={keyExtractor}
                        maintainVisibleContentPosition
                        onScroll={report}
                        recycleItems
                        ref={secondRef}
                        renderItem={renderItem}
                        scrollElement={owner}
                    />
                </div>
                <div style={{ height: 200 }}>Content after both lists</div>
            </div>
        </div>
    );
}
