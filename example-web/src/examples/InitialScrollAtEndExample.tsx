import React from "react";

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react";
import { ItemCard } from "./cards-renderItem";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function InitialScrollAtEndExample() {
    const data = React.useMemo(() => generateItems(100), []);

    return (
        <div className="relative flex min-h-0 flex-1 bg-[#456]">
            <LegendList<SimpleItem>
                className="min-h-0 flex-1"
                contentContainerStyle={{ paddingTop: 200 }}
                data={data}
                drawDistance={5000}
                estimatedItemSize={200}
                extraData={{ recycleState: true }}
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                recycleItems
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
