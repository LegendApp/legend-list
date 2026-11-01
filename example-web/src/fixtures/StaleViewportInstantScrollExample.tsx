import React from "react";

import { LegendList, type LegendListRef, type ViewToken } from "@legendapp/list/react";

// A short thread in a side panel: the list mounts while the panel is still opening, then the panel
// reaches full height and the app scrolls to the end before the list's ResizeObserver reports it.
const START_HEIGHT = 20;
const FULL_HEIGHT = 347;
const HEADER_HEIGHT = 150;
const ROW_HEIGHT = 52;
const FOOTER_HEIGHT = 24;
const END_OFFSET = 1_000_000_000;

type Row = { id: string };
type Verdict = {
    domScroll: number;
    modelScroll: number;
    onScreen: string[];
    viewable: string[];
};

const rows: Row[] = [{ id: "reply-0" }, { id: "reply-1" }];

function readVerdict(list: LegendListRef, host: HTMLElement, viewable: string[]): Verdict | null {
    const scroller = list.getScrollableNode() as HTMLElement | null;
    if (!scroller) return null;
    const bounds = scroller.getBoundingClientRect();
    const onScreen = [...host.querySelectorAll<HTMLElement>("[data-row]")]
        .filter((row) => {
            const rect = row.getBoundingClientRect();
            return rect.bottom > bounds.top + 0.5 && rect.top < bounds.bottom - 0.5;
        })
        .map((row) => row.dataset.row ?? "")
        .sort();
    return {
        domScroll: Math.round(scroller.scrollTop),
        modelScroll: Math.round(list.getState().scroll),
        onScreen,
        viewable: [...viewable].sort(),
    };
}

function Run({ animated, onVerdict }: { animated: boolean; onVerdict: (verdict: Verdict | null) => void }) {
    const ref = React.useRef<LegendListRef>(null);
    const hostRef = React.useRef<HTMLDivElement>(null);
    const viewableRef = React.useRef<string[]>([]);

    const onViewableItemsChanged = React.useCallback(({ viewableItems }: { viewableItems: ViewToken<Row>[] }) => {
        viewableRef.current = viewableItems.map((token) => token.key);
    }, []);

    React.useEffect(() => {
        let frame = 0;
        // Wait two frames so the list has measured the short panel, then grow the panel and scroll
        // to the end in the same frame, before ResizeObserver delivers the new height.
        frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
                if (hostRef.current) hostRef.current.style.height = `${FULL_HEIGHT}px`;
                ref.current
                    ?.scrollToOffset({ animated, offset: END_OFFSET })
                    .catch((error: unknown) => console.error("scrollToOffset failed", error));
            });
        });
        const timeout = setTimeout(() => {
            if (ref.current && hostRef.current) {
                onVerdict(readVerdict(ref.current, hostRef.current, viewableRef.current));
            }
        }, 1000);
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(timeout);
        };
    }, [animated, onVerdict]);

    return (
        <div
            className="flex rounded-lg border border-slate-300"
            data-testid="list-host"
            ref={hostRef}
            style={{ height: START_HEIGHT, width: 320 }}
        >
            <LegendList<Row>
                className="min-h-0 flex-1"
                data={rows}
                estimatedItemSize={88}
                initialScrollAtEnd
                keyExtractor={(row) => row.id}
                ListFooterComponent={<div style={{ background: "#dcfce7", height: FOOTER_HEIGHT }} />}
                ListHeaderComponent={
                    <div className="px-3 py-2 text-sm" style={{ background: "#e0e7ff", height: HEADER_HEIGHT }}>
                        Thread root
                    </div>
                }
                maintainScrollAtEnd
                maintainVisibleContentPosition={{ data: true, size: true }}
                onViewableItemsChanged={onViewableItemsChanged}
                recycleItems={false}
                ref={ref}
                renderItem={({ item }) => (
                    <div
                        className="box-border border-slate-200 border-b px-3 py-2 text-sm"
                        data-row={item.id}
                        style={{ height: ROW_HEIGHT }}
                    >
                        {item.id}
                    </div>
                )}
                viewabilityConfig={{ itemVisiblePercentThreshold: 1 }}
            />
        </div>
    );
}

export default function StaleViewportInstantScrollExample() {
    const [runKey, setRunKey] = React.useState(0);
    const [animated, setAnimated] = React.useState(false);
    const [verdict, setVerdict] = React.useState<Verdict | null>(null);

    const rerun = (nextAnimated: boolean) => {
        setVerdict(null);
        setAnimated(nextAnimated);
        setRunKey((key) => key + 1);
    };
    const ok =
        verdict !== null &&
        Math.abs(verdict.modelScroll - verdict.domScroll) <= 1 &&
        verdict.viewable.join() === verdict.onScreen.join();

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <button data-testid="run-instant" onClick={() => rerun(false)} type="button">
                    Rerun (instant scroll)
                </button>
                <button data-testid="run-animated" onClick={() => rerun(true)} type="button">
                    Rerun (animated scroll)
                </button>
            </div>
            <div className="font-mono text-xs" data-ok={verdict ? String(ok) : undefined} data-testid="verdict">
                {verdict
                    ? `${ok ? "PASS" : "FAIL"} (${animated ? "animated" : "instant"}): state.scroll ${verdict.modelScroll}, DOM scrollTop ${verdict.domScroll}; viewable [${verdict.viewable.join(", ")}], on screen [${verdict.onScreen.join(", ")}]`
                    : "Measuring… PASS means state.scroll matches the DOM and every row on screen is viewable."}
            </div>
            <Run animated={animated} key={runKey} onVerdict={setVerdict} />
        </div>
    );
}
