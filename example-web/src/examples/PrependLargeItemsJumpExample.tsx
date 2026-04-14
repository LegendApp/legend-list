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
    id: number;
    toPx: number;
};

type Config = {
    jumpDetectorMultiplier: number;
    multiplier: number;
    pageSize: number;
};

type Props = {
    useWindowScroll?: boolean;
};

const COPY_VARIANTS = [
    "Compact row.",
    "This row is intentionally longer and includes enough words to wrap on most desktop resolutions. It helps demonstrate how virtualization handles mixed measured heights while prepend loading keeps the viewport anchored.",
    "Medium-length example text with a second sentence so item height differs from compact rows.",
    "Very long row copy: when this row renders, it should span multiple lines even on large monitors because the sentence keeps going with descriptive details about prepend loading, maintainVisibleContentPosition, and stable positioning during rapid wheel movement.",
    "Another short row.",
    "Long variant with punctuation and structure. First, it adds detail. Second, it continues with additional context about list behavior under dynamic content. Third, it closes with one more sentence to force a clearly taller cell.",
];
const ROW_COLORS = ["#111827", "#7c2d12", "#14532d", "#1d4ed8", "#7e22ce", "#9a3412"];
const INITIAL_COUNT = 10;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_MULTIPLIER = 50;
const DEFAULT_JUMP_DETECTOR_MULTIPLIER = 100;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 30;
const MIN_MULTIPLIER = 1;
const MAX_MULTIPLIER = 50;
const MIN_JUMP_DETECTOR_MULTIPLIER = 1;
const MAX_JUMP_DETECTOR_MULTIPLIER = 300;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getNumberParam(searchParams: URLSearchParams, key: string, fallback: number, min: number, max: number) {
    const value = searchParams.get(key);
    if (value === null || value === "") {
        return fallback;
    }

    const raw = Number(value);
    return Number.isFinite(raw) ? clamp(raw, min, max) : fallback;
}

function readConfigFromUrl(): Config {
    if (typeof window === "undefined") {
        return {
            jumpDetectorMultiplier: DEFAULT_JUMP_DETECTOR_MULTIPLIER,
            multiplier: DEFAULT_MULTIPLIER,
            pageSize: DEFAULT_PAGE_SIZE,
        };
    }

    const searchParams = new URLSearchParams(window.location.search);
    return {
        jumpDetectorMultiplier: getNumberParam(
            searchParams,
            "jumpMultiplier",
            DEFAULT_JUMP_DETECTOR_MULTIPLIER,
            MIN_JUMP_DETECTOR_MULTIPLIER,
            MAX_JUMP_DETECTOR_MULTIPLIER,
        ),
        multiplier: getNumberParam(searchParams, "multiplier", DEFAULT_MULTIPLIER, MIN_MULTIPLIER, MAX_MULTIPLIER),
        pageSize: getNumberParam(searchParams, "pageSize", DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE, MAX_PAGE_SIZE),
    };
}

