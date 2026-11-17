import { StrictMode, useCallback, useMemo, useRef, useState } from "react";

import { LegendList, type LegendListRef, type OnViewableItemsChangedInfo } from "@legendapp/list/react";

type Row = { id: string; revision: number };
const initialRows = Array.from({ length: 40 }, (_, index) => ({ id: String(index), revision: 0 }));
const keyExtractor = (item: Row) => item.id;
const fixedSize = () => 100;

export default function ViewabilityDwellExample() {
    const query = new URLSearchParams(window.location.search);
    const horizontal = query.get("horizontal") === "1";
    const columns = horizontal ? 1 : Number(query.get("columns") || 1);
    const useWindowScroll = query.get("window") === "1";
    const strict = query.get("strict") === "1";
    const [data, setData] = useState(initialRows);
    const [generation, setGeneration] = useState(0);
    const [minimumViewTime, setMinimumViewTime] = useState(1000);
    const [configId, setConfigId] = useState("dwell");
    const [reports, setReports] = useState<string[]>([]);
    const nextKey = useRef(40);
    const ref = useRef<LegendListRef>(null);
    const config = useMemo(
        () => ({ id: configId, itemVisiblePercentThreshold: 50, minimumViewTime }),
        [configId, minimumViewTime],
    );
    const onViewableItemsChanged = useCallback(
        (info: OnViewableItemsChangedInfo<Row>) => {
            const changed = info.changed.map(
                ({ key, index, isViewable, item }) => `${isViewable ? "+" : "-"}${key}@${index}/r${item.revision}`,
            );
            setReports((previous) => [
                ...previous.slice(-9),
                `${performance.now().toFixed(0)}ms callback ${generation}: ${changed.join(", ")}`,
            ]);
        },
        [generation],
    );
    const list = (
        <LegendList
            data={data}
            estimatedItemSize={100}
            getFixedItemSize={fixedSize}
            horizontal={horizontal}
            keyExtractor={keyExtractor}
            numColumns={columns}
            onViewableItemsChanged={onViewableItemsChanged}
            ref={ref}
            renderItem={({ item }) => (
                <div
                    style={{
                        border: "1px solid #94a3b8",
                        boxSizing: "border-box",
                        height: 100,
                        padding: 12,
                        width: horizontal ? 100 : undefined,
                    }}
                >
                    Row {item.id}, revision {item.revision}
                </div>
            )}
            style={useWindowScroll ? undefined : { height: 200, width: horizontal ? 200 : "100%" }}
            useWindowScroll={useWindowScroll}
            viewabilityConfig={config}
        />
    );
    return (
        <div>
            <p>
                Scroll one row near the end of a dwell. Each new row must wait its own full duration. Replace the
                callback or data while stationary: reports must use the latest owner and objects.
            </p>
            <p>URL options: window=1, horizontal=1, columns=2, strict=1. Window mode uses the page scrollbar.</p>
            <label>
                Minimum view time{" "}
                <select
                    onChange={(event) => setMinimumViewTime(Number(event.target.value))}
                    value={String(minimumViewTime)}
                >
                    {[0, 250, 1000, 2147483897, Number.POSITIVE_INFINITY].map((value) => (
                        <option key={String(value)} value={String(value)}>
                            {String(value)}
                        </option>
                    ))}
                </select>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>
                <button onClick={() => ref.current?.scrollToOffset({ animated: false, offset: 100 })} type="button">
                    Scroll one row
                </button>
                <button onClick={() => setGeneration((value) => value + 1)} type="button">
                    Replace callback
                </button>
                <button
                    onClick={() => setConfigId((value) => (value === "dwell" ? "replacement" : "dwell"))}
                    type="button"
                >
                    Replace config id
                </button>
                <button
                    onClick={() => setData((rows) => rows.map((item) => ({ ...item, revision: item.revision + 1 })))}
                    type="button"
                >
                    Replace data
                </button>
                <button
                    onClick={() => setData((rows) => (rows.length > 1 ? [rows[1], rows[0], ...rows.slice(2)] : rows))}
                    type="button"
                >
                    Reorder first rows
                </button>
                <button
                    onClick={() => {
                        const id = String(nextKey.current++);
                        setData((rows) => [{ id, revision: 0 }, ...rows]);
                    }}
                    type="button"
                >
                    Prepend
                </button>
                <button onClick={() => setData((rows) => rows.slice(1))} type="button">
                    Remove first row
                </button>
                <button onClick={() => setReports([])} type="button">
                    Clear reports
                </button>
            </div>
            <p>
                Current callback {generation}; config {configId}. Tokens show key@index/revision.
            </p>
            {useWindowScroll && <div style={{ height: 200 }}>Content above the list</div>}
            {strict ? <StrictMode>{list}</StrictMode> : list}
            <pre
                aria-label="Viewability reports"
                role="log"
                style={{ background: "#0f172a", color: "#a7f3d0", padding: 12, whiteSpace: "pre-wrap" }}
            >
                {reports.join("\n") || "Waiting for a full dwell"}
            </pre>
        </div>
    );
}
