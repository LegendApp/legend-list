import React from "react";

import { LegendList } from "@/components/LegendList";
import { Text } from "@/platform/Text";
import { View } from "@/platform/View";
import type { SimpleItem } from "./utils";
import { generateItems } from "./utils";

export default function AccurateScrollToExample() {
    const ref = React.useRef<any>(null);
    const data = React.useMemo(() => generateItems(1000), []);
    return (
        <View style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 300 })} type="button">
                    Scroll to 300
                </button>
                <button onClick={() => ref.current?.scrollToOffset?.({ animated: true, offset: 20000 })} type="button">
                    Scroll to offset 20000
                </button>
            </div>
            <LegendList<SimpleItem>
                data={data}
                estimatedItemSize={100}
                keyExtractor={(it) => it?.id}
                ref={ref}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <View style={{ background: "#fff", borderRadius: 8, padding: 12 }}>
                        <Text>Item {item.id}</Text>
                    </View>
                )}
                style={{ borderRadius: 8, height: "100%" }}
            />
        </View>
    );
}
