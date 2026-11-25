import * as React from "react";
import { View } from "react-native";

import { useArr$, useStateContext } from "@/state/state";

export function ScrollAdjust() {
    const ctx = useStateContext();
    // Changing the starting coordinate after mount would move the anchor and trigger a native scroll correction.
    const [anchorRange] = React.useState(() => {
        const range = ctx.state.props.maintainVisibleContentPosition.nativeAnchorRange ?? 1_000_000;
        const nativeRange = typeof range === "number" ? Math.fround(range) : Number.NaN;
        if (!Number.isFinite(nativeRange) || nativeRange <= 0) {
            throw new RangeError(
                "maintainVisibleContentPosition.nativeAnchorRange must be positive and finite in native layout.",
            );
        }
        return range;
    });
    const [scrollAdjust, scrollAdjustUserOffset] = useArr$(["scrollAdjust", "scrollAdjustUserOffset"]);
    const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0) + anchorRange;
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
