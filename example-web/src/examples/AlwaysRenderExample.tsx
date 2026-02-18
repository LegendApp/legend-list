import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

const ALWAYS_RENDER = { bottom: 2, top: 2 } as const;
const ROW_HEIGHT = 56;

export default function AlwaysRenderExample() {
    const data = React.useMemo(() => generateItems(80), []);
    const listRef = React.useRef<LegendListRef | null>(null);
    const [mountedStatus, setMountedStatus] = React.useState({ bottom: false, top: false });

    const updateMountedStatus = React.useCallback(() => {
        const state = listRef.current?.getState();
        if (!state) return;
        const topMounted = state.elementAtIndex(0) !== undefined;
        const bottomMounted = state.elementAtIndex(data.length - 1) !== undefined;
        setMountedStatus((prev) =>
            prev.top === topMounted && prev.bottom === bottomMounted
                ? prev
                : { bottom: bottomMounted, top: topMounted },
        );
    }, [data.length]);

    return (
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 12, minHeight: 0 }}>
            <div
                style={{
                    background: "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: 8,
                    padding: "12px 14px",
                }}
            >
                <div style={{ fontWeight: 700 }}>Always Render</div>
                <div style={{ color: "#555", fontSize: 13, marginTop: 4 }}>
                    Top and bottom items stay mounted while you scroll.
                </div>
                <div style={{ display: "flex", fontSize: 12, gap: 12, marginTop: 8 }}>
                    <span>Top mounted: {mountedStatus.top ? "yes" : "no"}</span>
                    <span>Bottom mounted: {mountedStatus.bottom ? "yes" : "no"}</span>
                </div>
            </div>
            <LegendList<SimpleItem>
                alwaysRender={ALWAYS_RENDER}
                data={data}
                estimatedItemSize={ROW_HEIGHT}
                keyExtractor={(item) => item.id}
                onLoad={updateMountedStatus}
                onScroll={updateMountedStatus}
                ref={listRef}
                renderItem={({ item, index }: { item: SimpleItem; index: number }) => {
                    const isAlways = index < ALWAYS_RENDER.top || index >= data.length - ALWAYS_RENDER.bottom;
                    return (
                        <div
                            style={{
                                alignItems: "center",
                                background: isAlways ? "#e9f7ef" : index % 2 === 0 ? "#ffffff" : "#f7f7f8",
                                borderBottom: "1px solid #ececec",
                                boxSizing: "border-box",
                                display: "flex",
                                height: ROW_HEIGHT,
                                justifyContent: "space-between",
                                padding: "0 16px",
                            }}
                        >
                            <div style={{ fontWeight: 600 }}>Row {index + 1}</div>
                            <div
                                style={{
                                    color: isAlways ? "#0f5132" : "#666",
                                    fontSize: 12,
                                    fontWeight: isAlways ? 700 : 400,
                                    textTransform: isAlways ? "uppercase" : "none",
                                }}
                            >
                                {isAlways ? "Always" : `id: ${item.id}`}
                            </div>
                        </div>
                    );
                }}
                style={{ flex: 1, minHeight: 0 }}
            />
        </div>
    );
}
