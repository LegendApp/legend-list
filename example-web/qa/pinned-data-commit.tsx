import * as React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { LegendList, type LegendListRef } from "@legendapp/list/react";

type Row = { id: string; height: number };
const rows = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ height: 45 + (i % 3) * 21, id: `${prefix}-${i}` }));
const base = rows("base", 180);
const maintain = { animated: false };
const keyExtractor = (row: Row) => row.id;
const renderItem = ({ item }: { item: Row }) => <div style={{ height: item.height }}>{item.id}</div>;
const pause = async (count: number) => {
    for (let n = 0; n < count; n++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};
const root = createRoot(document.getElementById("root")!);
const resultElement = document.getElementById("results")!;

async function run(name: string, next: Row[], removeFooter: boolean) {
    const ref = React.createRef<LegendListRef>();
    const endExits: string[] = [];
    const warnings: string[] = [];
    let didUpdate = false;
    const read = () => {
        const list = ref.current!;
        const viewport = list.getScrollableNode() as HTMLElement;
        return {
            gap: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
            isAtEnd: list.getState().isAtEnd,
        };
    };

    function List() {
        const [atEnd, setAtEnd] = React.useState(true);
        React.useEffect(() => {
            if (removeFooter) return;
            const state = ref.current!.getState();
            setAtEnd(state.isAtEnd);
            return state.listen("isAtEnd", (value) => {
                if (didUpdate && !value) endExits.push(new Error().stack ?? "");
                setAtEnd(value);
            });
        }, []);
        return (
            <LegendList
                alignItemsAtEnd
                data={didUpdate ? next : base}
                drawDistance={1000}
                estimatedItemSize={61}
                initialScrollAtEnd
                keyExtractor={keyExtractor}
                ListFooterComponent={removeFooter && !didUpdate ? <div style={{ height: 2000 }} /> : undefined}
                maintainScrollAtEnd={removeFooter || atEnd ? maintain : false}
                maintainVisibleContentPosition={!removeFooter}
                ref={ref}
                renderItem={renderItem}
                style={{ height: 500, width: 600 }}
            />
        );
    }

    const render = () => flushSync(() => root.render(<List />));
    const consoleError = console.error;
    try {
        render();
        await pause(8);
        await ref.current!.scrollToEnd({ animated: false });
        await pause(8);
        const before = read();

        console.error = (...args) => {
            if (String(args[0]).includes("flushSync was called from inside")) warnings.push(new Error().stack ?? "");
            consoleError(...args);
        };
        didUpdate = true;
        render();
        await pause(12);
        const settled = read();
        return {
            before,
            endExits,
            name,
            passed:
                Math.abs(before.gap) <= 1 &&
                Math.abs(settled.gap) <= 1 &&
                settled.isAtEnd &&
                (removeFooter ? warnings.length === 0 : before.isAtEnd && endExits.length === 0),
            settled,
            warnings,
        };
    } finally {
        console.error = consoleError;
        flushSync(() => root.render(null));
    }
}

try {
    const results = [
        await run("pinned data swap keeps isAtEnd", rows("swap", 195), false),
        await run("footer shrink avoids a nested flushSync", base, true),
    ];
    resultElement.textContent = JSON.stringify({ results });
    resultElement.dataset.status = results.every((result) => result.passed) ? "passed" : "failed";
} catch (error) {
    resultElement.textContent = JSON.stringify({ results: [{ error: String(error), name: "fixture", passed: false }] });
    resultElement.dataset.status = "failed";
}
