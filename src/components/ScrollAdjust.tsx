import * as React from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import { getDebugDeferredInteraction, logDebugDeferredInteraction } from "@/core/debugDeferredInteraction";
import { useValueListener$ } from "@/hooks/useValueListener$";
import { peek$, useStateContext } from "@/state/state";

export function ScrollAdjust() {
    const ctx = useStateContext();
    const lastScrollOffsetRef = React.useRef(0);
    const resetPaddingRafRef = React.useRef<number | undefined>(undefined);

    const callback = React.useCallback(() => {
        const scrollAdjust = peek$(ctx, "scrollAdjust");
        const scrollAdjustUserOffset = peek$(ctx, "scrollAdjustUserOffset");

        const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0);
        const scrollView = ctx.state?.refScroller.current as unknown as ScrollViewMethods;
        const trace = getDebugDeferredInteraction(ctx.state);

        if (trace) {
            logDebugDeferredInteraction(ctx.state, "scrollAdjust:web-observed", {
                lastScrollOffset: lastScrollOffsetRef.current,
                scrollAdjust,
                scrollAdjustUserOffset,
                scrollOffset,
            });
        }

        if (scrollView && scrollOffset !== lastScrollOffsetRef.current) {
            const scrollDelta = scrollOffset - lastScrollOffsetRef.current;

            if (scrollDelta !== 0) {
                const contentNode = scrollView.getContentNode();
                const prevScroll = scrollView.getCurrentScrollOffset();
                const el = scrollView.getScrollableNode();
                if (trace) {
                    logDebugDeferredInteraction(ctx.state, "scrollAdjust:web-before-scrollBy", {
                        prevScroll,
                        scrollDelta,
                        scrollOffset,
                    });
                }
                if (!contentNode) {
                    scrollView.scrollBy(0, scrollDelta);
                    if (trace) {
                        logDebugDeferredInteraction(ctx.state, "scrollAdjust:web-after-scrollBy-no-content-node", {
                            nextScrollOffset: scrollOffset,
                            scrollDelta,
                        });
                    }
                    lastScrollOffsetRef.current = scrollOffset;
                    return;
                }

                const totalSize = contentNode.scrollHeight;
                const viewportSize = el.clientHeight;
                const nextScroll = prevScroll + scrollDelta;
                if (scrollDelta > 0 && !ctx.state.adjustingFromInitialMount && totalSize < nextScroll + viewportSize) {
                    // If trying to scroll out of bounds of the scroll element's current size
                    // it would clamp the scroll and not do the full adjustment. So we need to
                    // add padding to the scroll element to allow the scroll to complete.
                    const paddingBottom = ctx.state.props.stylePaddingBottom || 0;
                    const pad = (nextScroll + viewportSize - totalSize) * 2;
                    contentNode.style.paddingBottom = `${pad}px`;
                    // Force a layout update by reading from DOM
                    void contentNode.offsetHeight;

                    scrollView.scrollBy(0, scrollDelta);
                    if (trace) {
                        logDebugDeferredInteraction(ctx.state, "scrollAdjust:web-after-scrollBy-with-pad", {
                            nextScroll,
                            pad,
                            prevScroll,
                            scrollDelta,
                        });
                    }
                    // Multiple adjustments can happen in one frame; keep only the latest padding reset.
                    if (resetPaddingRafRef.current !== undefined) {
                        cancelAnimationFrame(resetPaddingRafRef.current);
                    }

                    // After the scrollBy, revert the padding bottom to the padding from the style prop
                    resetPaddingRafRef.current = requestAnimationFrame(() => {
                        resetPaddingRafRef.current = undefined;
                        if (getDebugDeferredInteraction(ctx.state)) {
                            logDebugDeferredInteraction(ctx.state, "scrollAdjust:web-reset-padding-raf", {
                                paddingBottom,
                            });
                        }
                        contentNode.style.paddingBottom = paddingBottom ? `${paddingBottom}px` : "0";
                    });
                } else {
                    scrollView.scrollBy(0, scrollDelta);
                    if (trace) {
                        logDebugDeferredInteraction(ctx.state, "scrollAdjust:web-after-scrollBy", {
                            nextScroll,
                            prevScroll,
                            scrollDelta,
                        });
                    }
                }
            }

            lastScrollOffsetRef.current = scrollOffset;
            if (trace) {
                logDebugDeferredInteraction(ctx.state, "scrollAdjust:web-last-offset-updated", {
                    lastScrollOffset: lastScrollOffsetRef.current,
                });
            }
        }
    }, [ctx]);

    useValueListener$("scrollAdjust", callback);
    useValueListener$("scrollAdjustUserOffset", callback);

    // Don't render, this manually operates on the DOM
    return null;
}
