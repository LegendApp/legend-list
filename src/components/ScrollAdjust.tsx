import * as React from "react";

import { useValueListener$ } from "@/hooks/useValueListener$";
import { peek$, type StateContext, useStateContext } from "@/state/state";
import { LEGEND_LIST_CONTENT_CONTAINER_CLASS } from "./webConstants";

export function getScrollAdjustAxis(horizontal: boolean) {
    return horizontal
        ? {
              contentSizeKey: "scrollWidth" as const,
              sizeProp: "width" as const,
              viewportSizeKey: "clientWidth" as const,
              x: 1,
              y: 0,
          }
        : {
              contentSizeKey: "scrollHeight" as const,
              sizeProp: "height" as const,
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
            (scrollView?.getContentNode?.() as HTMLElement | null) ??
            (contentNode?.isConnected && contentNode.parentElement === scrollElement
                ? contentNode
                : scrollElement.querySelector<HTMLElement>(`:scope > .${LEGEND_LIST_CONTENT_CONTAINER_CLASS}`));
    }

    return scrollElement ? { contentNode: resolvedContentNode, scrollElement } : null;
}

export function scrollAdjustBy(el: HTMLElement, left: number, top: number, interruptMomentum = false) {
    if (!interruptMomentum) {
        el.scrollBy({ behavior: "auto", left, top });
        return;
    }
    // iOS WebKit can restore the pre-prepend offset on its next momentum frame.
    const before = el.scrollTop;
    const previousOverflow = el.style.overflowY;
    el.style.overflowY = "hidden";
    try {
        // Reading the offset commits the overflow change and accounts for a clamped rubber-band offset.
        el.scrollBy({ behavior: "auto", left, top: top + before - el.scrollTop });
        void el.offsetHeight;
    } finally {
        el.style.overflowY = previousOverflow;
    }
}

