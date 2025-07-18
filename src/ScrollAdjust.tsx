// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated } from "react-native";
import { useArr$ } from "./state";

export function ScrollAdjust() {
    // Use a large bias to ensure this value never goes negative
    const bias = 10_000_000;
    const [scrollAdjust, scrollAdjustUserOffset, animatedScrollAdjustUserOffset] = useArr$([
        "scrollAdjust",
        "scrollAdjustUserOffset",
        "animatedScrollAdjustUserOffset",
    ]);
    const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0) + bias;
    const horizontal = false;

    return (
        <Animated.View
            style={{
                position: "absolute",
                height: 0,
                width: 0,
                top: animatedScrollAdjustUserOffset,
                left: horizontal ? scrollOffset : 0,
                marginTop: horizontal ? 0 : scrollOffset,
            }}
        />
    );
}
