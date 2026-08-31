// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { View } from "react-native";

import { useArr$, useStateContext } from "@/state/state";

export function ScrollAdjust() {
    const ctx = useStateContext();
    // Yoga uses 32-bit floats. At 1e6 dp the float error (max 1/32 dp) stays under half a pixel, so
    // the anchor snaps to the same pixel grid position as the items. Warning: a larger bias
    // increases the float error. At 1e7 dp the error reaches 1 dp, the anchor and the items
    // then move by different pixel amounts, and each prepend shifts the list by 1 to 2 px.
    // This difference in movement causes visible up and down movement when items are prepended
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
