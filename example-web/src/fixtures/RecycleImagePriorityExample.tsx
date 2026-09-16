import { memo, Profiler, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react";

const ROW_HEIGHT = 120;
const DATA = Array.from({ length: 500 }, (_, index) => ({ id: String(index), index }));
const keyExtractor = (item: (typeof DATA)[number]) => item.id;
const getFixedItemSize = () => ROW_HEIGHT;
const IMAGE_PATH = "/__fixtures/recycle-image";

type TraceEntry = { index: number; time: number };
type Trace = { entries: TraceEntry[]; pendingCommit: string[]; session: string };

function reportImageCommit(trace: Trace) {
    // Profiler runs after the rows' layout effects. Expose commit boundaries for
    // the browser replay without changing when the ordinary img requests start.
    if (trace.pendingCommit.length > 0) {
        window.dispatchEvent(
            new CustomEvent("recycle-image-commit", {
                detail: [...new Set(trace.pendingCommit.splice(0))],
            }),
        );
    }
}

// biome-ignore lint/nursery/noShadow: named memo component
const SlowImageRow = memo(function SlowImageRow({
    index,
    slowMs,
    trace,
}: {
    index: number;
    slowMs: number;
    trace: Trace;
}) {
    // Deliberately expensive render work for this stress fixture only.
    const started = performance.now();
    while (performance.now() - started < slowMs) {
        // Simulate a rich image card monopolizing the JS thread.
    }
    // A unique URL per recycled assignment lets the test correlate requests even
    // when the same item leaves and re-enters the buffer during a wheel burst.
    const src = useMemo(
        () => `${IMAGE_PATH}?session=${trace.session}&index=${index}&assignment=${crypto.randomUUID()}`,
        [index, trace],
    );
    const reportedSrc = useRef<string | undefined>(undefined);
    useLayoutEffect(() => {
        // StrictMode replays mount effects without initiating another request.
        if (reportedSrc.current !== src) {
            reportedSrc.current = src;
            trace.pendingCommit.push(new URL(src, window.location.href).href);
        }
    }, [src, trace]);
    return (
        <article
            className="flex items-center gap-4 border-b border-slate-300 bg-white p-3"
            style={{ height: ROW_HEIGHT }}
        >
            <img alt={`Card ${index}`} height={92} loading="eager" src={src} width={140} />
            <div>
                <strong>Row {index}</strong>
                <p>{slowMs} ms render · uncached image · 400 ms response delay</p>
            </div>
        </article>
    );
});

function RequestLog({ trace }: { trace: Trace }) {
    const [entries, setEntries] = useState<TraceEntry[]>([]);
    useEffect(() => {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const url = new URL(entry.name);
                if (url.pathname === IMAGE_PATH && url.searchParams.get("session") === trace.session) {
                    trace.entries.push({
                        index: Number(url.searchParams.get("index")),
                        time: entry.startTime,
                    });
                }
            }
        });
        observer.observe({ buffered: true, type: "resource" });
        const timer = window.setInterval(() => setEntries([...trace.entries]), 250);
        return () => {
            observer.disconnect();
            window.clearInterval(timer);
        };
    }, [trace]);
    const requests = [...entries].sort((a, b) => a.time - b.time);
    return (
        <aside className="w-80 shrink-0 overflow-auto rounded border border-slate-300 bg-slate-50 p-3">
            <h2 className="font-bold">Image request start order</h2>
            <p className="mb-3 text-xs">
                Actual Resource Timing start times, shown after responses finish. Completion order is irrelevant.
            </p>
            <button
                className="mb-3 rounded border px-2 py-1"
                onClick={() => {
                    trace.entries.length = 0;
                    setEntries([]);
                }}
                type="button"
            >
                Clear log
            </button>
            <ol className="font-mono text-xs" data-testid="image-request-log">
                {requests.map((entry, index) => (
                    <li data-index={entry.index} data-time={entry.time} key={`${entry.time}-${index}`}>
                        #{index + 1} · row {entry.index} · {entry.time.toFixed(1)} ms
                    </li>
                ))}
            </ol>
        </aside>
    );
}

function ImagePriorityRun({ atEnd, slowMs }: { atEnd: boolean; slowMs: number }) {
    const [trace] = useState<Trace>(() => ({ entries: [], pendingCommit: [], session: crypto.randomUUID() }));
    const host = useRef<HTMLDivElement>(null);
    const onRender = useCallback(() => reportImageCommit(trace), [trace]);
    const renderItem = useCallback(
        ({ index }: LegendListRenderItemProps<(typeof DATA)[number]>) => (
            <SlowImageRow index={index} slowMs={slowMs} trace={trace} />
        ),
        [slowMs, trace],
    );
    // Move the actual scroll element so this exercises ordinary scroll events,
    // including direction changes, rather than scrollTo's pinned target range.
    const jump = (delta: number) => {
        host.current
            ?.querySelector("[data-testid='image-priority-list']")
            ?.scrollBy({ behavior: "instant", top: delta });
    };
    return (
        <>
            <div className="mb-3 flex gap-2">
                <button className="rounded border px-3 py-1" onClick={() => jump(480)} type="button">
                    Fast down 4 rows
                </button>
                <button className="rounded border px-3 py-1" onClick={() => jump(-480)} type="button">
                    Fast up 4 rows
                </button>
                <button className="rounded border px-3 py-1" onClick={() => jump(4800)} type="button">
                    Jump down 40 rows
                </button>
            </div>
            <div className="flex min-h-0 flex-1 gap-4">
                <div className="min-w-0 flex-1" ref={host}>
                    <Profiler id="image-priority" onRender={onRender}>
                        <LegendList
                            data={DATA}
                            data-testid="image-priority-list"
                            drawDistance={360}
                            estimatedListSize={{ height: 480, width: 600 }}
                            getFixedItemSize={getFixedItemSize}
                            initialScrollAtEnd={atEnd}
                            keyExtractor={keyExtractor}
                            recycleItems
                            renderItem={renderItem}
                            style={{ height: 480 }}
                        />
                    </Profiler>
                </div>
                <RequestLog trace={trace} />
            </div>
        </>
    );
}

export default function RecycleImagePriorityExample() {
    const [run, setRun] = useState({ atEnd: false, id: 0 });
    const [slowMs, setSlowMs] = useState(25);
    return (
        <section className="flex min-h-0 flex-1 flex-col p-4 text-slate-900">
            <h1 className="text-xl font-bold">Recycled image loading priority</h1>
            <p className="my-2">
                Scroll quickly or use the buttons. Newly needed rows should request images in ascending order going
                down, descending going up or starting at the end. This checks loading priority, not blanking.
            </p>
            <div className="mb-3 flex items-center gap-3">
                <label>
                    Render cost{" "}
                    <select onChange={(event) => setSlowMs(Number(event.target.value))} value={slowMs}>
                        <option value={0}>0 ms</option>
                        <option value={25}>25 ms</option>
                        <option value={60}>60 ms (very slow)</option>
                    </select>
                </label>
                <button
                    className="rounded border px-3 py-1"
                    onClick={() => setRun((previous) => ({ atEnd: false, id: previous.id + 1 }))}
                    type="button"
                >
                    Restart at top
                </button>
                <button
                    className="rounded border px-3 py-1"
                    onClick={() => setRun((previous) => ({ atEnd: true, id: previous.id + 1 }))}
                    type="button"
                >
                    Restart at end
                </button>
            </div>
            <ImagePriorityRun atEnd={run.atEnd} key={run.id} slowMs={slowMs} />
        </section>
    );
}
