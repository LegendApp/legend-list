import React from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { List, type ListImperativeAPI, type RowComponentProps, useDynamicRowHeight } from "react-window";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { VList, type VListHandle } from "virtua";
import {
    BENCHMARK_LIBRARIES,
    type BenchmarkLibraryId,
    type BenchmarkLibrarySelection,
    type BenchmarkScenarioId,
    type BenchmarkScenarioStep,
    buildBenchmarkScenarioSteps,
    getBenchmarkLibraryMeta,
    getBenchmarkScenarioBudgetMs,
    getBenchmarkScenarioDefinition,
    getBenchmarkScenarioOptions,
    getVisibleBenchmarkLibraryIds,
} from "./benchmarkConfig";

type DemoItem = {
    description: string;
    id: string;
    title: string;
};

type BenchmarkController = {
    scrollToIndex: (step: BenchmarkScenarioStep) => Promise<void> | void;
};

type BenchmarkResult = {
    avgFrameMs: number;
    budgetMs: number;
    elapsedMs: number;
    longFrames: number;
    maxFrameMs: number;
    stepCount: number;
};

type BenchmarkPanelProps = {
    data: DemoItem[];
    extraNodes: number;
    isRunning: boolean;
    registerController: (controller: BenchmarkController | null) => void;
    workMs: number;
};

const Height = 640;
const ItemCardSpacing = 8;
const LongFrameThresholdMs = 24;
const ReactWindowEstimatedSize = 140;
const RunSummaryHeightClassName = "min-h-[11.5rem]";
const PanelShellClassName = "h-[48rem] w-full max-w-[32rem]";

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

