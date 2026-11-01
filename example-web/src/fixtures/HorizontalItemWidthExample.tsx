import React from "react";

import { LegendList } from "@legendapp/list/react";

const ESTIMATED_ITEM_WIDTH = 138;
const LIST_WIDTH = 960;

const itemStyle: React.CSSProperties = {
    alignItems: "center",
    background: "#e8eefc",
    border: "2px solid #3b5bdb",
    boxSizing: "border-box",
    display: "flex",
    fontSize: 28,
    height: 88,
    padding: "0 32px",
};

const textStyle: React.CSSProperties = {
    display: "-webkit-box",
    overflow: "hidden",
    textOverflow: "ellipsis",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 1,
    wordBreak: "break-all",
};

type Item = { id: string; label: string };

function ItemView({ item, onWidth }: { item: Item; onWidth?: (width: number) => void }) {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useLayoutEffect(() => {
        if (!onWidth || !ref.current) {
            return;
        }
        onWidth(Math.round(ref.current.getBoundingClientRect().width));
        const observer = new ResizeObserver(() => onWidth(Math.round(ref.current!.getBoundingClientRect().width)));
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [onWidth]);

    return (
        <div data-testid={`item-${item.id}`} ref={ref} style={itemStyle}>
            <div style={textStyle}>{item.label}</div>
        </div>
    );
}

export default function HorizontalItemWidthExample() {
    const count = Number(new URLSearchParams(window.location.search).get("count") ?? 5);
    const [lastWidth, setLastWidth] = React.useState<number | undefined>();
    const data = React.useMemo<Item[]>(
        () =>
            Array.from({ length: count }, (_, i) => ({
                id: String(i),
                label: i === count - 1 ? `Item ${i + 1} with a long label` : `Item ${i + 1}`,
            })),
        [count],
    );
    const lastId = String(count - 1);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: LIST_WIDTH }}>
            <LegendList
                data={data}
                drawDistance={ESTIMATED_ITEM_WIDTH * 2}
                estimatedItemSize={ESTIMATED_ITEM_WIDTH}
                horizontal
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ItemView item={item} onWidth={item.id === lastId ? setLastWidth : undefined} />
                )}
                style={{ height: 88 }}
            />
            <div data-testid="last-item-width" style={{ fontFamily: "monospace", fontSize: 18 }}>
                {`count=${count}, estimatedItemSize=${ESTIMATED_ITEM_WIDTH}px, last item width=${lastWidth ?? "-"}px`}
            </div>
        </div>
    );
}
