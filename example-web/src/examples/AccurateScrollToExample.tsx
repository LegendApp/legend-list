import React from "react";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react";
import { ItemCard } from "./cards-renderItem";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function AccurateScrollToExample() {
    const ref = React.useRef<any>(null);
    const data = React.useMemo(() => generateItems(1000), []);
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2">
            <div className="flex gap-2">
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 300 })} type="button">
                    Scroll to 300
                </button>
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 700 })} type="button">
                    Scroll to 700
                </button>
            </div>
            <LegendList<SimpleItem>
                className="min-h-0 flex-1 rounded-lg"
                data={data}
                estimatedItemSize={100}
                keyExtractor={(it) => it?.id}
                ref={ref}
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
        </div>
    );
}
