import React from "react";

import { LegendList, type LegendListRef, type LegendListScrollResult } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

const ESTIMATED_ITEM_SIZE = 60;
const TARGET_INDEX = 300;

type Report = {
    action: string;
    driftAfterResolve?: number;
    laterOffsetFromTarget?: number;
    elapsedMs: number;
    offsetFromTarget: number;
    result: string;
};

function busyWait(ms: number) {
    const end = performance.now() + ms;
    while (performance.now() < end) {
        // Simulates expensive row rendering so scroll events stall past the idle window.
    }
}

// Rows render at the estimate, then grow once after first mounting, like late-loading images or embeds.
function LateRow({
    grownRows,
    index,
    stall,
    horizontal,
}: {
    grownRows: Set<number>;
    index: number;
    stall: boolean;
    horizontal: boolean;
}) {
    const [grown, setGrown] = React.useState(() => grownRows.has(index));
    if (stall) busyWait(4);
    React.useEffect(() => {
        if (grown) return;
        const timeout = setTimeout(
            () => {
                grownRows.add(index);
                setGrown(true);
            },
            40 + ((index * 37) % 260),
        );
        return () => clearTimeout(timeout);
    }, [grown, grownRows, index]);

    const height = grown ? ESTIMATED_ITEM_SIZE + (index % 4) * 70 : ESTIMATED_ITEM_SIZE;
    return (
        <div
            className="box-border border-slate-200 border-b px-3 py-2 text-sm"
            data-index={index}
            style={{
                background: index === TARGET_INDEX ? "#fde68a" : index % 2 ? "#f8fafc" : "#fff",
                ...(horizontal ? { height: "100%", width: height } : { height }),
            }}
        >
            Row {index}
            {index === TARGET_INDEX ? " (target)" : ""}
        </div>
    );
}

export default function ScrollPromiseLandedExample() {
    const query = new URLSearchParams(window.location.search);
    const horizontal = query.get("horizontal") === "1";
    const rtl = query.get("rtl") === "1";
    const ref = React.useRef<LegendListRef>(null);
    const data = React.useMemo(() => generateItems(1000), []);
    const [stall, setStall] = React.useState(true);
    const [mvcpSize, setMvcpSize] = React.useState(false);
    const [listKey, setListKey] = React.useState(0);
    // Reset with the list so each run starts with unmeasured rows.
    const grownRows = React.useMemo(() => new Set<number>(), [listKey]);
    const [report, setReport] = React.useState<Report | undefined>();

    const observedOffset = () => {
        const list = ref.current;
        const scroller = list?.getScrollableNode() as HTMLElement | undefined;
        if (!scroller) return Number.NaN;
        // Native DOM RTL scrolling uses negative scrollLeft in current browsers.
        return horizontal ? (rtl ? -scroller.scrollLeft : scroller.scrollLeft) : scroller.scrollTop;
    };

    const measureOffset = () => {
        const list = ref.current;
        const scroller = list?.getScrollableNode() as HTMLElement | undefined;
        if (!list || !scroller) return Number.NaN;
        return Math.round(observedOffset() - list.getState().positionAtIndex(TARGET_INDEX));
    };

    const run = (action: string, scroll: () => Promise<LegendListScrollResult> | undefined) => {
        const start = performance.now();
        setReport(undefined);
        void scroll()?.then((result) => {
            const offsetFromTarget = measureOffset();
            const scrollTop = observedOffset();
            const resolved: Report = {
                action,
                elapsedMs: Math.round(performance.now() - start),
                offsetFromTarget,
                result: result ? result.reason : "landed",
            };
            setReport(resolved);
            // An early resolve shows up as movement after .then while still off target. Movement that
            // keeps the target in place is maintainVisibleContentPosition absorbing rows measured later.
            setTimeout(() => {
                const laterTop = observedOffset();
                setReport({
                    ...resolved,
                    driftAfterResolve: Math.round(laterTop - scrollTop),
                    laterOffsetFromTarget: measureOffset(),
                });
            }, 600);
        });
    };

    const reset = () => {
        setReport(undefined);
        setListKey((key) => key + 1);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                    data-testid="scroll-to-index"
                    onClick={() =>
                        run("scrollToIndex", () => ref.current?.scrollToIndex({ animated: true, index: TARGET_INDEX }))
                    }
                    type="button"
                >
                    scrollToIndex({TARGET_INDEX})
                </button>
                <button
                    data-testid="scroll-to-offset"
                    onClick={() =>
                        run("scrollToOffset", () =>
                            ref.current?.scrollToOffset({
                                animated: true,
                                offset: ref.current.getState().positionAtIndex(TARGET_INDEX),
                            }),
                        )
                    }
                    type="button"
                >
                    scrollToOffset(row {TARGET_INDEX} estimate)
                </button>
                <button data-testid="reset" onClick={reset} type="button">
                    Reset list
                </button>
                <label>
                    <input checked={stall} onChange={(e) => setStall(e.target.checked)} type="checkbox" /> Slow row
                    renders
                </label>
                <label>
                    <input
                        checked={mvcpSize}
                        onChange={(e) => {
                            setMvcpSize(e.target.checked);
                            reset();
                        }}
                        type="checkbox"
                    />{" "}
                    maintainVisibleContentPosition size
                </label>
            </div>
            <div className="font-mono text-xs" data-testid="scroll-report">
                {report
                    ? `${report.action}: ${report.result} after ${report.elapsedMs}ms, ${report.offsetFromTarget}px from row ${TARGET_INDEX}` +
                      (report.driftAfterResolve === undefined
                          ? ""
                          : `, moved ${report.driftAfterResolve}px after resolve, then ${report.laterOffsetFromTarget}px from row ${TARGET_INDEX}`)
                    : "Reset, then scroll. A landed scroll reports 0px from the target and no movement after resolve."}
            </div>
            <LegendList<SimpleItem>
                className="min-h-0 flex-1 rounded-lg"
                data={data}
                estimatedItemSize={ESTIMATED_ITEM_SIZE}
                horizontal={horizontal}
                key={listKey}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition={{ size: mvcpSize }}
                ref={ref}
                renderItem={({ index }) => (
                    <LateRow grownRows={grownRows} horizontal={horizontal} index={index} stall={stall} />
                )}
                rtl={rtl}
                style={horizontal && rtl ? { direction: "rtl" } : undefined}
            />
        </div>
    );
}
