// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { View } from "react-native";

import { useArr$, useStateContext } from "@/state/state";

export function ScrollAdjust() {
    const ctx = useStateContext();
    // Yoga stores layout as float32. Near 1e6 dp the error is at most 1/32 dp, so the anchor lands
    // on the same pixel as the items. At 1e7 dp the error reaches 1 dp, and each prepend shifts the
    // list by 1 to 2 px
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
