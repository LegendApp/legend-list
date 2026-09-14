import { useState } from "react";

import { MasonryLegendList } from "@legendapp/list/masonry";

const COLORS = ["#7c3aed", "#2563eb", "#089669", "#059669", "#ca8a04", "#dc2626"];
const makeItem = (id: number) => ({
    color: COLORS[Math.abs(id) % COLORS.length],
    height: 96 + ((Math.abs(id) * 47) % 180),
    id: String(id),
});
const DATA = Array.from({ length: 80 }, (_, index) => makeItem(index));

export default function MasonryExample() {
    const [data, setData] = useState(DATA);
    const [columns, setColumns] = useState(3);
    const [selected, setSelected] = useState<string | null>(null);
    const [tall, setTall] = useState(false);
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-wrap gap-3 p-3">
                <button onClick={() => setColumns((value) => (value === 4 ? 2 : value + 1))} type="button">
                    Columns: {columns}
                </button>
                <button onClick={() => setData((items) => [makeItem(Number(items[0].id) - 1), ...items])} type="button">
                    Prepend
                </button>
                <button
                    onClick={() => setData((items) => [...items, makeItem(Number(items.at(-1)!.id) + 1)])}
                    type="button"
                >
                    Append
                </button>
                <button onClick={() => setTall((value) => !value)} type="button">
                    Toggle tall card
                </button>
                <button
                    onClick={() => {
                        setData(DATA);
                        setTall(false);
                        setSelected(null);
                    }}
                    type="button"
                >
                    Reset
                </button>
                <output>
                    Selected: {selected ?? "none"} / Items: {data.length}
                </output>
            </div>
            <MasonryLegendList
                contentContainerStyle={{ columnGap: 12, padding: 12, rowGap: 12 }}
                data={data}
                estimatedItemSize={180}
                extraData={tall}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                numColumns={columns}
                recycleItems
                renderItem={({ item }) => (
                    <button
                        aria-label={`Card ${item.id}`}
                        className="flex w-full flex-col justify-between rounded-[18px] p-4 text-left text-white"
                        data-card-id={item.id}
                        onClick={() => setSelected(item.id)}
                        style={{ backgroundColor: item.color, height: tall && item.id === "1" ? 2000 : item.height }}
                        type="button"
                    >
                        <span className="text-[11px] font-extrabold tracking-[0.12em] text-white/80">
                            CARD {item.id}
                        </span>
                        <strong className="text-2xl">{tall && item.id === "1" ? 2000 : item.height}px</strong>
                    </button>
                )}
                style={{ flex: 1, minHeight: 0 }}
            />
        </div>
    );
}
