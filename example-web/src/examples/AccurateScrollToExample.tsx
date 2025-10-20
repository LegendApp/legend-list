import React from "react";

import { LegendList } from "@legendapp/list";
import { ItemCard } from "./cards-renderItem";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function AccurateScrollToExample() {
    const ref = React.useRef<any>(null);
    const data = React.useMemo(() => generateItems(1000), []);
    return (
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 8, minHeight: 0, paddingTop: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 300 })} type="button">
                    Scroll to 300
                </button>
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 700 })} type="button">
                    Scroll to 700
                </button>
            </div>
            <LegendList<SimpleItem>
                data={data}
                estimatedItemSize={100}
                keyExtractor={(it) => it?.id}
                ref={ref}
                renderItem={(props) => (
                    <ItemCard
                        {...props}
                        numSentences={(idx) => {
                            const base = Math.abs(idx % 6) + 1;
                            return base + Math.floor(idx % 3);
                        }}
                        theme="light"
                    />
                )}
                style={{ borderRadius: 8, flex: 1, minHeight: 0 }}
            />
        </div>
    );
}
