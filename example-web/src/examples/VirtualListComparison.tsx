import React, { useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { List, type RowComponentProps, useDynamicRowHeight } from "react-window";

import { LegendList } from "@legendapp/list/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { VList } from "virtua";

type DemoItem = {
    id: string;
    title: string;
    description: string;
};

const Height = 520;
const ItemCardSpacing = 8;

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

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#ccc]">
        <div className="border-b border-[#e0e0e0] bg-[#f5f5f5] p-3 font-semibold">{title}</div>
        <div className="min-h-0 flex-1">{children}</div>
    </div>
);

function doBusyWorkMs(milliseconds: number, seed: number) {
    if (!milliseconds) return;
    const start = performance.now();
    // Add some math so engines cannot optimize the loop away easily
    let accumulator = seed;
    while (performance.now() - start < milliseconds) {
        accumulator += Math.sqrt(accumulator + 0.0001) % 1.001;
        if (accumulator > 1e6) accumulator = accumulator % 97;
    }
    return accumulator;
}

const ItemCard: React.FC<{
    item: DemoItem;
    index: number;
    workMs: number;
    extraNodes: number;
    useMargin?: boolean;
}> = ({ item, index, workMs, extraNodes, useMargin = true }) => {
    // Simulate CPU work on render
    doBusyWorkMs(workMs, index + 1);

    // Create extra DOM nodes to increase layout/paint load
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
                    {nodes.map((_, i) => (
                        <span className="rounded border border-[#ddd] bg-[#eaeaea] px-1.5 py-0.5 text-[11px]" key={i}>
                            tag-{(index + i) % 100}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function VirtualListComparison() {
    const [count, setCount] = React.useState(10000);
    const [workMs, setWorkMs] = React.useState(5);
    const [extraNodes, setExtraNodes] = React.useState(5);

    const data = React.useMemo(() => generateData(count), [count]);

    const start = performance.now();
    useEffect(() => {
        console.log("start time", performance.now() - start);
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <div className="text-[#555]">
                Side-by-side comparison of five popular virtual list solutions rendering the same dataset. Use the
                controls to increase per-item work and DOM complexity to reveal performance differences.
            </div>

            <div className="grid grid-cols-6 items-center gap-3 rounded-lg border border-[#eee] bg-[#fafafa] p-3">
                <label className="col-span-2">
                    <div className="mb-1.5 font-semibold">Items</div>
                    <input
                        className="w-full"
                        min={10}
                        onChange={(e) => setCount(Number(e.target.value) || 0)}
                        type="number"
                        value={count}
                    />
                </label>
                <label className="col-span-2">
                    <div className="mb-1.5 font-semibold">CPU work per item (ms)</div>
                    <input
                        className="w-full"
                        max={20}
                        min={0}
                        onChange={(e) => setWorkMs(Number(e.target.value) || 0)}
                        type="range"
                        value={workMs}
                    />
                    <div className="mt-1 text-xs text-[#666]">{workMs} ms</div>
                </label>
                <label className="col-span-2">
                    <div className="mb-1.5 font-semibold">Extra DOM nodes per item</div>
                    <input
                        className="w-full"
                        max={150}
                        min={0}
                        onChange={(e) => setExtraNodes(Number(e.target.value) || 0)}
                        type="range"
                        value={extraNodes}
                    />
                    <div className="mt-1 text-xs text-[#666]">{extraNodes}</div>
                </label>
            </div>

            <div className="grid min-h-0 grid-cols-5 items-stretch gap-4">
                <Panel title="LegendList">
                    <div className="h-[520px] min-h-0">
                        <LegendList
                            className="h-[520px] min-h-0"
                            data={data}
                            drawDistance={500}
                            extraData={{ example: "comparison" }}
                            // estimatedItemSize={200}
                            keyExtractor={(item: DemoItem) => {
                                return item.id;
                            }}
                            recycleItems
                            renderItem={({ item, index }: { item: DemoItem; index: number }) => (
                                <ItemCard extraNodes={extraNodes} index={index} item={item} workMs={workMs} />
                            )}
                        />
                    </div>
                </Panel>

                <Panel title="virtua (VList)">
                    <div className="h-[520px]">
                        <VList style={{ height: Height }}>
                            {data.map((item, index) => (
                                <ItemCard
                                    extraNodes={extraNodes}
                                    index={index}
                                    item={item}
                                    key={item.id}
                                    workMs={workMs}
                                />
                            ))}
                        </VList>
                    </div>
                </Panel>

                <Panel title="react-virtuoso">
                    <div className="h-[520px]">
                        <Virtuoso
                            data={data}
                            itemContent={(index, item) => (
                                <ItemCard
                                    extraNodes={extraNodes}
                                    index={index}
                                    item={item as DemoItem}
                                    workMs={workMs}
                                />
                            )}
                            style={{ height: Height }}
                        />
                    </div>
                </Panel>

                <Panel title="react-window">
                    <div className="h-[520px]">
                        <ReactWindowPanel data={data} extraNodes={extraNodes} height={Height} workMs={workMs} />
                    </div>
                </Panel>

                <Panel title="TanStack Virtual">
                    <TanStackVirtualPanel data={data} extraNodes={extraNodes} height={Height} workMs={workMs} />
                </Panel>
            </div>
        </div>
    );
}

const ReactWindowEstimatedSize = 140;

type ReactWindowRowData = {
    data: DemoItem[];
    workMs: number;
    extraNodes: number;
};

type ReactWindowRowProps = RowComponentProps<ReactWindowRowData>;

function ReactWindowPanel({
    data,
    workMs,
    extraNodes,
    height,
}: {
    data: DemoItem[];
    workMs: number;
    extraNodes: number;
    height: number | string;
}) {
    const rowHeight = useDynamicRowHeight({
        defaultRowHeight: ReactWindowEstimatedSize,
        key: `${data.length}-${extraNodes}`,
    });

    return (
        <List
            overscanCount={10}
            rowComponent={ReactWindowRow}
            rowCount={data.length}
            rowHeight={rowHeight}
            rowProps={{ data, extraNodes, workMs }}
            style={{ height }}
        />
    );
}

function ReactWindowRow({ ariaAttributes, index, style, data, extraNodes, workMs }: ReactWindowRowProps) {
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

function TanStackVirtualPanel({
    data,
    workMs,
    extraNodes,
    height,
}: {
    data: DemoItem[];
    workMs: number;
    extraNodes: number;
    height: number | string;
}) {
    const parentRef = React.useRef<HTMLDivElement | null>(null);
    const rowVirtualizer = useVirtualizer({
        count: data.length,
        estimateSize: () => 100,
        getScrollElement: () => parentRef.current,
        overscan: 10,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
        <div className="relative overflow-auto" ref={parentRef} style={{ contain: "size layout paint", height }}>
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
    );
}
