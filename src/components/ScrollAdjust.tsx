import * as React from "react";

import { useArr$ } from "@/state/state";

export function ScrollAdjust() {
    const [scrollAdjust, scrollAdjustUserOffset] = useArr$(["scrollAdjust", "scrollAdjustUserOffset"]);
    const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0);

    // Get reference to the current component's parent to find the scroll container
    const componentRef = React.useRef<HTMLDivElement>(null);

    const lastScrollOffsetRef = React.useRef(0);

    React.useLayoutEffect(() => {
        const currentElement = componentRef.current;
        if (!currentElement) return;

        // Find the scroll container by traversing up to find ScrollView structure
        let scrollView = currentElement.parentElement;
        while (scrollView && !scrollView.style.overflow?.includes("auto")) {
            scrollView = scrollView.parentElement;
        }

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
    }, [scrollOffset]);

    // Render an invisible marker element that helps us find our position in the DOM
    return <div ref={componentRef} style={{ display: "none" }} />;
}
