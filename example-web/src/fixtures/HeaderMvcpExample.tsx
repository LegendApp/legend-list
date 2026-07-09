import React from "react";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react";

type RowItem = {
    id: string;
    title: string;
};

const ROW_HEIGHT = 72;
const INITIAL_HEADER_HEIGHT = 96;
const ANCHOR_ROW_INDEX = 20;
const DATA: RowItem[] = Array.from({ length: 80 }, (_, index) => ({
    id: String(index),
    title: `Row ${index}`,
}));

function Header({ height }: { height: number }) {
    return (
        <div
            className="flex items-center justify-between border-b border-[#bfdbfe] bg-[#dbeafe] px-5 text-[#1e3a8a]"
            style={{ height }}
        >
            <div>
                <div className="text-sm font-semibold">Measured ListHeaderComponent</div>
                <div className="text-xs">height: {height}px</div>
            </div>
            <div className="rounded bg-white/70 px-3 py-1 text-xs">Above the rows</div>
        </div>
    );
}

function Row({ index, item }: LegendListRenderItemProps<RowItem>) {
    const palette = ["#f8fafc", "#eef2ff", "#ecfeff", "#fefce8"];

    return (
        <div
            className="flex items-center justify-between border-b border-[#dbe3ef] px-5 text-[#0f172a]"
            style={{ background: palette[index % palette.length], height: ROW_HEIGHT }}
        >
            <span className="font-medium">{item.title}</span>
            <span className="text-xs text-[#64748b]">fixed {ROW_HEIGHT}px</span>
        </div>
    );
}

export default function HeaderMvcpExample() {
    const listRef = React.useRef<LegendListRef | null>(null);
    const [headerHeight, setHeaderHeight] = React.useState(INITIAL_HEADER_HEIGHT);
    const [headerEnabled, setHeaderEnabled] = React.useState(true);
    const [scrollNode, setScrollNode] = React.useState<HTMLElement | null>(null);
    const [scrollTop, setScrollTop] = React.useState(0);

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
    }, []);

    React.useEffect(() => {
        if (!scrollNode) {
            return;
        }

        const updateScrollTop = () => {
            setScrollTop(scrollNode.scrollTop);
        };

        updateScrollTop();
        scrollNode.addEventListener("scroll", updateScrollTop, { passive: true });

        return () => {
            scrollNode.removeEventListener("scroll", updateScrollTop);
        };
    }, [scrollNode]);

    const scrollPastHeader = () => {
        listRef.current?.scrollToIndex({ animated: false, index: ANCHOR_ROW_INDEX, viewPosition: 0 });
    };

    const scrollToTop = () => {
        listRef.current?.scrollToOffset({ animated: false, offset: 0 });
    };

    const toggleHeader = () => {
        setHeaderEnabled((value) => !value);
    };

    return (
        <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#cbd5e1] bg-white">
                <LegendList<RowItem>
                    className="min-h-0 flex-1"
                    data={DATA}
                    estimatedItemSize={ROW_HEIGHT}
                    initialScrollIndex={ANCHOR_ROW_INDEX}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={headerEnabled ? <Header height={headerHeight} /> : null}
                    maintainVisibleContentPosition={{ data: false, size: true }}
                    recycleItems
                    ref={listRef}
                    renderItem={(props) => <Row {...props} />}
                />
            </div>

            <div className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-4">
                <div>
                    <div className="text-sm font-semibold text-[#0f172a]">Header MVCP</div>
                    <div className="mt-1 text-xs text-[#64748b]">scrollTop: {Math.round(scrollTop)}px</div>
                </div>

                <button onClick={scrollPastHeader} type="button">
                    Put header above viewport
                </button>
                <button onClick={scrollToTop} type="button">
                    Show header
                </button>
                <button onClick={() => setHeaderHeight((value) => value + 80)} type="button">
                    Grow header
                </button>
                <button onClick={() => setHeaderHeight((value) => Math.max(24, value - 80))} type="button">
                    Shrink header
                </button>
                <button onClick={toggleHeader} type="button">
                    {headerEnabled ? "Remove header" : "Insert header"}
                </button>
                <button
                    onClick={() => {
                        setHeaderEnabled(true);
                        setHeaderHeight(INITIAL_HEADER_HEIGHT);
                    }}
                    type="button"
                >
                    Reset header
                </button>
            </div>
        </div>
    );
}
