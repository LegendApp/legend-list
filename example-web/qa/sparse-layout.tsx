import React from "react";
import { createRoot } from "react-dom/client";

import {
    type DataSourceMutationBatch,
    LegendList,
    type LegendListDataSource,
    type LegendListRef,
    type OnViewableItemsChangedInfo,
} from "@legendapp/list/react";

// This page uses real React DOM, ResizeObserver, scroll events and timers. It is
// served by Vite but is not imported by the example app or production library.
type Item = { id: string; size: number };
type Scenario =
    | "visibility-idle"
    | "visibility"
    | "measurement"
    | "reset"
    | "revision-gap"
    | "replacement"
    | "scrolling";
type Result = { name: string; passed: boolean; error?: string };
const results: Result[] = [];
const output = document.getElementById("results")!;
const host = document.getElementById("test-host")!;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function until(predicate: () => boolean, message: string) {
    const deadline = performance.now() + 2500;
    while (!predicate()) {
        if (performance.now() >= deadline) throw new Error(message);
        await delay(20);
    }
}

async function runCase(sourceMode: boolean, horizontal: boolean, strict: boolean, scenario: Scenario) {
    let items: Item[] = Array.from({ length: 40 }, (_, index) => ({ id: `item-${index}`, size: 50 }));
    let revision = 0;
    const listeners = new Set<(batch: DataSourceMutationBatch) => void>();
    const source: LegendListDataSource<Item> = {
        getItem: (index) => items[index],
        getKey: (index) => items[index].id,
        getLength: () => items.length,
        getRevision: () => revision,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
    let activeSource = source;
    const root = createRoot(host);
    const ref = React.createRef<LegendListRef>();
    const calls: OnViewableItemsChangedInfo<Item | undefined>[] = [];
    const callback = (info: OnViewableItemsChangedInfo<Item | undefined>) => calls.push(info);
    const keyExtractor = (item: Item) => item.id;
    const config = { itemVisiblePercentThreshold: 50, minimumViewTime: scenario.startsWith("visibility") ? 150 : 0 };
    const footer = <div style={horizontal ? { height: 120, width: 600 } : { height: 600 }} />;
    const render = (extraData = 0) => {
        const list = (
            <LegendList
                {...(sourceMode ? { dataSource: activeSource } : { data: items })}
                estimatedItemSize={50}
                extraData={extraData}
                horizontal={horizontal}
                keyExtractor={keyExtractor}
                ListFooterComponent={footer}
                maintainVisibleContentPosition={false}
                onViewableItemsChanged={callback}
                recycleItems
                ref={ref}
                renderItem={({ item }: { item: Item | undefined }) =>
                    item ? (
                        <div
                            data-qa-key={item.id}
                            style={{
                                background: "#eef",
                                boxSizing: "border-box",
                                ...(horizontal
                                    ? { height: 100, width: item.size }
                                    : { height: item.size, width: "100%" }),
                            }}
                        >
                            {item.id}
                        </div>
                    ) : null
                }
                style={{ height: 240, width: 320 }}
                viewabilityConfig={config}
            />
        );
        root.render(strict ? <React.StrictMode>{list}</React.StrictMode> : list);
    };
    const row = (index: number) => host.querySelector<HTMLElement>(`[data-qa-key="item-${index}"]`);
    const start = (element: HTMLElement) =>
        horizontal ? element.getBoundingClientRect().left : element.getBoundingClientRect().top;
    const gapIs = (size: number) => !!row(0) && !!row(1) && Math.abs(start(row(1)!) - start(row(0)!) - size) < 1;
    const firstVisible = () => ref.current?.getState().start;
    const notify = (reset: boolean, revisionGap = false) => {
        const previousRevision = revision++;
        const batch: DataSourceMutationBatch = {
            length: items.length,
            operations: reset ? [{ type: "reset" }] : [{ count: 1, index: 0, layout: "invalidate", type: "update" }],
            previousLength: items.length,
            previousRevision: revisionGap ? previousRevision + 10 : previousRevision,
            revision,
        };
        for (const listener of listeners) listener(batch);
    };
    try {
        render();
        await until(() => gapIs(50), "initial rows are not contiguous");
        if (scenario.startsWith("visibility")) {
            if (scenario === "visibility") {
                await delay(30);
                render(1);
            }
            await until(
                () => calls.some((info) => info.viewableItems.some((token) => token.key === "item-0")),
                `${scenario} lost the visibility deadline`,
            );
            return;
        }
        if (sourceMode && listeners.size !== 1) throw new Error(`expected one source listener, got ${listeners.size}`);
        if (scenario !== "scrolling") {
            for (const size of [90, 35]) {
                items = items.map((item, index) => (index === 0 ? { ...item, size } : item));
                if (sourceMode) notify(false);
                else render(size);
                await until(
                    () => gapIs(size),
                    `ResizeObserver failed to position the next row after resize to ${size}`,
                );
                if (sourceMode && scenario !== "measurement") {
                    if (scenario === "replacement") {
                        activeSource = { ...source };
                        render(size);
                    } else {
                        notify(true, scenario === "revision-gap");
                    }
                    await delay(100);
                    await until(() => gapIs(size), `${scenario} discarded unchanged DOM measurements`);
                }
            }
            return;
        }
        // Jump beyond the mounted window, then recycle back to the original keys.
        void ref.current!.scrollToIndex({ animated: false, index: 30 });
        await until(() => !!row(30) && firstVisible()! >= 29, "distant scroll failed to render its destination");
        void ref.current!.scrollToIndex({ animated: false, index: 0 });
        await until(() => gapIs(50) && firstVisible() === 0, "recycled rows did not restore the original geometry");
        await until(
            () => calls.at(-1)?.viewableItems.some((token) => token.key === "item-0") === true,
            "returning row did not become viewable",
        );
        void ref.current!.scrollToEnd({ animated: false });
        await until(() => calls.at(-1)?.viewableItems.length === 0, "footer-only viewport retained visible rows");
        void ref.current!.scrollToIndex({ animated: false, index: 0 });
        await until(
            () => calls.at(-1)?.viewableItems.some((token) => token.key === "item-0") === true,
            "footer reentry did not restart visibility",
        );
    } finally {
        root.unmount();
    }
}

async function run() {
    for (const sourceMode of new URLSearchParams(location.search).has("arraysOnly") ? [false] : [false, true]) {
        for (const horizontal of [false, true]) {
            for (const strict of [false, true]) {
                const scenarios: Scenario[] = sourceMode
                    ? [
                          "visibility-idle",
                          "visibility",
                          "measurement",
                          "reset",
                          "revision-gap",
                          "replacement",
                          "scrolling",
                      ]
                    : ["visibility-idle", "visibility", "measurement", "scrolling"];
                for (const scenario of scenarios) {
                    const name = `${scenario}: ${sourceMode ? "source" : "array"}, ${horizontal ? "horizontal" : "vertical"}, strict=${strict}`;
                    try {
                        await runCase(sourceMode, horizontal, strict, scenario);
                        results.push({ name, passed: true });
                    } catch (error) {
                        results.push({ error: String(error), name, passed: false });
                    }
                    output.textContent = JSON.stringify({ complete: false, results }, null, 2);
                }
            }
        }
    }
    output.textContent = JSON.stringify({ complete: true, results }, null, 2);
    output.dataset.status = results.every((result) => result.passed) ? "passed" : "failed";
}
void run();
