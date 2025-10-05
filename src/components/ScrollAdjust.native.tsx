// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { View } from "react-native";

import { useArr$ } from "@/state/state";

export function ScrollAdjust() {
    // Use a large bias to ensure this value never goes negative
    const bias = 10_000_000;
    const [scrollAdjust, scrollAdjustUserOffset] = useArr$(["scrollAdjust", "scrollAdjustUserOffset"]);
    const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0) + bias;
    const horizontal = false;

    return (
        <View
            style={{
                height: 0,
                left: horizontal ? scrollOffset : 0,
                position: "absolute",
                top: horizontal ? 0 : scrollOffset,
                width: 0,
            }}
        />
    );
}
