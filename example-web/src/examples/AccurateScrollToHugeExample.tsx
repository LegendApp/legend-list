import React from "react";

import { LegendList } from "@/components/LegendList";
import { Text } from "@/platform/Text";
import { View } from "@/platform/View";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function AccurateScrollToHugeExample() {
    const ref = React.useRef<any>(null);
    const data = React.useMemo(() => generateItems(20000), []);
    return (
        <View style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 12345 })} type="button">
                    Scroll to 12,345
                </button>
                <button onClick={() => ref.current?.scrollToEnd?.({ animated: true })} type="button">
                    Scroll to end
                </button>
            </div>
            <LegendList
                data={data}
                estimatedItemSize={60}
                keyExtractor={(it) => it?.id}
                recycleItems
                ref={ref}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <View style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                        <Text>Item {item.id}</Text>
                    </View>
                )}
            />
        </View>
    );
}
