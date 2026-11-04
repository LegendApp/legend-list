import * as React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { LegendList } from "@legendapp/list/react";

const data = Array.from({ length: 1000 }, (_, index) => ({ id: `row-${index}`, title: `Item ${index}` }));
const keyExtractor = (item: (typeof data)[number]) => item.id;
const getFixedItemSize = () => 72;
const fixed = new URLSearchParams(location.search).get("sizing") === "fixed";
let show: (open: boolean) => void;
let loaded = false;

function App() {
    const [open, setOpen] = React.useState(false);
    show = (nextOpen) => flushSync(() => setOpen(nextOpen));
    return (
        <div style={{ height: 820, width: 820 }}>
            {open && (
                <LegendList
                    data={data}
                    drawDistance={1000}
                    estimatedItemSize={72}
                    getFixedItemSize={fixed ? getFixedItemSize : undefined}
                    keyExtractor={keyExtractor}
                    onLoad={() => {
                        loaded = true;
                    }}
                    recycleItems={false}
                    renderItem={({ item, index }) => (
                        <div data-row={index} style={{ boxSizing: "border-box", height: 72, padding: 8 }}>
                            <button type="button">{item.title}</button>
                            <span>{"Deterministic list content. ".repeat(8)}</span>
                        </div>
                    )}
                    style={{ height: "100%", width: "100%" }}
                />
            )}
        </div>
    );
}

flushSync(() => createRoot(document.getElementById("root")!).render(<App />));
Object.assign(window, {
    mountBenchmark: async () => {
        const start = performance.now();
        show(true);
        const syncMs = performance.now() - start;
        while (!loaded) await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        return { readyMs: performance.now() - start, syncMs };
    },
    resetMountBenchmark: () => {
        show(false);
        loaded = false;
    },
});
