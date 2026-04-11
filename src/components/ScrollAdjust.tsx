import * as React from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import { useValueListener$ } from "@/hooks/useValueListener$";
import { peek$, useStateContext } from "@/state/state";

export function getScrollAdjustAxis(horizontal: boolean) {
    return horizontal
        ? {
              contentSizeKey: "scrollWidth" as const,
              paddingEndProp: "paddingRight" as const,
              viewportSizeKey: "clientWidth" as const,
              x: 1,
              y: 0,
          }
        : {
              contentSizeKey: "scrollHeight" as const,
              paddingEndProp: "paddingBottom" as const,
              viewportSizeKey: "clientHeight" as const,
              x: 0,
              y: 1,
          };
}

export function ScrollAdjust() {
    const ctx = useStateContext();
    const lastScrollOffsetRef = React.useRef(0);
    const resetPaddingRafRef = React.useRef<number | undefined>(undefined);

    const callback = React.useCallback(() => {
        const scrollAdjust = peek$(ctx, "scrollAdjust");
        const scrollAdjustUserOffset = peek$(ctx, "scrollAdjustUserOffset");

        const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0);
        const scrollView = ctx.state?.refScroller.current as unknown as ScrollViewMethods;

        if (scrollView && scrollOffset !== lastScrollOffsetRef.current) {
            const scrollDelta = scrollOffset - lastScrollOffsetRef.current;

            if (scrollDelta !== 0) {
                const axis = getScrollAdjustAxis(!!ctx.state.props.horizontal);
                const contentNode = scrollView.getContentNode();
                const prevScroll = scrollView.getCurrentScrollOffset();
                const el = scrollView.getScrollableNode();
                const scrollBy = () => scrollView.scrollBy(axis.x * scrollDelta, axis.y * scrollDelta);
                if (!contentNode) {
                    scrollBy();
                    lastScrollOffsetRef.current = scrollOffset;
                    return;
                }

                const totalSize = contentNode[axis.contentSizeKey];
                const viewportSize = el[axis.viewportSizeKey];
                const nextScroll = prevScroll + scrollDelta;
                if (scrollDelta > 0 && !ctx.state.adjustingFromInitialMount && totalSize < nextScroll + viewportSize) {
                    // If trying to scroll out of bounds of the scroll element's current size
                    // it would clamp the scroll and not do the full adjustment. So we need to
                    // add padding to the scroll element to allow the scroll to complete.
                    const previousPaddingEnd = contentNode.style[axis.paddingEndProp];
                    const pad = (nextScroll + viewportSize - totalSize) * 2;
                    contentNode.style[axis.paddingEndProp] = `${pad}px`;
                    // Force a layout update by reading from DOM
                    void contentNode.offsetHeight;

                    scrollBy();
                    // Multiple adjustments can happen in one frame; keep only the latest padding reset.
                    if (resetPaddingRafRef.current !== undefined) {
                        cancelAnimationFrame(resetPaddingRafRef.current);
                    }

                    // After the scrollBy, revert the temporary end padding.
                    resetPaddingRafRef.current = requestAnimationFrame(() => {
                        resetPaddingRafRef.current = undefined;
                        contentNode.style[axis.paddingEndProp] = previousPaddingEnd;
                    });
                } else {
                    scrollBy();
                }
            }

            lastScrollOffsetRef.current = scrollOffset;
        }
    }, [ctx]);

    useValueListener$("scrollAdjust", callback);
    useValueListener$("scrollAdjustUserOffset", callback);

    // Don't render, this manually operates on the DOM
    return null;
}
