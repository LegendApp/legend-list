import * as React from "react";

import { useArr$ } from "@/state/state";

export function ScrollAdjust() {
    const [scrollAdjust, scrollAdjustUserOffset] = useArr$(["scrollAdjust", "scrollAdjustUserOffset"]);
    const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0);

    // Get reference to the current component's parent to find the scroll container
    const componentRef = React.useRef<HTMLDivElement>(null);

    React.useLayoutEffect(() => {
        if (scrollOffset === 0) return;

        const currentElement = componentRef.current;
        if (!currentElement) return;

        // Find the content container by traversing up to find ScrollView structure
        // The structure is: scrollView div > content div (with display: flex/block)
        let scrollView = currentElement.parentElement;
        while (scrollView && !scrollView.style.overflow?.includes("auto")) {
            scrollView = scrollView.parentElement;
        }

        if (scrollView) {
            // Find the content container (second child after refreshControl)
            const contentContainer = scrollView.children[scrollView.children.length - 1] as HTMLElement;

            if (contentContainer) {
                // Apply CSS transform instead of scroll adjustment
                contentContainer.style.transform = `translateY(${-scrollOffset}px)`;
                contentContainer.style.willChange = "transform";

                console.log("ScrollAdjust (web transform)", -scrollOffset);

                // Clean up transform when component unmounts or scrollOffset becomes 0
                return () => {
                    if (contentContainer) {
                        contentContainer.style.transform = "";
                        contentContainer.style.willChange = "";
                    }
                };
            }
        }
    }, [scrollOffset]);

    // Render an invisible marker element that helps us find our position in the DOM
    return <div ref={componentRef} style={{ display: "none" }} />;
}
