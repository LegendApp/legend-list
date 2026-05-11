import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";

const ITEM_WIDTH = 296;
const ITEMS = Array.from({ length: 40 }, (_, index) => ({
    id: `snap-${index}`,
    label: `Panel ${index + 1}`,
}));
const SNAP_INDICES = ITEMS.map((_, index) => index);

declare global {
    var __legendSnapFixture:
        | {
              getScrollLeft: () => number;
              scrollToPanel: (index: number) => void;
          }
        | undefined;
}

export default function SnapToIndicesExample() {
    const listRef = React.useRef<LegendListRef>(null);
    const data = React.useMemo(() => ITEMS, []);

    React.useEffect(() => {
        globalThis.__legendSnapFixture = {
            getScrollLeft: () => listRef.current?.getState().scroll ?? 0,
            scrollToPanel: (index: number) => {
                listRef.current?.scrollToOffset({ animated: false, offset: index * ITEM_WIDTH });
            },
        };

        return () => {
            globalThis.__legendSnapFixture = undefined;
        };
    }, []);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <div className="shrink-0">
                <h3 className="m-0 text-lg font-semibold">snapToIndices Web Fixture</h3>
                <p className="m-0 text-sm text-[#666]">
                    Horizontal fixed-size panels should snap naturally even when target items are virtualized.
                </p>
            </div>
            <LegendList<(typeof ITEMS)[number]>
                className="min-h-0 flex-1 rounded border border-[#d9d9de]"
                contentContainerStyle={{ padding: 8 }}
                data={data}
                estimatedItemSize={ITEM_WIDTH}
                getFixedItemSize={() => ITEM_WIDTH}
                horizontal
                keyExtractor={(item) => item.id}
                recycleItems
                ref={listRef}
                renderItem={({ item, index }) => (
                    <div
                        className="box-border flex h-full items-center justify-center rounded border border-[#d6d6dc] text-xl font-semibold"
                        style={{
                            background: index % 2 === 0 ? "#ffffff" : "#f6f7f9",
                            width: ITEM_WIDTH - 16,
                        }}
                    >
                        {item.label}
                    </div>
                )}
                snapToIndices={SNAP_INDICES}
            />
        </div>
    );
}
