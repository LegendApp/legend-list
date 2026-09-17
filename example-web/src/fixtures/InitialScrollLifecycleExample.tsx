import { useEffect, useMemo, useRef, useState } from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";

const ROWS = Array.from({ length: 55 }, (_, id) => ({ id: String(id) }));
const keyExtractor = (item: { id: string }) => item.id;

function Metrics({
    listRef,
    horizontal,
    loads,
}: {
    listRef: React.RefObject<LegendListRef | null>;
    horizontal: boolean;
    loads: React.RefObject<number>;
}) {
    const [metrics, setMetrics] = useState({ gap: 0, loads: 0, offset: 0 });
    useEffect(() => {
        const timer = setInterval(() => {
            const node = listRef.current?.getScrollableNode();
            if (!node) return;
            const offset = horizontal ? node.scrollLeft : node.scrollTop;
            const extent = horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
            setMetrics({ gap: Math.round(extent - offset), loads: loads.current ?? 0, offset: Math.round(offset) });
        }, 100);
        return () => clearInterval(timer);
    }, [horizontal, listRef, loads]);
    return (
        <output data-testid="initial-scroll-metrics">
            Offset: {metrics.offset} | End gap: {metrics.gap} | onLoad: {metrics.loads}
        </output>
    );
}

function Scenario({ horizontal, target, delayed }: { horizontal: boolean; target: "end" | "index"; delayed: boolean }) {
    const listRef = useRef<LegendListRef | null>(null);
    const loads = useRef(0);
    const [count, setCount] = useState(delayed ? 0 : 50);
    const [footer, setFooter] = useState(20);
    const [viewport, setViewport] = useState(360);
    const [stage, setStage] = useState("Waiting");
    const data = useMemo(() => ROWS.slice(0, count), [count]);

    useEffect(() => {
        const timers = [
            setTimeout(() => {
                setCount(50);
                setStage("Rows arrived");
            }, 100),
            setTimeout(() => {
                setFooter(40);
                setStage("Footer 40");
            }, 350),
            setTimeout(() => {
                setFooter(80);
                setStage("Footer 80");
            }, 550),
            setTimeout(() => {
                setCount(55);
                setStage("Rows appended");
            }, 750),
            setTimeout(() => {
                setViewport(280);
                setStage("Settled");
            }, 950),
        ];
        return () => timers.forEach(clearTimeout);
    }, []);

    return (
        <>
            <div className="flex flex-wrap gap-3">
                <button
                    data-testid="initial-scroll-away"
                    onClick={() => listRef.current?.scrollToIndex({ animated: false, index: 10 })}
                    type="button"
                >
                    Scroll to row 10
                </button>
                <button
                    data-testid="initial-scroll-footer"
                    onClick={() => setFooter((value) => value + 40)}
                    type="button"
                >
                    Grow footer
                </button>
                <span data-testid="initial-scroll-stage">{stage}</span>
                <Metrics horizontal={horizontal} listRef={listRef} loads={loads} />
            </div>
            <div
                data-testid="initial-scroll-viewport"
                style={{
                    border: "2px solid #64748b",
                    height: horizontal ? 200 : viewport,
                    width: horizontal ? viewport : "100%",
                }}
            >
                <LegendList
                    contentContainerStyle={
                        horizontal ? { paddingLeft: 24, paddingRight: 32 } : { paddingBottom: 32, paddingTop: 24 }
                    }
                    data={data}
                    estimatedItemSize={72}
                    horizontal={horizontal}
                    initialScrollAtEnd={target === "end"}
                    initialScrollIndex={target === "index" ? 20 : undefined}
                    keyExtractor={keyExtractor}
                    ListEmptyComponent={<div>Waiting for rows</div>}
                    ListFooterComponent={
                        <div
                            data-testid="initial-scroll-footer-content"
                            style={{
                                background: "#fde68a",
                                height: horizontal ? "100%" : footer,
                                width: horizontal ? footer : "100%",
                            }}
                        >
                            Footer
                        </div>
                    }
                    ListHeaderComponent={
                        <div
                            style={{
                                background: "#bfdbfe",
                                height: horizontal ? "100%" : 96,
                                width: horizontal ? 96 : "100%",
                            }}
                        >
                            Header
                        </div>
                    }
                    maintainVisibleContentPosition={false}
                    onLoad={() => {
                        loads.current++;
                    }}
                    recycleItems={false}
                    ref={listRef}
                    renderItem={({ item }) => (
                        <div
                            data-row={item.id}
                            style={{
                                background: Number(item.id) % 2 ? "#e0f2fe" : "#f1f5f9",
                                boxSizing: "border-box",
                                height: horizontal ? 160 : 72,
                                padding: 12,
                                width: horizontal ? 72 : "100%",
                            }}
                        >
                            Row {item.id}
                        </div>
                    )}
                    style={{ height: "100%", width: "100%" }}
                />
            </div>
        </>
    );
}

export default function InitialScrollLifecycleExample({ horizontal = false }: { horizontal?: boolean }) {
    const [run, setRun] = useState(0);
    const [target, setTarget] = useState<"end" | "index">("end");
    const [delayed, setDelayed] = useState(true);
    return (
        <div className="flex flex-col gap-4 p-4 text-[#0f172a]">
            <p>
                Within one second: rows arrive, the footer grows twice, five rows append, and the viewport shrinks. End
                mode should finish with row 54 visible and a zero end gap. Index mode should keep row 20 at the leading
                edge. onLoad should fire once per mount.
            </p>
            <p>
                Scroll to row 10 during the sequence: later changes must not pull it back. Remount during the sequence
                to test cleanup. Grow the footer after two seconds: initial alignment has expired and should not follow
                it.
            </p>
            <div className="flex flex-wrap gap-4">
                <button data-testid="initial-scroll-remount" onClick={() => setRun((value) => value + 1)} type="button">
                    Remount sequence
                </button>
                <label>
                    Target{" "}
                    <select onChange={(event) => setTarget(event.target.value as "end" | "index")} value={target}>
                        <option value="end">End</option>
                        <option value="index">Index 20</option>
                    </select>
                </label>
                <label>
                    <input checked={delayed} onChange={(event) => setDelayed(event.target.checked)} type="checkbox" />{" "}
                    Start empty
                </label>
            </div>
            <Scenario delayed={delayed} horizontal={horizontal} key={`${run}-${target}-${delayed}`} target={target} />
        </div>
    );
}