function waitMs(milliseconds: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

function waitForPaints(frames = 1) {
    return new Promise<void>((resolve) => {
        let remainingFrames = frames;

        function handleFrame() {
            remainingFrames -= 1;
            if (remainingFrames <= 0) {
                resolve();
                return;
            }
            window.requestAnimationFrame(handleFrame);
        }

        window.requestAnimationFrame(handleFrame);
    });
}

function startFrameTracker() {
    let frameCount = 0;
    let lastFrameTime = performance.now();
    let maxFrameMs = 0;
    let totalFrameMs = 0;
    let longFrames = 0;
    let rafId = 0;
    let active = true;

    function trackFrame(now: number) {
        if (!active) {
            return;
        }

        const delta = now - lastFrameTime;
        lastFrameTime = now;

        if (frameCount > 0) {
            totalFrameMs += delta;
            maxFrameMs = Math.max(maxFrameMs, delta);
            if (delta >= LongFrameThresholdMs) {
                longFrames += 1;
            }
        }

        frameCount += 1;
        rafId = window.requestAnimationFrame(trackFrame);
    }

    rafId = window.requestAnimationFrame(trackFrame);

    return () => {
        active = false;
        window.cancelAnimationFrame(rafId);

        const measuredFrameCount = Math.max(frameCount - 1, 0);

        return {
            avgFrameMs: measuredFrameCount > 0 ? totalFrameMs / measuredFrameCount : 0,
            longFrames,
            maxFrameMs,
        };
    };
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
    description: string;
    running: boolean;
    title: string;
}> = ({ children, description, running, title }) => (
    <div
        className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#d8d8d8] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)] ${PanelShellClassName}`}
    >
        <div className="border-b border-[#ececec] bg-[#fcfcfc] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-[#111]">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-[#777]">{description}</div>
                </div>
                <div
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        running ? "bg-[#0f766e15] text-[#0f766e]" : "bg-[#1111110d] text-[#666]"
                    }`}
                >
                    {running ? "Running" : "Ready"}
                </div>
            </div>
        </div>
        <div className="min-h-0 flex-1 p-3">{children}</div>
    </div>
);

function formatMs(value: number) {
    return value.toFixed(value >= 100 ? 0 : 1);
}

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

function LegendListPanel({ data, extraNodes, isRunning, registerController, workMs }: BenchmarkPanelProps) {
    const listRef = React.useRef<LegendListRef | null>(null);

    React.useEffect(() => {
        registerController({
            scrollToIndex: (step) =>
                listRef.current?.scrollToIndex({
                    animated: false,
                    index: step.index,
                    viewPosition: step.align === "center" ? 0.5 : step.align === "end" ? 1 : 0,
                }),
        });

        return () => registerController(null);
    }, [registerController]);

    return (
        <Panel description={getBenchmarkLibraryMeta("legend-list").description} running={isRunning} title="LegendList">
            <LegendList
                className="h-full min-h-0"
                data={data}
                drawDistance={500}
                extraData={{ example: "benchmark" }}
                keyExtractor={(item: DemoItem) => item.id}
                recycleItems
                ref={listRef}
                renderItem={({ item, index }: { index: number; item: DemoItem }) => (
                    <ItemCard extraNodes={extraNodes} index={index} item={item} workMs={workMs} />
                )}
            />
        </Panel>
    );
}

function VirtuaPanel({ data, extraNodes, isRunning, registerController, workMs }: BenchmarkPanelProps) {
    const listRef = React.useRef<VListHandle | null>(null);

    React.useEffect(() => {
        registerController({
            scrollToIndex: (step) => {
                listRef.current?.scrollToIndex(step.index, { align: step.align });
            },
        });

        return () => registerController(null);
    }, [registerController]);

    return (
        <Panel description={getBenchmarkLibraryMeta("virtua").description} running={isRunning} title="virtua">
            <VList count={data.length} ref={listRef} style={{ height: Height }}>
                {(index) => <ItemCard extraNodes={extraNodes} index={index} item={data[index]} workMs={workMs} />}
            </VList>
        </Panel>
    );
}

function VirtuosoPanel({ data, extraNodes, isRunning, registerController, workMs }: BenchmarkPanelProps) {
    const listRef = React.useRef<VirtuosoHandle | null>(null);

    React.useEffect(() => {
        registerController({
            scrollToIndex: (step) => {
                listRef.current?.scrollToIndex({
                    align: step.align,
                    index: step.index,
                });
            },
        });

        return () => registerController(null);
    }, [registerController]);

    return (
        <Panel
            description={getBenchmarkLibraryMeta("react-virtuoso").description}
            running={isRunning}
            title="react-virtuoso"
        >
            <Virtuoso
                data={data}
                itemContent={(index, item) => (
                    <ItemCard extraNodes={extraNodes} index={index} item={item as DemoItem} workMs={workMs} />
                )}
                ref={listRef}
                style={{ height: Height }}
            />
        </Panel>
    );
}

function ReactWindowPanel({ data, extraNodes, isRunning, registerController, workMs }: BenchmarkPanelProps) {
    const listRef = React.useRef<ListImperativeAPI | null>(null);
    const rowHeight = useDynamicRowHeight({
        defaultRowHeight: ReactWindowEstimatedSize,
        key: `${data.length}-${extraNodes}`,
    });

    React.useEffect(() => {
        registerController({
            scrollToIndex: (step) => {
                listRef.current?.scrollToRow({
                    align: step.align,
                    behavior: "instant",
                    index: step.index,
                });
            },
        });

        return () => registerController(null);
    }, [registerController]);

    return (
        <Panel
            description={getBenchmarkLibraryMeta("react-window").description}
            running={isRunning}
            title="react-window"
        >
            <List
                listRef={listRef}
                overscanCount={10}
                rowComponent={ReactWindowRow}
                rowCount={data.length}
                rowHeight={rowHeight}
                rowProps={{ data, extraNodes, workMs }}
                style={{ height: Height }}
            />
        </Panel>
    );
}

function TanStackVirtualPanel({ data, extraNodes, isRunning, registerController, workMs }: BenchmarkPanelProps) {
    const parentRef = React.useRef<HTMLDivElement | null>(null);
    const rowVirtualizer = useVirtualizer({
        count: data.length,
        estimateSize: () => 100,
        getScrollElement: () => parentRef.current,
        overscan: 10,
    });

    React.useEffect(() => {
        registerController({
            scrollToIndex: (step) => {
                rowVirtualizer.scrollToIndex(step.index, { align: step.align });
            },
        });

        return () => registerController(null);
    }, [registerController, rowVirtualizer]);

    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
        <Panel
            description={getBenchmarkLibraryMeta("tanstack-virtual").description}
            running={isRunning}
            title="TanStack Virtual"
        >
            <div
                className="relative overflow-auto"
                ref={parentRef}
                style={{ contain: "size layout paint", height: Height }}
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

const PANEL_COMPONENTS: Record<BenchmarkLibraryId, React.ComponentType<BenchmarkPanelProps>> = {
    "legend-list": LegendListPanel,
    "react-virtuoso": VirtuosoPanel,
    "react-window": ReactWindowPanel,
    "tanstack-virtual": TanStackVirtualPanel,
    virtua: VirtuaPanel,
};

export default function VirtualListComparison() {
    const [count, setCount] = React.useState(4000);
    const [workMs, setWorkMs] = React.useState(1);
    const [extraNodes, setExtraNodes] = React.useState(6);
    const [librarySelection, setLibrarySelection] = React.useState<BenchmarkLibrarySelection>("all");
    const [scenarioId, setScenarioId] = React.useState<BenchmarkScenarioId>("jump-tour");
    const [results, setResults] = React.useState<Partial<Record<BenchmarkLibraryId, BenchmarkResult>>>({});
    const [activeRunLibraryId, setActiveRunLibraryId] = React.useState<BenchmarkLibraryId | null>(null);
    const [lastCompletedAt, setLastCompletedAt] = React.useState<string | null>(null);
    const [runError, setRunError] = React.useState<string | null>(null);
    const controllerMapRef = React.useRef<Partial<Record<BenchmarkLibraryId, BenchmarkController>>>({});
    const isRunning = activeRunLibraryId !== null;

    const data = React.useMemo(() => generateData(count), [count]);
    const scenario = React.useMemo(() => getBenchmarkScenarioDefinition(scenarioId), [scenarioId]);
    const visibleLibraryIds = React.useMemo(() => getVisibleBenchmarkLibraryIds(librarySelection), [librarySelection]);

    React.useEffect(() => {
        setResults({});
        setRunError(null);
        setLastCompletedAt(null);
    }, [count, extraNodes, librarySelection, scenarioId, workMs]);

    const setController = React.useCallback((libraryId: BenchmarkLibraryId, controller: BenchmarkController | null) => {
        if (controller) {
            controllerMapRef.current[libraryId] = controller;
            return;
        }

        delete controllerMapRef.current[libraryId];
    }, []);

    const runAutomatedBenchmark = React.useCallback(async () => {
        const steps = buildBenchmarkScenarioSteps(scenarioId, data.length);
        const budgetMs = getBenchmarkScenarioBudgetMs(scenarioId, data.length);
        const libraryIds = getVisibleBenchmarkLibraryIds(librarySelection);

        setResults({});
        setRunError(null);
        setLastCompletedAt(null);

        try {
            for (const libraryId of libraryIds) {
                const controller = controllerMapRef.current[libraryId];
                if (!controller) {
                    throw new Error(`${getBenchmarkLibraryMeta(libraryId).label} is not mounted yet.`);
                }

                setActiveRunLibraryId(libraryId);

                await Promise.resolve(
                    controller.scrollToIndex({
                        align: "start",
                        index: 0,
                        label: "Warm reset",
                        pauseMs: 0,
                    }),
                );
                await waitForPaints(3);

                const stopTracking = startFrameTracker();
                const startedAt = performance.now();

                for (const step of steps) {
                    await Promise.resolve(controller.scrollToIndex(step));
                    await waitForPaints(2);
                    if (step.pauseMs > 0) {
                        await waitMs(step.pauseMs);
                    }
                }

                await waitMs(scenario.settleMs);

                const elapsedMs = performance.now() - startedAt;
                const frameStats = stopTracking();

                setResults((currentResults) => ({
                    ...currentResults,
                    [libraryId]: {
                        avgFrameMs: frameStats.avgFrameMs,
                        budgetMs,
                        elapsedMs,
                        longFrames: frameStats.longFrames,
                        maxFrameMs: frameStats.maxFrameMs,
                        stepCount: steps.length,
                    },
                }));
            }

            setLastCompletedAt(new Date().toLocaleTimeString());
        } catch (error) {
            setRunError(error instanceof Error ? error.message : String(error));
        } finally {
            setActiveRunLibraryId(null);
        }
    }, [data.length, librarySelection, scenario, scenarioId]);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-5 pb-4">
            <div className="rounded-2xl border border-[#d7d7d7] bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
                <div className="flex items-start justify-between gap-4">
                    <div className="max-w-3xl">
                        <h1 className="text-3xl font-bold text-[#111]">Library Benchmark</h1>
                        <p className="mt-3 text-sm leading-6 text-[#666]">
                            This page keeps every list in its own bounded panel so the automated benchmark stays
                            comparable. Pick a single library for isolated numbers or choose all libraries to keep a
                            public side-by-side dashboard visible while the same scripted scenario runs across each
                            implementation in sequence.
                        </p>
                    </div>
                    <button
                        className={`rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap text-white ${
                            isRunning ? "cursor-default bg-[#9ca3af]" : "bg-[#0f172a] hover:bg-[#111827]"
                        }`}
                        disabled={isRunning}
                        onClick={() => {
                            void runAutomatedBenchmark();
                        }}
                        type="button"
                    >
                        {isRunning
                            ? `Running ${getBenchmarkLibraryMeta(activeRunLibraryId!).label}`
                            : "Run Automated Benchmark"}
                    </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-[#888]">Library</span>
                        <select
                            className="rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#111]"
                            onChange={(event) => setLibrarySelection(event.target.value as BenchmarkLibrarySelection)}
                            value={librarySelection}
                        >
                            <option value="all">All Libraries</option>
                            {BENCHMARK_LIBRARIES.map((library) => (
                                <option key={library.id} value={library.id}>
                                    {library.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-[#888]">Scenario</span>
                        <select
                            className="rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#111]"
                            onChange={(event) => setScenarioId(event.target.value as BenchmarkScenarioId)}
                            value={scenarioId}
                        >
                            {getBenchmarkScenarioOptions().map((scenarioOption) => (
                                <option key={scenarioOption.id} value={scenarioOption.id}>
                                    {scenarioOption.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-[#888]">Items</span>
                        <input
                            className="rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#111]"
                            min={50}
                            onChange={(event) => setCount(Math.max(0, Number(event.target.value) || 0))}
                            type="number"
                            value={count}
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-[#888]">CPU Work / Item</span>
                        <input
                            className="w-full"
                            max={12}
                            min={0}
                            onChange={(event) => setWorkMs(Number(event.target.value) || 0)}
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
                            onChange={(event) => setExtraNodes(Number(event.target.value) || 0)}
                            type="range"
                            value={extraNodes}
                        />
                        <span className="text-sm text-[#666]">{extraNodes}</span>
                    </label>
                </div>

                <div
                    className={`mt-4 grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] ${RunSummaryHeightClassName}`}
                >
                    <div className={`rounded-xl border border-[#ececec] bg-[#fafafa] p-4 ${RunSummaryHeightClassName}`}>
                        <div className="text-sm font-semibold text-[#111]">Run Summary</div>
                        <div className="mt-3 space-y-2 text-sm text-[#666]">
                            <div>
                                Target:{" "}
                                {librarySelection === "all"
                                    ? "All libraries"
                                    : getBenchmarkLibraryMeta(librarySelection).label}
                            </div>
                            <div>Scenario: {scenario.label}</div>
                            <div>Items: {count.toLocaleString()}</div>
                            <div>CPU work: {workMs} ms per item</div>
                            <div>Extra nodes: {extraNodes}</div>
                            <div className={lastCompletedAt ? "" : "text-[#aaa]"}>
                                Last run finished at: {lastCompletedAt ?? "Not run yet"}
                            </div>
                            <div className={runError ? "font-semibold text-[#b91c1c]" : "text-[#aaa]"}>
                                {runError ?? (isRunning ? "Benchmark in progress." : "Ready for a scripted run.")}
                            </div>
                        </div>
                    </div>

                    <div className={`grid gap-2 md:grid-cols-2 xl:grid-cols-3 ${RunSummaryHeightClassName}`}>
                        {visibleLibraryIds.map((libraryId) => {
                            const result = results[libraryId];
                            return (
                                <div
                                    className={`rounded-xl border border-[#ececec] bg-[#fafafa] p-4 ${RunSummaryHeightClassName}`}
                                    key={libraryId}
                                >
                                    <div className="text-sm font-semibold text-[#111]">
                                        {getBenchmarkLibraryMeta(libraryId).label}
                                    </div>
                                    {result ? (
                                        <div className="mt-3 space-y-1 text-sm text-[#666]">
                                            <div>Elapsed: {formatMs(result.elapsedMs)} ms</div>
                                            <div>Budget: {result.budgetMs} ms</div>
                                            <div>Average frame: {formatMs(result.avgFrameMs)} ms</div>
                                            <div>Peak frame: {formatMs(result.maxFrameMs)} ms</div>
                                            <div>Long frames: {result.longFrames}</div>
                                            <div>Steps: {result.stepCount}</div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 text-sm text-[#888]">
                                            {isRunning && activeRunLibraryId === libraryId
                                                ? "Running this library now."
                                                : "No scripted run yet."}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div
                className={`grid content-start justify-items-start gap-4 pb-4 ${
                    visibleLibraryIds.length === 1 ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3"
                }`}
            >
                {visibleLibraryIds.map((libraryId) => {
                    const PanelComponent = PANEL_COMPONENTS[libraryId];
                    return (
                        <PanelComponent
                            data={data}
                            extraNodes={extraNodes}
                            isRunning={activeRunLibraryId === libraryId}
                            key={libraryId}
                            registerController={(controller) => setController(libraryId, controller)}
                            workMs={workMs}
                        />
                    );
                })}
            </div>
        </div>
    );
}
