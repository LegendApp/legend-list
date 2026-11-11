// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { View } from "react-native";

import { useArr$, useStateContext } from "@/state/state";

export function ScrollAdjust() {
    const ctx = useStateContext();
    // Native maintainVisibleContentPosition anchors to this view while it sits below the scroll offset. Adjustments
    // move it and the scroll offset together, so the bias is how far the list can scroll beyond its adjustments:
    // 1,000,000 points, or 10,000 rows of 100 points loaded without a prepend.
    // Native layout stores positions as 32-bit floats. At 10,000,000 they hold only whole points, which rounded each
    // adjustment by up to half a point and moved the visible items by the difference. At 1,000,000 they hold 1/16.
    const bias = 1_000_000;
    const [scrollAdjust, scrollAdjustUserOffset] = useArr$(["scrollAdjust", "scrollAdjustUserOffset"]);
    const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0) + bias;
    const horizontal = !!ctx.state?.props.horizontal;

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
