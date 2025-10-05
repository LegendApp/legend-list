import * as React from "react";

import { useValueListener$ } from "@/hooks/useValueListener$";
import { peek$, useStateContext } from "@/state/state";

export function ScrollAdjust() {
    const ctx = useStateContext();
    // Get reference to the current component's parent to find the scroll container

    const lastScrollOffsetRef = React.useRef(0);

    const callback = React.useCallback(() => {
        const scrollAdjust = peek$(ctx, "scrollAdjust");
        const scrollAdjustUserOffset = peek$(ctx, "scrollAdjustUserOffset");

        const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0);
        const scrollView = ctx.internalState?.refScroller.current as unknown as HTMLDivElement;

        if (scrollView && scrollOffset !== lastScrollOffsetRef.current) {
            const scrollDelta = scrollOffset - lastScrollOffsetRef.current;

            if (scrollDelta !== 0) {
                // Use scrollBy instead of setting scrollTop directly
                // This should preserve momentum scrolling better
                scrollView.scrollBy(0, scrollDelta);

                console.log("ScrollAdjust (web scrollBy)", scrollDelta, "total offset:", scrollOffset);
            }

            lastScrollOffsetRef.current = scrollOffset;
        }
    }, []);

    useValueListener$("scrollAdjust", callback);
    useValueListener$("scrollAdjustUserOffset", callback);

    // Don't render, this manually operates on the DOM
    return null;
}
