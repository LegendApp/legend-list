import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";

type DemoItem = {
    color: string;
    id: string;
    label: number;
    text: string;
};

type JumpEvent = {
    at: number;
    deltaPx: number;
    fromPx: number;
    toPx: number;
};

const COPY_VARIANTS = [
    "Compact row.",
    "This row is intentionally longer and includes enough words to wrap on most desktop resolutions. It helps demonstrate how virtualization handles mixed measured heights while the scroll container drives the list.",
    "Medium-length example text with a second sentence so item height differs from compact rows.",
    "Very long row copy: when this row renders, it should span multiple lines even on large monitors because the sentence keeps going with descriptive details about prepend loading, maintainVisibleContentPosition, and stable positioning during rapid wheel movement.",
    "Another short row.",
    "Long variant with punctuation and structure. First, it adds detail. Second, it continues with additional context about list behavior under dynamic content. Third, it closes with one more sentence to force a clearly taller cell.",
];
const ROW_COLORS = ["#111827", "#7c2d12", "#14532d", "#1d4ed8", "#7e22ce", "#9a3412"];
const PAGE_SIZE = 5;
const INITIAL_COUNT = 10;

function createItems(fromInclusive: number, count: number, sizeMultiplier: number): DemoItem[] {
    return Array.from({ length: count }, (_, offset) => {
        const label = fromInclusive + offset;
        const copy = COPY_VARIANTS[Math.abs(label) % COPY_VARIANTS.length];

        return {
            color: ROW_COLORS[Math.abs(label) % ROW_COLORS.length],
            id: String(label),
            label,
            text: copy.repeat(sizeMultiplier),
        };
    });
}

function getScrollFromBottom(node: HTMLElement | null): number {
    if (!node) {
        return 0;
    }

    return node.scrollHeight - node.clientHeight - node.scrollTop;
}

