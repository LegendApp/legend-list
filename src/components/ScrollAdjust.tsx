import * as React from "react";

import { useValueListener$ } from "@/hooks/useValueListener$";
import { peek$, type StateContext, useStateContext } from "@/state/state";
import { LEGEND_LIST_CONTENT_CONTAINER_CLASS } from "./webConstants";

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

export function getScrollAdjustTarget(ctx: StateContext, contentNode: HTMLElement | null) {
    const scrollView = ctx.state?.refScroller.current;
    const scrollElement = (scrollView?.getScrollableNode?.() as HTMLElement) ?? null;
    let resolvedContentNode: HTMLElement | null = null;

    if (scrollElement) {
        resolvedContentNode =
            contentNode?.isConnected && contentNode.parentElement === scrollElement
                ? contentNode
                : scrollElement.querySelector<HTMLElement>(`:scope > .${LEGEND_LIST_CONTENT_CONTAINER_CLASS}`);
    }

    return scrollElement ? { contentNode: resolvedContentNode, scrollElement } : null;
}

export function ScrollAdjust() {
    const ctx = useStateContext();
    const lastScrollOffsetRef = React.useRef(0);
    const resetPaddingRafRef = React.useRef<number | undefined>(undefined);
    const resetPaddingBaselineRef = React.useRef<string | undefined>(undefined);
    const contentNodeRef = React.useRef<HTMLElement | null>(null);

    const callback = React.useCallback(() => {
        const scrollAdjust = peek$(ctx, "scrollAdjust");
        const scrollAdjustUserOffset = peek$(ctx, "scrollAdjustUserOffset");

        const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0);
        const scrollDelta = scrollOffset - lastScrollOffsetRef.current;

        if (scrollDelta !== 0) {
            const target = getScrollAdjustTarget(ctx, contentNodeRef.current);
            if (target) {
                const horizontal = !!ctx.state.props.horizontal;
                const axis = getScrollAdjustAxis(horizontal);
                const { contentNode, scrollElement: el } = target;
                const scrollBy = () =>
                    el.scrollBy({ behavior: "auto", left: axis.x * scrollDelta, top: axis.y * scrollDelta });

                contentNodeRef.current = contentNode;

                if (contentNode) {
                    const prevScroll = horizontal ? el.scrollLeft : el.scrollTop;
                    const totalSize = contentNode[axis.contentSizeKey];
                    const viewportSize = el[axis.viewportSizeKey];
                    const nextScroll = prevScroll + scrollDelta;
                    const needsTemporaryPadding =
                        scrollDelta > 0 &&
                        !ctx.state.adjustingFromInitialMount &&
                        totalSize < nextScroll + viewportSize;

                    if (needsTemporaryPadding) {
                        // If trying to scroll out of bounds of the scroll element's current size
                        // it would clamp the scroll and not do the full adjustment. So we need to
                        // add padding to the scroll element to allow the scroll to complete.
                        const previousPaddingEnd =
                            resetPaddingBaselineRef.current ?? contentNode.style[axis.paddingEndProp];
                        resetPaddingBaselineRef.current = previousPaddingEnd;
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
                            resetPaddingBaselineRef.current = undefined;
                            contentNode.style[axis.paddingEndProp] = previousPaddingEnd;
                        });
                    } else {
                        scrollBy();
                    }
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
