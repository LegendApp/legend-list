import React from "react";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react";
import { ItemCard } from "./cards-renderItem";
import { generateItems, type SimpleItem } from "./utils";

export default function BidirectionalInfiniteListExample() {
    const [start, setStart] = React.useState(-50);
    const [end, _setEnd] = React.useState(50);
    const data = React.useMemo(() => generateItems(end - start + 1, start), [start, end]);

    return (
        <LegendList
            data={data}
            drawDistance={500}
            estimatedItemSize={200}
            initialScrollIndex={data.length - 1}
            keyExtractor={(it) => it?.id}
            // onEndReached={() => setEnd((e) => e + 50)}
            // onEndReachedThreshold={0.2}
            maintainVisibleContentPosition
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
            style={{ flex: 1, minHeight: 0 }}
        />
    );
}
