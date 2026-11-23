import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { LegendList, type LegendListRef } from "@legendapp/list/react";

type Row = { id: string; text: string };
const texts = [
    "Confirmed for tomorrow.",
    "Here are the project details. ".repeat(12),
    "Thanks.\nSecond line.",
    "A short update.",
];
const rows = (prefix: string, count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, text: `${prefix} ${i}: ${texts[i % 4]}` }));

// Gated mirrors a chat that turns end following off as soon as the list reports it left the end.
const gated = new URLSearchParams(location.search).has("gated");
const fixture = { list: null as LegendListRef | null, mutate: (_action: string) => {} };
Object.assign(window, { dataChangeEnd: fixture });

function App() {
    const list = useRef<LegendListRef>(null);
    const [data, setData] = useState(() => rows("a", 450));
    const [atEnd, setAtEnd] = useState(true);
    useEffect(() => {
        const state = list.current?.getState();
        fixture.list = list.current;
        if (gated && state) return state.listen("isAtEnd", setAtEnd);
    }, []);
    const incoming = (count: number) => rows(`n${data.length}-`, count);
    fixture.mutate = (action) => {
        if (action === "grow") {
            // A tail image decodes after the list landed at the end.
            document.querySelector<HTMLElement>(`[data-id="${data.at(-1)!.id}"]`)!.style.minHeight = "300px";
            return;
        }
        if (action === "ack") {
            // An optimistic send, its server ack under a new key and size, then an incoming message.
            const sent = { id: "optimistic", text: "Sending…" };
            const acked = { id: "acked", text: texts[1]! };
            flushSync(() => setData([...data, sent]));
            requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                    flushSync(() => setData([...data, acked]));
                    requestAnimationFrame(() => flushSync(() => setData([...data, acked, ...incoming(1)])));
                }),
            );
            return;
        }
        flushSync(() =>
            setData(
                action === "append"
                    ? [...data, ...incoming(1)]
                    : action === "replace"
                      ? [...data.map((item) => ({ ...item })), ...incoming(3)]
                      : rows("b", 120),
            ),
        );
    };
    return (
        <LegendList
            alignItemsAtEnd
            data={data}
            drawDistance={1000}
            estimatedItemSize={61}
            initialScrollAtEnd
            keyExtractor={(item) => item.id}
            maintainScrollAtEnd={!gated || atEnd ? { animated: false } : false}
            maintainVisibleContentPosition
            ref={list}
            renderItem={({ item }) => (
                <div data-id={item.id} style={{ padding: "8px 16px", whiteSpace: "pre-wrap" }}>
                    {item.text}
                </div>
            )}
            style={{ height: 820, width: 820 }}
        />
    );
}
createRoot(document.getElementById("root")!).render(<App />);
