import React from "react";
import { Virtuoso } from "react-virtuoso";
import { List, type RowComponentProps, useDynamicRowHeight } from "react-window";

import { LegendList } from "@legendapp/list/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { VList } from "virtua";
import {
    buildComparisonSearch,
    COMPARISON_LIBRARIES,
    type ComparisonLibraryId,
    type ComparisonSearchState,
    getComparisonLibraryRuntimeConfig,
    getVisibleComparisonLibraryIds,
    parseComparisonSearch,
} from "./comparisonConfig";

type DemoItem = {
    description: string;
    id: string;
    title: string;
};

type ComparisonPanelProps = {
    data: DemoItem[];
    extraNodes: number;
    workMs: number;
};

const ItemCardSpacing = 8;
const ReactWindowEstimatedSize = 140;
const PanelShellClassName = "h-[48rem] w-full min-w-0";

const generateData = (count: number): DemoItem[] =>
    Array.from({ length: count }, (_, index) => ({
        description: `This is the description for item ${index + 1}. It has some text to make it variable height. ${
            index % 3 === 0
                ? "This item has extra content to demonstrate variable heights in the virtualized list."
                : ""
        }`,
        id: `item-${index}`,
        title: `Item ${index + 1}`,
    }));

function getInitialComparisonState() {
    if (typeof window === "undefined") {
        return parseComparisonSearch("");
    }

    return parseComparisonSearch(window.location.search);
}

function doBusyWorkMs(milliseconds: number, seed: number) {
    if (!milliseconds) {
        return seed;
    }

    const start = performance.now();
    let accumulator = seed;

    while (performance.now() - start < milliseconds) {
        accumulator += Math.sqrt(accumulator + 0.0001) % 1.001;
        if (accumulator > 1e6) {
            accumulator = accumulator % 97;
        }
    }

    return accumulator;
}

