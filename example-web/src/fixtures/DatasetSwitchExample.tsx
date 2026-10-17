import React from "react";

import { LegendList } from "@legendapp/list/react";

const datasets = {
    a: Array.from({ length: 151 }, (_, index) => ({ id: `a-${index}`, index })),
    b: Array.from({ length: 19 }, (_, index) => ({ id: `b-${index}`, index })),
};
type RowItem = (typeof datasets.a)[number];

function Row({ item, late, tall }: { item: RowItem; late: boolean; tall: boolean }) {
    const [expanded, setExpanded] = React.useState(false);
    React.useLayoutEffect(() => {
        setExpanded(false);
        if (late) {
            const timeout = setTimeout(() => setExpanded(true), 80);
            return () => clearTimeout(timeout);
        }
    }, [item.id, late]);
    const height = (tall && item.index % 7 === 0 ? 600 : 86) + (expanded ? 60 : 0);
    return (
        <div
            data-row={item.id}
            style={{
                background: item.index % 2 ? "#e7eef8" : "#f8fafc",
                borderBottom: "1px solid #aac",
                boxSizing: "border-box",
                height,
                padding: 16,
            }}
        >
            {item.id} — {height}px
        </div>
    );
}

export default function DatasetSwitchExample() {
    const [dataset, setDataset] = React.useState<"a" | "b">("b");
    const [target, setTarget] = React.useState("end");
    const [recycle, setRecycle] = React.useState(false);
    const [tall, setTall] = React.useState(false);
    const [late, setLate] = React.useState(false);
    const [mountKey, setMountKey] = React.useState(0);
    const targetIndex = dataset === "b" ? 10 : target === "unread" ? 75 : 130;

    return (
        <div className="flex min-h-0 flex-1 flex-col" style={{ color: "#172238" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 12 }}>
                <button onClick={() => setDataset("a")} type="button">
                    Dataset A
                </button>
                <button onClick={() => setDataset("b")} type="button">
                    Dataset B
                </button>
                <button onClick={() => setMountKey((key) => key + 1)} type="button">
                    Fresh mount
                </button>
                <label>
                    Target{" "}
                    <select onChange={(event) => setTarget(event.target.value)} value={target}>
                        <option value="end">End</option>
                        <option value="unread">Unread (75)</option>
                        <option value="jump">Jump (130)</option>
                    </select>
                </label>
                <label>
                    <input checked={recycle} onChange={(event) => setRecycle(event.target.checked)} type="checkbox" />
                    Recycle
                </label>
                <label>
                    <input checked={tall} onChange={(event) => setTall(event.target.checked)} type="checkbox" />
                    Tall rows
                </label>
                <label>
                    <input checked={late} onChange={(event) => setLate(event.target.checked)} type="checkbox" />
                    Late sizes
                </label>
                <output data-dataset={dataset}>
                    Dataset {dataset.toUpperCase()}: {datasets[dataset].length} rows
                </output>
            </div>
            <LegendList
                data={datasets[dataset]}
                dataKey={dataset}
                drawDistance={1000}
                estimatedItemSize={86}
                initialScrollAtEnd={target === "end"}
                initialScrollIndex={target === "end" ? undefined : targetIndex}
                key={`${mountKey}:${target}:${recycle}:${tall}:${late}`}
                keyExtractor={(item) => item.id}
                recycleItems={recycle}
                renderItem={({ item }) => <Row item={item} late={late} tall={tall} />}
                style={{ flex: 1 }}
            />
        </div>
    );
}
