import React, { useEffect } from "react";
import { Virtuoso } from "react-virtuoso";

import { LegendList } from "@legendapp/list";
import { useVirtualizer } from "@tanstack/react-virtual";
import { VList } from "virtua";

type DemoItem = {
    id: string;
    title: string;
    description: string;
};

const Height = 520;

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
    <div
        style={{
            border: "1px solid #ccc",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
        }}
    >
        <div
            style={{
                backgroundColor: "#f5f5f5",
                borderBottom: "1px solid #e0e0e0",
                fontWeight: 600,
                padding: 12,
            }}
        >
            {title}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
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

const ItemCard: React.FC<{ item: DemoItem; index: number; workMs: number; extraNodes: number }> = ({
    item,
    index,
    workMs,
    extraNodes,
}) => {
    // Simulate CPU work on render
    doBusyWorkMs(workMs, index + 1);

    // Create extra DOM nodes to increase layout/paint load
    const nodes = Array.from({ length: extraNodes });

    return (
        <div
            style={{
                backgroundColor: index % 2 === 0 ? "#f9f9f9" : "#f3f3f3",
                borderRadius: 8,
                marginBottom: 8,
                minHeight: 80,
                padding: 16,
            }}
        >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{item.title}</div>
            <div style={{ color: "#666", fontSize: 14, marginBottom: nodes.length ? 8 : 0 }}>{item.description}</div>
            {nodes.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {nodes.map((_, i) => (
                        <span
                            key={i}
                            style={{
                                background: "#eaeaea",
                                border: "1px solid #ddd",
                                borderRadius: 4,
                                fontSize: 11,
                                padding: "2px 6px",
                            }}
                        >
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ color: "#555" }}>
                Side-by-side comparison of four popular virtual list solutions rendering the same dataset. Use the
                controls to increase per-item work and DOM complexity to reveal performance differences.
            </div>

            <div
                style={{
                    alignItems: "center",
                    background: "#fafafa",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                    padding: 12,
                }}
            >
                <label style={{ gridColumn: "span 2" }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Items</div>
                    <input
                        min={10}
                        onChange={(e) => setCount(Number(e.target.value) || 0)}
                        style={{ width: "100%" }}
                        type="number"
                        value={count}
                    />
                </label>
                <label style={{ gridColumn: "span 2" }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>CPU work per item (ms)</div>
                    <input
                        max={20}
                        min={0}
                        onChange={(e) => setWorkMs(Number(e.target.value) || 0)}
                        style={{ width: "100%" }}
                        type="range"
                        value={workMs}
                    />
                    <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>{workMs} ms</div>
                </label>
                <label style={{ gridColumn: "span 2" }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Extra DOM nodes per item</div>
                    <input
                        max={150}
                        min={0}
                        onChange={(e) => setExtraNodes(Number(e.target.value) || 0)}
                        style={{ width: "100%" }}
                        type="range"
                        value={extraNodes}
                    />
                    <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>{extraNodes}</div>
                </label>
            </div>

            <div
                style={{
                    alignItems: "stretch",
                    display: "grid",
                    gap: 16,
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    minHeight: 0,
                }}
            >
                <Panel title="LegendList">
                    <div style={{ height: Height, minHeight: 0 }}>
                        <LegendList
                            data={data}
                            drawDistance={500}
                            extraData={{ example: "comparison" }}
                            // estimatedItemSize={200}
                            keyExtractor={(item: DemoItem) => {
                                if (!item) {
                                    debugger;
                                }
                                return item.id;
                            }}
                            recycleItems
                            renderItem={({ item, index }: { item: DemoItem; index: number }) => (
                                <ItemCard extraNodes={extraNodes} index={index} item={item} workMs={workMs} />
                            )}
                            style={{ height: Height, minHeight: 0 }}
                            waitForInitialLayout={false}
                        />
                    </div>
                </Panel>

                <Panel title="virtua (VList)">
                    <div style={{ height: Height }}>
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
                    <div style={{ height: Height }}>
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

                <Panel title="TanStack Virtual">
                    <TanStackVirtualPanel data={data} extraNodes={extraNodes} height={Height} workMs={workMs} />
                </Panel>
            </div>
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
        <div ref={parentRef} style={{ contain: "size layout paint", height, overflow: "auto", position: "relative" }}>
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                {virtualItems.map((virtualRow) => {
                    const index = virtualRow.index;
                    const item = data[index];
                    return (
                        <div
                            data-index={index}
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            style={{
                                left: 0,
                                position: "absolute",
                                top: 0,
                                transform: `translateY(${virtualRow.start}px)`,
                                width: "100%",
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