const ItemCard: React.FC<{
    extraNodes: number;
    index: number;
    item: DemoItem;
    useMargin?: boolean;
    workMs: number;
}> = ({ extraNodes, index, item, useMargin = true, workMs }) => {
    doBusyWorkMs(workMs, index + 1);
    const nodes = Array.from({ length: extraNodes });

    return (
        <div
            className={`min-h-20 rounded-lg p-4 ${index % 2 === 0 ? "bg-[#f9f9f9]" : "bg-[#f3f3f3]"} ${
                useMargin ? "mb-2" : ""
            }`}
        >
            <div className="mb-2 text-base font-bold">{item.title}</div>
            <div className={`text-sm text-[#666] ${nodes.length ? "mb-2" : ""}`}>{item.description}</div>
            {nodes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {nodes.map((_, nodeIndex) => (
                        <span
                            className="rounded border border-[#ddd] bg-[#eaeaea] px-1.5 py-0.5 text-[11px]"
                            key={nodeIndex}
                        >
                            tag-{(index + nodeIndex) % 100}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

const Panel: React.FC<{
    children: React.ReactNode;
    title: string;
}> = ({ children, title }) => (
    <div
        className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#d8d8d8] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)] ${PanelShellClassName}`}
    >
        <div className="border-b border-[#ececec] bg-[#fcfcfc] px-4 py-3">
            <div className="text-sm font-semibold text-[#111]">{title}</div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3">{children}</div>
    </div>
);

type ReactWindowRowData = {
    data: DemoItem[];
    extraNodes: number;
    workMs: number;
};

type ReactWindowRowProps = RowComponentProps<ReactWindowRowData>;

function ReactWindowRow({ ariaAttributes, data, extraNodes, index, style, workMs }: ReactWindowRowProps) {
    const item = data[index];

    return (
        <div
            {...ariaAttributes}
            style={{
                ...style,
                boxSizing: "border-box",
                paddingBottom: ItemCardSpacing,
            }}
        >
            <ItemCard extraNodes={extraNodes} index={index} item={item} useMargin={false} workMs={workMs} />
        </div>
    );
}

function LegendListPanel({ data, extraNodes, workMs }: ComparisonPanelProps) {
    const runtime = getComparisonLibraryRuntimeConfig("legend-list");

    return (
        <Panel title="LegendList">
            <LegendList
                className="h-full min-h-0"
                data={data}
                drawDistance={runtime.drawDistance}
                extraData={{ example: "comparison" }}
                keyExtractor={(item: DemoItem) => item.id}
                recycleItems
                renderItem={({ item, index }: { index: number; item: DemoItem }) => (
                    <ItemCard extraNodes={extraNodes} index={index} item={item} workMs={workMs} />
                )}
            />
        </Panel>
    );
}

function VirtuaPanel({ data, extraNodes, workMs }: ComparisonPanelProps) {
    const runtime = getComparisonLibraryRuntimeConfig("virtua");

    return (
        <Panel title="virtua">
            <VList count={data.length} overscan={runtime.overscan} style={{ height: "100%" }}>
                {(index) => <ItemCard extraNodes={extraNodes} index={index} item={data[index]} workMs={workMs} />}
            </VList>
        </Panel>
    );
}

function VirtuosoPanel({ data, extraNodes, workMs }: ComparisonPanelProps) {
    const runtime = getComparisonLibraryRuntimeConfig("react-virtuoso");

    return (
        <Panel title="react-virtuoso">
            <Virtuoso
                data={data}
                increaseViewportBy={runtime.increaseViewportBy}
                itemContent={(index, item) => (
                    <ItemCard extraNodes={extraNodes} index={index} item={item as DemoItem} workMs={workMs} />
                )}
                style={{ height: "100%" }}
            />
        </Panel>
    );
}

function ReactWindowPanel({ data, extraNodes, workMs }: ComparisonPanelProps) {
    const runtime = getComparisonLibraryRuntimeConfig("react-window");
    const rowHeight = useDynamicRowHeight({
        defaultRowHeight: ReactWindowEstimatedSize,
        key: `${data.length}-${extraNodes}`,
    });

    return (
        <Panel title="react-window">
            <List
                overscanCount={runtime.overscanCount}
                rowComponent={ReactWindowRow}
                rowCount={data.length}
                rowHeight={rowHeight}
                rowProps={{ data, extraNodes, workMs }}
                style={{ height: "100%" }}
            />
        </Panel>
    );
}

function TanStackVirtualPanel({ data, extraNodes, workMs }: ComparisonPanelProps) {
    const parentRef = React.useRef<HTMLDivElement | null>(null);
    const runtime = getComparisonLibraryRuntimeConfig("tanstack-virtual");
    const rowVirtualizer = useVirtualizer({
        count: data.length,
        estimateSize: () => 100,
        getScrollElement: () => parentRef.current,
        overscan: runtime.overscan,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
        <Panel title="TanStack Virtual">
            <div
                className="relative min-h-0 flex-1 overflow-auto"
                ref={parentRef}
                style={{ contain: "size layout paint", height: "100%" }}
            >
                <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
                    {virtualItems.map((virtualRow) => {
                        const index = virtualRow.index;
                        const item = data[index];
                        return (
                            <div
                                className="absolute left-0 top-0 w-full"
                                data-index={index}
                                key={virtualRow.key}
                                ref={rowVirtualizer.measureElement}
                                style={{
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <ItemCard extraNodes={extraNodes} index={index} item={item} workMs={workMs} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </Panel>
    );
}

const PANEL_COMPONENTS: Record<ComparisonLibraryId, React.ComponentType<ComparisonPanelProps>> = {
    "legend-list": LegendListPanel,
    "react-virtuoso": VirtuosoPanel,
    "react-window": ReactWindowPanel,
    "tanstack-virtual": TanStackVirtualPanel,
    virtua: VirtuaPanel,
};

export default function VirtualListComparison() {
    const [searchState, setSearchState] = React.useState<ComparisonSearchState>(() => getInitialComparisonState());
    const { count, extraNodes, librarySelection, workMs } = searchState;

    const data = React.useMemo(() => generateData(count), [count]);
    const visibleLibraryIds = React.useMemo(() => getVisibleComparisonLibraryIds(librarySelection), [librarySelection]);

    React.useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const nextSearch = buildComparisonSearch(searchState);
        const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        if (nextUrl !== currentUrl) {
            window.history.replaceState(null, "", nextUrl);
        }
    }, [searchState]);

    const updateSearchState = React.useCallback((partialState: Partial<ComparisonSearchState>) => {
        setSearchState((currentSearchState) => ({
            ...currentSearchState,
            ...partialState,
        }));
    }, []);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 pb-2">
            <div className="rounded-2xl border border-[#d7d7d7] bg-white px-4 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
                <div className="flex items-start justify-between gap-1.5">
                    <div className="max-w-3xl">
                        <h1 className="text-xl font-bold text-[#111]">Library Benchmark</h1>
                    </div>
                </div>

                <div className="mt-1.5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-[#888]">Library</span>
                        <select
                            className="rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#111]"
                            onChange={(event) =>
                                updateSearchState({
                                    librarySelection: event.target.value as ComparisonSearchState["librarySelection"],
                                })
                            }
                            value={librarySelection}
                        >
                            <option value="all">All Libraries</option>
                            {COMPARISON_LIBRARIES.map((library) => (
                                <option key={library.id} value={library.id}>
                                    {library.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-[#888]">CPU Work / Item</span>
                        <input
                            className="w-full"
                            max={12}
                            min={0}
                            onChange={(event) =>
                                updateSearchState({
                                    workMs: Number(event.target.value) || 0,
                                })
                            }
                            type="range"
                            value={workMs}
                        />
                        <span className="text-sm text-[#666]">{workMs} ms</span>
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-[#888]">Extra DOM Nodes</span>
                        <input
                            className="w-full"
                            max={60}
                            min={0}
                            onChange={(event) =>
                                updateSearchState({
                                    extraNodes: Number(event.target.value) || 0,
                                })
                            }
                            type="range"
                            value={extraNodes}
                        />
                        <span className="text-sm text-[#666]">{extraNodes}</span>
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-[#888]">Items</span>
                        <input
                            className="rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#111]"
                            min={5000}
                            onChange={(event) =>
                                updateSearchState({
                                    count: Math.max(0, Number(event.target.value) || 0),
                                })
                            }
                            type="number"
                            value={count}
                        />
                    </label>
                </div>
            </div>

            <div className="grid gap-3 pb-4 [grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))]">
                {visibleLibraryIds.map((libraryId) => {
                    const PanelComponent = PANEL_COMPONENTS[libraryId];
                    return <PanelComponent data={data} extraNodes={extraNodes} key={libraryId} workMs={workMs} />;
                })}
            </div>
        </div>
    );
}
