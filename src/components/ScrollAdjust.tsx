import * as React from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import { useValueListener$ } from "@/hooks/useValueListener$";
import { peek$, useStateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";

export function ScrollAdjust() {
    const ctx = useStateContext();
    const lastScrollOffsetRef = React.useRef(0);

    const callback = React.useCallback(() => {
        const scrollAdjust = peek$(ctx, "scrollAdjust");
        const scrollAdjustUserOffset = peek$(ctx, "scrollAdjustUserOffset");

        const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0);
        const scrollView = ctx.internalState?.refScroller.current as unknown as ScrollViewMethods;

        if (scrollView && scrollOffset !== lastScrollOffsetRef.current) {
            const scrollDelta = scrollOffset - lastScrollOffsetRef.current;

            if (scrollDelta !== 0) {
                const el = scrollView.getScrollableNode();
                const prevScroll = el.scrollTop;
                const nextScroll = prevScroll + scrollDelta;
                const totalSize = el.scrollHeight;
                if (
                    scrollDelta > 0 &&
                    !ctx.internalState!.adjustingFromInitialMount &&
                    totalSize < nextScroll + el.clientHeight
                ) {
                    // If trying to scroll out of bounds of the scroll element's current size
                    // it would clamp the scroll and not do the full adjustment. So we need to
                    // add padding to the scroll element to allow the scroll to complete.
                    const child = el.firstElementChild as HTMLElement;
                    const prevPaddingBottom = child.style.paddingBottom;
                    const pad = (nextScroll + el.clientHeight - totalSize) * 2;
                    child.style.paddingBottom = `${pad}px`;
                    // Force a layout update by reading from DOM
                    void el.offsetHeight;

                    scrollView.scrollBy(0, scrollDelta);

                    // After the scrollBy, revert the padding bottom to the previous value
                    requestAnimationFrame(() => {
                        child.style.paddingBottom = prevPaddingBottom;
                    });
                } else {
                    scrollView.scrollBy(0, scrollDelta);
                }

                if (IS_DEV) {
                    console.log("ScrollAdjust (web scrollBy)", scrollDelta, "total offset:", scrollOffset);
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