function useScrollJumpDetector(node: HTMLElement | null, thresholdPx: number) {
    const [events, setEvents] = React.useState<JumpEvent[]>([]);
    const [pxFromBottom, setPxFromBottom] = React.useState(0);
    const prevRef = React.useRef<number | null>(null);
    const rafRef = React.useRef<number>(0);

    React.useEffect(() => {
        prevRef.current = null;
        setEvents([]);
        setPxFromBottom(getScrollFromBottom(node));
    }, [node, thresholdPx]);

    React.useEffect(() => {
        if (!node) {
            return;
        }

        const sample = () => {
            rafRef.current = 0;

            const next = getScrollFromBottom(node);
            setPxFromBottom(next);

            const prev = prevRef.current;
            if (prev !== null) {
                const delta = Math.abs(next - prev);
                if (delta >= thresholdPx) {
                    setEvents((current) =>
                        [
                            {
                                at: Date.now(),
                                deltaPx: delta,
                                fromPx: prev,
                                toPx: next,
                            },
                            ...current,
                        ].slice(0, 6),
                    );
                }
            }

            prevRef.current = next;
        };

        const onScrollOrResize = () => {
            if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(sample);
            }
        };

        sample();
        node.addEventListener("scroll", onScrollOrResize, { passive: true });
        window.addEventListener("resize", onScrollOrResize);

        return () => {
            node.removeEventListener("scroll", onScrollOrResize);
            window.removeEventListener("resize", onScrollOrResize);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [node, thresholdPx]);

    return { events, pxFromBottom };
}

export default function PrependLargeItemsJumpExample() {
    const listRef = React.useRef<LegendListRef | null>(null);
    const isReadyRef = React.useRef(false);
    const isPrependingRef = React.useRef(false);
    const oldestIdRef = React.useRef(0);
    const [exampleVersion, setExampleVersion] = React.useState(0);
    const [prependCount, setPrependCount] = React.useState(0);
    const [scrollNode, setScrollNode] = React.useState<HTMLElement | null>(null);
    const [sizeMultiplier, setSizeMultiplier] = React.useState(200);
    const [data, setData] = React.useState<DemoItem[]>(() => createItems(0, INITIAL_COUNT, 40));
    const jumpThreshold = Math.max(600, sizeMultiplier * 140);
    const { events, pxFromBottom } = useScrollJumpDetector(scrollNode, jumpThreshold);

    const resetExample = React.useCallback((nextMultiplier: number) => {
        oldestIdRef.current = 0;
        isReadyRef.current = false;
        isPrependingRef.current = false;
        setScrollNode(null);
        setPrependCount(0);
        setSizeMultiplier(nextMultiplier);
        setData(createItems(0, INITIAL_COUNT, nextMultiplier));
        setExampleVersion((value) => value + 1);
    }, []);

    const prependPage = React.useCallback(() => {
        if (!isReadyRef.current || isPrependingRef.current) {
            return;
        }

        isPrependingRef.current = true;
        const nextStart = oldestIdRef.current - PAGE_SIZE;
        oldestIdRef.current = nextStart;

        setPrependCount((value) => value + 1);
        setData((current) => [...createItems(nextStart, PAGE_SIZE, sizeMultiplier), ...current]);

        requestAnimationFrame(() => {
            isPrependingRef.current = false;
        });
    }, [sizeMultiplier]);

    React.useEffect(() => {
        let raf = 0;

        const syncScrollNode = () => {
            const next = listRef.current?.getScrollableNode() ?? null;
            if (next) {
                setScrollNode(next);
                return;
            }

            raf = requestAnimationFrame(syncScrollNode);
        };

        syncScrollNode();

        return () => {
            cancelAnimationFrame(raf);
        };
    }, [exampleVersion]);

    return (
        <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] p-4 text-[#1e3a8a]">
                    <h4 className="mb-2 mt-0">Oversized prepend jump reproduction</h4>
                    <p className="mb-2 mt-0">
                        This is a scroll-container example that starts at the end like a chat. When{" "}
                        <code>onStartReached</code> prepends older messages, oversized rows can cause large scroll jumps
                        because the current viewport sits inside a row whose top edge is already above the viewport.
                    </p>
                    <p className="m-0">
                        Use the presets below, scroll toward the top, and watch the jump log. Small rows usually stay
                        stable; oversized rows reproduce the bug.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => resetExample(2)} type="button">
                        Small rows
                    </button>
                    <button onClick={() => resetExample(40)} type="button">
                        Oversized rows
                    </button>
                    <button onClick={() => resetExample(sizeMultiplier)} type="button">
                        Reset current preset
                    </button>
                    <button
                        onClick={() => {
                            listRef.current?.scrollToEnd({ animated: false });
                        }}
                        type="button"
                    >
                        Scroll to end
                    </button>
                    <span className="text-sm text-[#475569]">
                        size multiplier: <strong>{sizeMultiplier}</strong>
                    </span>
                    <span className="text-sm text-[#475569]">
                        prepends: <strong>{prependCount}</strong>
                    </span>
                </div>

                <div className="flex min-h-0 flex-1 rounded-2xl border border-[#1e293b] bg-[#0f172a] p-3">
                    <LegendList<DemoItem>
                        className="min-h-0 flex-1"
                        contentContainerClassName="p-2"
                        data={data}
                        initialScrollAtEnd
                        key={exampleVersion}
                        keyExtractor={(item) => item.id}
                        maintainVisibleContentPosition
                        onLoad={() => {
                            isReadyRef.current = true;
                            setScrollNode(listRef.current?.getScrollableNode() ?? null);
                        }}
                        onStartReached={prependPage}
                        onStartReachedThreshold={1}
                        recycleItems
                        ref={listRef}
                        renderItem={({ item, index }: { item: DemoItem; index: number }) => (
                            <article
                                className="mb-2 rounded-[14px] border border-[rgba(255,255,255,0.12)] px-4 py-[14px] text-[#f8fafc]"
                                style={{
                                    background: item.color,
                                }}
                            >
                                <div className="mb-2 text-xs font-bold opacity-80">
                                    row {index} / id {item.label}
                                </div>
                                <div className="text-sm leading-[1.5]">{item.text}</div>
                            </article>
                        )}
                    />
                </div>
            </div>

            <aside className="flex w-80 flex-col gap-3 rounded-2xl border border-[#1e293b] bg-[#020617] p-4 text-[#e2e8f0]">
                <div>
                    <div className="mb-1 text-xs text-[#94a3b8]">Jump detector</div>
                    <div className="text-sm">{Math.max(0, Math.round(pxFromBottom))} px from bottom</div>
                    <div className="text-xs text-[#94a3b8]">logs deltas larger than {jumpThreshold} px</div>
                </div>

                <div>
                    <div className="mb-1.5 text-xs text-[#94a3b8]">Recent jumps</div>
                    {events.length === 0 ? (
                        <div className="text-[13px] text-[#64748b]">No jumps detected yet.</div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {events.map((event) => (
                                <div
                                    className="rounded-[10px] border border-[rgba(148,163,184,0.2)] bg-[rgba(15,23,42,0.9)] p-2.5"
                                    key={event.at}
                                >
                                    <div className="text-[13px] font-bold text-[#fbbf24]">
                                        {Math.round(event.deltaPx)} px jump
                                    </div>
                                    <div className="text-xs text-[#cbd5e1]">
                                        {Math.round(event.fromPx)} to {Math.round(event.toPx)} px from bottom
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