function writeConfigToUrl(config: Config) {
    if (typeof window === "undefined") {
        return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("pageSize", String(config.pageSize));
    searchParams.set("multiplier", String(config.multiplier));
    searchParams.set("jumpMultiplier", String(config.jumpDetectorMultiplier));

    const nextSearch = searchParams.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
}

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

function getScrollFromBottom(node: HTMLElement | null, useWindowScroll: boolean): number {
    if (!node) {
        return 0;
    }

    if (useWindowScroll) {
        if (typeof window === "undefined") {
            return 0;
        }

        return node.scrollHeight - window.innerHeight - window.scrollY;
    }

    return node.scrollHeight - node.clientHeight - node.scrollTop;
}

function useScrollJumpDetector(
    node: HTMLElement | null,
    thresholdPx: number,
    useWindowScroll: boolean,
    resetKey: number,
) {
    const [events, setEvents] = React.useState<JumpEvent[]>([]);
    const [pxFromBottom, setPxFromBottom] = React.useState(0);
    const [totalJumpCount, setTotalJumpCount] = React.useState(0);
    const nextEventIdRef = React.useRef(0);
    const prevRef = React.useRef<number | null>(null);
    const rafRef = React.useRef<number>(0);

    React.useEffect(() => {
        prevRef.current = null;
        setEvents([]);
        setPxFromBottom(getScrollFromBottom(node, useWindowScroll));
        setTotalJumpCount(0);
        nextEventIdRef.current = 0;
    }, [node, thresholdPx, useWindowScroll, resetKey]);

    React.useEffect(() => {
        if (!node) {
            return;
        }

        const sample = () => {
            rafRef.current = 0;

            const next = getScrollFromBottom(node, useWindowScroll);
            setPxFromBottom(next);

            const prev = prevRef.current;
            if (prev !== null) {
                const delta = Math.abs(next - prev);
                if (delta >= thresholdPx) {
                    const eventId = nextEventIdRef.current;
                    nextEventIdRef.current += 1;
                    setTotalJumpCount((count) => count + 1);
                    setEvents((current) =>
                        [
                            {
                                at: Date.now(),
                                deltaPx: delta,
                                fromPx: prev,
                                id: eventId,
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

        if (useWindowScroll) {
            window.addEventListener("scroll", onScrollOrResize, { passive: true });
        } else {
            node.addEventListener("scroll", onScrollOrResize, { passive: true });
        }
        window.addEventListener("resize", onScrollOrResize);

        return () => {
            if (useWindowScroll) {
                window.removeEventListener("scroll", onScrollOrResize);
            } else {
                node.removeEventListener("scroll", onScrollOrResize);
            }
            window.removeEventListener("resize", onScrollOrResize);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [node, thresholdPx, useWindowScroll, resetKey]);

    return { events, pxFromBottom, totalJumpCount };
}

export default function PrependLargeItemsJumpExample({ useWindowScroll = false }: Props) {
    const initialConfig = React.useMemo(readConfigFromUrl, []);
    const listRef = React.useRef<LegendListRef | null>(null);
    const isReadyRef = React.useRef(false);
    const isPrependingRef = React.useRef(false);
    const oldestIdRef = React.useRef(0);
    const [exampleVersion, setExampleVersion] = React.useState(0);
    const [prependCount, setPrependCount] = React.useState(0);
    const [scrollNode, setScrollNode] = React.useState<HTMLElement | null>(null);
    const [pageSize, setPageSize] = React.useState(initialConfig.pageSize);
    const [multiplier, setMultiplier] = React.useState(initialConfig.multiplier);
    const [jumpDetectorMultiplier, setJumpDetectorMultiplier] = React.useState(initialConfig.jumpDetectorMultiplier);
    const [data, setData] = React.useState<DemoItem[]>(() => createItems(0, INITIAL_COUNT, initialConfig.multiplier));
    const jumpThreshold = Math.max(600, multiplier * jumpDetectorMultiplier);
    const { events, pxFromBottom, totalJumpCount } = useScrollJumpDetector(
        scrollNode,
        jumpThreshold,
        useWindowScroll,
        exampleVersion,
    );

    const resetExample = React.useCallback((nextMultiplier: number) => {
        oldestIdRef.current = 0;
        isReadyRef.current = false;
        isPrependingRef.current = false;
        setScrollNode(null);
        setPrependCount(0);
        setData(createItems(0, INITIAL_COUNT, nextMultiplier));
        setExampleVersion((value) => value + 1);
    }, []);

    React.useEffect(() => {
        writeConfigToUrl({ jumpDetectorMultiplier, multiplier, pageSize });
    }, [jumpDetectorMultiplier, multiplier, pageSize]);

    React.useEffect(() => {
        resetExample(multiplier);
    }, [multiplier, pageSize, resetExample]);

    React.useEffect(() => {
        if (!useWindowScroll || typeof window === "undefined") {
            return;
        }

        window.scrollTo({ behavior: "auto", top: 0 });
    }, [exampleVersion, useWindowScroll]);

    const prependPage = React.useCallback(() => {
        if (!isReadyRef.current || isPrependingRef.current) {
            return;
        }

        isPrependingRef.current = true;
        const nextStart = oldestIdRef.current - pageSize;
        oldestIdRef.current = nextStart;

        setPrependCount((value) => value + 1);
        setData((current) => [...createItems(nextStart, pageSize, multiplier), ...current]);

        requestAnimationFrame(() => {
            isPrependingRef.current = false;
        });
    }, [multiplier, pageSize]);

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

    const scrollLabel = useWindowScroll ? "page bottom" : "list bottom";
    const modeLabel = useWindowScroll ? "window scroll" : "scroll container";
    const outerStyle: React.CSSProperties = useWindowScroll
        ? { alignItems: "flex-start", display: "flex", gap: 16, paddingBottom: 32 }
        : { display: "flex", flex: 1, gap: 16, minHeight: 0 };
    const leftColumnStyle: React.CSSProperties = useWindowScroll
        ? { display: "flex", flex: 1, flexDirection: "column", gap: 12, minWidth: 0 }
        : { display: "flex", flex: 1, flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 };

    return (
        <div style={outerStyle}>
            <div style={leftColumnStyle}>
                <div
                    style={{
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: 16,
                        display: "flex",
                        flex: useWindowScroll ? undefined : 1,
                        minHeight: useWindowScroll ? undefined : 0,
                        padding: 12,
                        width: "100%",
                    }}
                >
                    <LegendList<DemoItem>
                        contentContainerStyle={{ padding: 8 }}
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
                        ref={listRef}
                        renderItem={({ item, index }: { item: DemoItem; index: number }) => (
                            <article
                                style={{
                                    background: item.color,
                                    border: "1px solid rgba(255, 255, 255, 0.12)",
                                    borderRadius: 14,
                                    color: "#f8fafc",
                                    marginBottom: 8,
                                    padding: "14px 16px",
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, opacity: 0.8 }}>
                                    row {index} / id {item.label}
                                </div>
                                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{item.text}</div>
                            </article>
                        )}
                        style={useWindowScroll ? { width: "100%" } : { flex: 1, minHeight: 0 }}
                        useWindowScroll={useWindowScroll}
                    />
                </div>
            </div>

            <aside
                style={{
                    alignSelf: "flex-start",
                    background: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: 16,
                    color: "#e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    maxHeight: useWindowScroll ? "calc(100vh - 16px)" : "100%",
                    minHeight: 0,
                    overflow: "hidden",
                    padding: 16,
                    position: useWindowScroll ? "sticky" : undefined,
                    top: useWindowScroll ? 16 : undefined,
                    width: 320,
                }}
            >
                <details
                    style={{
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: 12,
                        padding: 12,
                    }}
                >
                    <summary style={{ color: "#e2e8f0", cursor: "pointer", fontWeight: 700 }}>
                        Oversized prepend jump reproduction
                    </summary>
                    <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 10 }}>
                        <p style={{ margin: "0 0 8px" }}>
                            This version uses <code>{modeLabel}</code> and starts at the end like a chat. When{" "}
                            <code>onStartReached</code> prepends older messages, oversized rows can cause large jumps
                            because the current viewport sits inside a row whose top edge is already above the viewport.
                        </p>
                        <p style={{ margin: 0 }}>
                            Scroll toward the top and watch the detector log large position changes.
                        </p>
                    </div>
                </details>

                <label style={{ color: "#cbd5e1", display: "grid", fontSize: 14, gap: 6 }}>
                    <span>
                        page size: <strong>{pageSize}</strong>
                    </span>
                    <input
                        max={MAX_PAGE_SIZE}
                        min={MIN_PAGE_SIZE}
                        onChange={(event) => {
                            setPageSize(clamp(Number(event.target.value), MIN_PAGE_SIZE, MAX_PAGE_SIZE));
                        }}
                        type="range"
                        value={pageSize}
                    />
                </label>

                <label style={{ color: "#cbd5e1", display: "grid", fontSize: 14, gap: 6 }}>
                    <span>
                        content size multiplier: <strong>{multiplier}</strong>
                    </span>
                    <input
                        max={MAX_MULTIPLIER}
                        min={MIN_MULTIPLIER}
                        onChange={(event) => {
                            setMultiplier(clamp(Number(event.target.value), MIN_MULTIPLIER, MAX_MULTIPLIER));
                        }}
                        type="range"
                        value={multiplier}
                    />
                </label>

                <label style={{ color: "#cbd5e1", display: "grid", fontSize: 14, gap: 6 }}>
                    <span>
                        jump detector multiplier: <strong>{jumpDetectorMultiplier}</strong>
                    </span>
                    <input
                        max={MAX_JUMP_DETECTOR_MULTIPLIER}
                        min={MIN_JUMP_DETECTOR_MULTIPLIER}
                        onChange={(event) => {
                            setJumpDetectorMultiplier(
                                clamp(
                                    Number(event.target.value),
                                    MIN_JUMP_DETECTOR_MULTIPLIER,
                                    MAX_JUMP_DETECTOR_MULTIPLIER,
                                ),
                            );
                        }}
                        type="range"
                        value={jumpDetectorMultiplier}
                    />
                </label>

                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                    <button
                        onClick={() => {
                            setPageSize(20);
                            setMultiplier(10);
                            setJumpDetectorMultiplier(100);
                        }}
                        style={{
                            background: "#e2e8f0",
                            border: 0,
                            borderRadius: 10,
                            color: "#0f172a",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: 1.2,
                            padding: "10px 8px",
                        }}
                        type="button"
                    >
                        Medium content
                        <br />
                        big pages
                    </button>
                    <button
                        onClick={() => {
                            setPageSize(10);
                            setMultiplier(50);
                            setJumpDetectorMultiplier(100);
                        }}
                        style={{
                            background: "#e2e8f0",
                            border: 0,
                            borderRadius: 10,
                            color: "#0f172a",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: 1.2,
                            padding: "10px 8px",
                        }}
                        type="button"
                    >
                        Big content
                        <br />
                        medium pages
                    </button>
                </div>

                <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>Jump detector</div>
                    <div style={{ fontSize: 14 }}>
                        {Math.max(0, Math.round(pxFromBottom))} px from {scrollLabel}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>logs deltas larger than {jumpThreshold} px</div>
                </div>

                <div style={{ color: "#94a3b8", fontSize: 13 }}>
                    prepends triggered: <strong style={{ color: "#e2e8f0" }}>{prependCount}</strong>
                </div>

                <div style={{ color: "#94a3b8", fontSize: 13 }}>
                    jumps detected: <strong style={{ color: "#e2e8f0" }}>{totalJumpCount}</strong>
                </div>

                <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Recent jumps</div>
                    {events.length === 0 ? (
                        <div style={{ color: "#64748b", fontSize: 13 }}>No jumps detected yet.</div>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flex: 1,
                                flexDirection: "column",
                                gap: 8,
                                minHeight: 0,
                                overflow: "auto",
                            }}
                        >
                            {events.map((event, index) => (
                                <div
                                    key={event.id}
                                    style={{
                                        background: "rgba(15, 23, 42, 0.9)",
                                        border: "1px solid rgba(148, 163, 184, 0.2)",
                                        borderRadius: 10,
                                        display: "grid",
                                        gap: 10,
                                        gridTemplateColumns: "28px 1fr",
                                        padding: 10,
                                    }}
                                >
                                    <div
                                        style={{
                                            alignItems: "center",
                                            color: "#94a3b8",
                                            display: "flex",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            justifyContent: "center",
                                        }}
                                    >
                                        #{totalJumpCount - index}
                                    </div>
                                    <div>
                                        <div style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700 }}>
                                            {Math.round(event.deltaPx)} px jump
                                        </div>
                                        <div style={{ color: "#cbd5e1", fontSize: 12 }}>
                                            {Math.round(event.fromPx)} to {Math.round(event.toPx)} px from {scrollLabel}
                                        </div>
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
