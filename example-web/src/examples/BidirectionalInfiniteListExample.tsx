import React from "react";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react";
import { ItemCard } from "./cards-renderItem";
import { generateItems, type SimpleItem } from "./utils";

export default function BidirectionalInfiniteListExample() {
    const [start, setStart] = React.useState(0);
    const [end, setEnd] = React.useState(100);
    const data = React.useMemo(() => generateItems(end - start + 1, start), [start, end]);

    return (
        <LegendList
            className="min-h-0 flex-1"
            data={data}
            drawDistance={5000}
            estimatedItemSize={200}
            initialScrollIndex={50}
            keyExtractor={(it) => it?.id}
            maintainVisibleContentPosition
            onEndReached={() => {
                setEnd((e) => e + 50);
                console.log("onEndReached");
            }}
            onEndReachedThreshold={0.5}
            onStartReached={() => {
                setStart((s) => s - 50);
                console.log("onStartReached");
            }}
            onStartReachedThreshold={0.5}
            renderItem={(props: LegendListRenderItemProps<SimpleItem>) => (
                <ItemCard
                    {...props}
                    numSentences={(idx) => {
                        const base = Math.abs(idx % 6) + 1;
                        return base + Math.floor(idx % 3);
                    }}
                    theme="light"
                />
            )}
        />
    );
}
