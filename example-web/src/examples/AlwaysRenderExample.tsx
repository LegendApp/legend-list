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
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="rounded-lg border border-[#e5e5e5] bg-white px-3.5 py-3">
                <div className="font-bold">Always Render</div>
                <div className="mt-1 text-[13px] text-[#555]">Top and bottom items stay mounted while you scroll.</div>
                <div className="mt-2 flex gap-3 text-xs">
                    <span>Top mounted: {mountedStatus.top ? "yes" : "no"}</span>
                    <span>Bottom mounted: {mountedStatus.bottom ? "yes" : "no"}</span>
                </div>
            </div>
            <LegendList<SimpleItem>
                alwaysRender={ALWAYS_RENDER}
                className="min-h-0 flex-1"
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
                            className="box-border flex h-14 items-center justify-between border-b border-[#ececec] px-4"
                            style={{
                                background: isAlways ? "#e9f7ef" : index % 2 === 0 ? "#ffffff" : "#f7f7f8",
                                height: ROW_HEIGHT,
                            }}
                        >
                            <div className="font-semibold">Row {index + 1}</div>
                            <div
                                className="text-xs"
                                style={{
                                    color: isAlways ? "#0f5132" : "#666",
                                    fontWeight: isAlways ? 700 : 400,
                                    textTransform: isAlways ? "uppercase" : "none",
                                }}
                            >
                                {isAlways ? "Always" : `id: ${item.id}`}
                            </div>
                        </div>
                    );
                }}
            />
        </div>
    );
}