export function ScrollAdjust() {
    const ctx = useStateContext();
    const lastScrollOffsetRef = React.useRef(0);
    const lastScrollAdjustUserOffsetRef = React.useRef(0);
    const resetSpacerRafRef = React.useRef<number | undefined>(undefined);
    const spacerRef = React.useRef<HTMLDivElement | null>(null);
    const contentNodeRef = React.useRef<HTMLElement | null>(null);
    const clearTemporaryScrollAdjust = React.useCallback(() => {
        if (resetSpacerRafRef.current !== undefined) cancelAnimationFrame(resetSpacerRafRef.current);
        resetSpacerRafRef.current = undefined;
        const spacer = spacerRef.current;
        spacer?.remove();
        spacerRef.current = null;
    }, []);

    const callback = React.useCallback(() => {
        const scrollAdjust = peek$(ctx, "scrollAdjust");
        const scrollAdjustUserOffset = peek$(ctx, "scrollAdjustUserOffset");

        const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0);
        // The signal delta tells us whether an adjustment request changed, but
        // the browser may already have clamped the actual DOM scroll position.
        const signalScrollDelta = scrollOffset - lastScrollOffsetRef.current;

        if (signalScrollDelta !== 0) {
            const target = getScrollAdjustTarget(ctx, contentNodeRef.current);
            if (target) {
                const horizontal = !!ctx.state.props.horizontal;
                const axis = getScrollAdjustAxis(horizontal);
                const { contentNode, scrollElement: el } = target;
                const scroller = ctx.state.refScroller.current;
                const parentScroll = horizontal ? el.scrollLeft : el.scrollTop;
                const isExternal = ctx.state.props.hasExternalScroll;
                const currentScroll = (isExternal ? scroller?.getCurrentScrollOffset?.() : undefined) ?? parentScroll;
                // An offscreen list must not pull a shared scroll owner back to itself.
                const isOutsideList = scroller?.isScrollInRange?.() === false;
                const userOffsetDelta = (scrollAdjustUserOffset || 0) - lastScrollAdjustUserOffsetRef.current;
                const isRelative = ctx.state.scrollAdjustHandler.isRelativeWebAdjust?.(scrollAdjust || 0);
                const remainder = isRelative ? ctx.state.scrollAdjustHandler.getWebAdjustRemainder(currentScroll) : 0;
                const intendedScroll =
                    userOffsetDelta !== 0 || isRelative
                        ? currentScroll + signalScrollDelta + remainder
                        : ctx.state.scroll;
                // Reconcile against live DOM scroll so browser clamping/anchoring
                // is not applied a second time as another relative scrollBy.
                const scrollDelta = intendedScroll - currentScroll;
                const shouldScroll = !isOutsideList && Math.abs(scrollDelta) > 0.01;
                const scrollBy = () => {
                    const isVerticalPrepend =
                        isRelative &&
                        userOffsetDelta === 0 &&
                        ctx.state.scrollAdjustHandler.webAdjustSource === "data" &&
                        !horizontal &&
                        !isExternal &&
                        scrollDelta > 0;
                    const interruptMomentum =
                        isVerticalPrepend &&
                        typeof CSS !== "undefined" &&
                        CSS.supports("-webkit-touch-callout", "none");
                    scrollAdjustBy(el, axis.x * scrollDelta, axis.y * scrollDelta, interruptMomentum);
                    const after =
                        (isExternal ? scroller?.getCurrentScrollOffset?.() : undefined) ??
                        (horizontal ? el.scrollLeft : el.scrollTop);
                    ctx.state.scrollAdjustHandler.recordWebAdjust?.(intendedScroll, after);
                };

                contentNodeRef.current = contentNode;

                if (shouldScroll && contentNode) {
                    const totalSize = isExternal ? el[axis.contentSizeKey] : contentNode[axis.contentSizeKey];
                    const viewportSize = el[axis.viewportSizeKey];
                    const nextScroll = parentScroll + scrollDelta;
                    const needsTemporaryPadding =
                        scrollDelta > 0 &&
                        !ctx.state.initialMountAdjusts?.length &&
                        totalSize < nextScroll + viewportSize;

                    if (needsTemporaryPadding) {
                        let spacer = spacerRef.current;
                        if (!spacer || spacer.parentElement !== contentNode) {
                            clearTemporaryScrollAdjust();
                            spacer = contentNode.ownerDocument.createElement("div");
                            spacer.setAttribute("aria-hidden", "true");
                            Object.assign(spacer.style, {
                                flexShrink: "0",
                                height: "0px",
                                overflowAnchor: "none",
                                width: "0px",
                            });
                            contentNode.appendChild(spacer);
                            spacerRef.current = spacer;
                        }
                        const pad = (nextScroll + viewportSize - totalSize) * 2;
                        const currentSize = Number.parseFloat(spacer.style[axis.sizeProp]) || 0;
                        spacer.style.display = "block";
                        spacer.style[axis.sizeProp] = `${currentSize + pad}px`;
                        // Commit the extra scroll range before the browser can clamp scrollBy.
                        void spacer.offsetHeight;
                        scrollBy();
                        if (resetSpacerRafRef.current !== undefined) {
                            cancelAnimationFrame(resetSpacerRafRef.current);
                        }
                        resetSpacerRafRef.current = requestAnimationFrame(clearTemporaryScrollAdjust);
                    } else {
                        scrollBy();
                    }
                } else if (shouldScroll) {
                    scrollBy();
                } else if (isRelative && !isOutsideList) {
                    // A new correction can exactly consume old rounding credit
                    // without a DOM write. Do not carry that credit again.
                    ctx.state.scrollAdjustHandler.recordWebAdjust(intendedScroll, currentScroll);
                }
            }

            lastScrollOffsetRef.current = scrollOffset;
            lastScrollAdjustUserOffsetRef.current = scrollAdjustUserOffset || 0;
        }
    }, [clearTemporaryScrollAdjust, ctx]);

    useValueListener$("scrollAdjust", callback);
    useValueListener$("scrollAdjustUserOffset", callback);

    React.useLayoutEffect(() => {
        ctx.clearTemporaryScrollAdjust = clearTemporaryScrollAdjust;
        return () => {
            clearTemporaryScrollAdjust();
            ctx.clearTemporaryScrollAdjust = undefined;
        };
    }, [clearTemporaryScrollAdjust, ctx]);

    return null;
}
