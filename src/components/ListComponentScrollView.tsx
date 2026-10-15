// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import {
    type CSSProperties,
    forwardRef,
    type HTMLAttributes,
    type ReactElement,
    type ReactNode,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
} from "react";

import { SCROLL_END_FALLBACK_MS } from "@/constants";
import { interruptMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import type { LayoutRectangle, NativeSyntheticEvent } from "@/platform/platform-types";
import { StyleSheet } from "@/platform/StyleSheet";
import { useArr$, useStateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";
import { warnDevOnce } from "@/utils/helpers";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";
import { useRafCoalescer } from "@/utils/useRafCoalescer";
import { observeScrollLayout } from "./observeScrollLayout";
import {
    LEGEND_LIST_CONTENT_CONTAINER_CLASS,
    LEGEND_LIST_SCROLLBAR_X_HIDDEN_CLASS,
    LEGEND_LIST_SCROLLBAR_Y_HIDDEN_CLASS,
} from "./webConstants";
import {
    clampOffset,
    getContentSize,
    getElementScrollPosition,
    getLayoutMeasurement,
    getLayoutRectangle,
    getMaxOffset,
    getScrollContentSize,
    getScrollPosition,
    isWindowTarget,
    resolveExternalScrollOffset,
    resolveScrollableNode,
    resolveScrollEventTarget,
    type ScrollEventTarget,
} from "./webScrollUtils";

export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>;

export interface ScrollViewMethods {
    getBoundingClientRect(): DOMRect | null | undefined;
    getCurrentScrollOffset(): number;
    getRawScrollOffset(): number;
    getMaxScrollOffset(): number;
    getScrollableNode(): HTMLElement | null;
    getScrollEventTarget(): ScrollEventTarget | null;
    getScrollResponder(): HTMLElement | null;
    isWindowScroll?(): boolean;
    getContentNode?(): HTMLElement | null;
    isScrollInRange?(): boolean;
    scrollBy(x: number, y: number): void;
    scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
    scrollToEnd(options?: { animated?: boolean }): void;
    scrollToOffset(params: { offset: number; animated?: boolean }): void;
}

export interface ListComponentScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
    horizontal?: boolean;
    contentContainerStyle?: CSSProperties;
    contentOffset?: { x: number; y: number };
    maintainVisibleContentPosition?: { minIndexForVisible: number };
    onScroll?: (event: {
        nativeEvent: {
            contentOffset: { x: number; y: number };
            contentSize: { width: number; height: number };
            layoutMeasurement: { width: number; height: number };
        };
    }) => void;
    onInternalScrollEnd?: () => void;
    onMomentumScrollEnd?: (event: {
        nativeEvent: {
            contentOffset: { x: number; y: number };
        };
    }) => void;
    snapToOffsets?: number[];
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    refreshControl?: ReactElement;
    children: ReactNode;
    style: CSSProperties;
    useWindowScroll?: boolean;
    scrollElement?: HTMLElement | null;
    onLayout: (event: LayoutChangeEvent) => void;
}

interface ExtraPropsFromRN {
    contentInset?: { bottom?: number; left?: number; right?: number; top?: number };
    scrollEventThrottle?: number;
    ScrollComponent?: React.ComponentType<unknown>;
}

const SCROLLBAR_HIDDEN_STYLE_ID = "legend-list-scrollbar-axis-hidden-style";
const SCROLLBAR_HIDDEN_STYLE = `.${LEGEND_LIST_SCROLLBAR_Y_HIDDEN_CLASS}::-webkit-scrollbar:vertical{width:0;display:none;}.${LEGEND_LIST_SCROLLBAR_X_HIDDEN_CLASS}::-webkit-scrollbar:horizontal{height:0;display:none;}`;

function ensureScrollbarHiddenStyle() {
    if (typeof document === "undefined" || document.getElementById(SCROLLBAR_HIDDEN_STYLE_ID)) {
        return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = SCROLLBAR_HIDDEN_STYLE_ID;
    styleElement.textContent = SCROLLBAR_HIDDEN_STYLE;
    document.head.appendChild(styleElement);
}

function getContentInsetEndAdjustmentEnd(ctx: ReturnType<typeof useStateContext>) {
    const adjustment = ctx.state?.props?.contentInsetEndAdjustment;
    return Math.max(0, adjustment ?? 0);
}

function getFiniteSnapOffsets(snapToOffsets: number[] | undefined): number[] {
    if (!snapToOffsets?.length) {
        return [];
    }

    const snapOffsets: number[] = [];
    const seen = new Set<number>();
    for (const offset of snapToOffsets) {
        if (Number.isFinite(offset) && !seen.has(offset)) {
            seen.add(offset);
            snapOffsets.push(offset);
        }
    }
    return snapOffsets;
}

function getSnapAnchorStyle(offset: number, horizontal: boolean): CSSProperties {
    return {
        height: horizontal ? "100%" : 1,
        left: horizontal ? offset : 0,
        pointerEvents: "none",
        position: "absolute",
        scrollSnapAlign: "start",
        top: horizontal ? 0 : offset,
        width: horizontal ? 1 : "100%",
    };
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const ListComponentScrollView = forwardRef(function ListComponentScrollView(
    {
        children,
        style,
        contentContainerClassName,
        contentContainerStyle,
        horizontal = false,
        contentOffset,
        maintainVisibleContentPosition,
        onScroll,
        onInternalScrollEnd,
        onMomentumScrollEnd: _onMomentumScrollEnd,
        showsHorizontalScrollIndicator = true,
        showsVerticalScrollIndicator = true,
        refreshControl,
        useWindowScroll = false,
        scrollElement: externalScrollElement,
        onLayout,
        ...props
    }: ListComponentScrollViewProps,
    ref: React.Ref<HTMLDivElement>,
) {
    const ctx = useStateContext();
    const [anchoredEndSpaceSize] = useArr$(["anchoredEndSpaceSize"]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const externalTarget =
        externalScrollElement === undefined && useWindowScroll
            ? typeof window === "undefined"
                ? null
                : window
            : externalScrollElement;
    const isWindowScroll = isWindowTarget(externalTarget);
    const isExternalScroll = externalTarget !== undefined;
    const getScrollTarget = useCallback(
        () => resolveScrollEventTarget(scrollRef.current, externalTarget),
        [externalTarget],
    );

    const getMaxScrollOffset = useCallback(() => {
        const scrollElement = scrollRef.current;
        const contentSize = getScrollContentSize(scrollElement, contentRef.current, externalTarget);
        const layoutMeasurement = getLayoutMeasurement(scrollElement, externalTarget, horizontal);
        return getMaxOffset(contentSize, layoutMeasurement, horizontal);
    }, [externalTarget, horizontal]);

    const getRawScrollOffset = useCallback(() => {
        const element = scrollRef.current;
        if (isExternalScroll) {
            const scroll = getScrollPosition(externalTarget);
            const listPos = getElementScrollPosition(element, externalTarget);
            return horizontal ? scroll.x - listPos.left : scroll.y - listPos.top;
        }
        return (horizontal ? element?.scrollLeft : element?.scrollTop) ?? 0;
    }, [externalTarget, horizontal, isExternalScroll]);

    const isScrollInRange = useCallback(() => {
        if (!isExternalScroll) return true;
        const offset = getRawScrollOffset();
        return offset >= -1 && offset <= getMaxScrollOffset() + 1;
    }, [getMaxScrollOffset, getRawScrollOffset, isExternalScroll]);

    const getCurrentScrollOffset = useCallback(() => {
        const offset = getRawScrollOffset();
        return isExternalScroll ? clampOffset(offset, getMaxScrollOffset()) : offset;
    }, [getMaxScrollOffset, getRawScrollOffset, isExternalScroll]);

    const scrollToLocalOffset = useCallback(
        (offset: number, animated: boolean) => {
            const scrollElement = scrollRef.current;
            const target = getScrollTarget();
            if (!target || typeof target.scrollTo !== "function") {
                return;
            }

            const maxOffset = getMaxScrollOffset();
            const clampedOffset = clampOffset(offset, maxOffset);
            const behavior = animated ? "smooth" : "auto";
            const options: ScrollToOptions = { behavior };

            if (isExternalScroll) {
                const scroll = getScrollPosition(externalTarget);
                const listPos = getElementScrollPosition(scrollElement, externalTarget);
                const { left, top } = resolveExternalScrollOffset({
                    clampedOffset,
                    horizontal,
                    listPos,
                    scroll,
                });
                options.left = left;
                options.top = top;
            } else if (horizontal) {
                options.left = clampedOffset;
            } else {
                options.top = clampedOffset;
            }

            target.scrollTo(options);
        },
        [externalTarget, getMaxScrollOffset, getScrollTarget, horizontal, isExternalScroll],
    );

    useImperativeHandle(ref, () => {
        const api: ScrollViewMethods = {
            getBoundingClientRect: () => scrollRef.current?.getBoundingClientRect(),
            getContentNode: () => contentRef.current,
            getCurrentScrollOffset,
            getMaxScrollOffset,
            getRawScrollOffset,
            getScrollableNode: () => resolveScrollableNode(scrollRef.current, externalTarget),
            getScrollEventTarget: getScrollTarget,
            getScrollResponder: () => resolveScrollableNode(scrollRef.current, externalTarget),
            isScrollInRange,
            isWindowScroll: () => isWindowScroll,
            scrollBy: (x: number, y: number) => {
                const target = getScrollTarget();
                if (!target || typeof target.scrollBy !== "function") {
                    return;
                }
                target.scrollBy({ behavior: "auto", left: x, top: y });
            },
            scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => {
                const { x = 0, y = 0, animated = true } = options;
                scrollToLocalOffset(horizontal ? x : y, animated);
            },
            scrollToEnd: (options: { animated?: boolean } = {}) => {
                const { animated = true } = options;
                const endOffset = getMaxScrollOffset();
                scrollToLocalOffset(endOffset, animated);
            },
            scrollToOffset: (params: { offset: number; animated?: boolean }) => {
                const { offset, animated = true } = params;
                scrollToLocalOffset(offset, animated);
            },
        };
        return api as unknown as HTMLDivElement & ScrollViewMethods;
    }, [
        externalTarget,
        getCurrentScrollOffset,
        getRawScrollOffset,
        getMaxScrollOffset,
        isScrollInRange,
        getScrollTarget,
        horizontal,
        isWindowScroll,
        scrollToLocalOffset,
    ]);

    // DOM scroll events can fire multiple times inside one paint. Coalesce them into a single
    // RN-shaped event per frame so downstream scroll bookkeeping sees stable measurements.
    const emitScroll = useCallback(() => {
        if (!onScroll || !scrollRef.current) {
            return;
        }

        const contentSize = getContentSize(contentRef.current);
        const layoutMeasurement = getLayoutMeasurement(scrollRef.current, externalTarget, horizontal);
        // Preserve the owner's position before/after this list for viewport calculations.
        // Imperative scroll targets still use the clamped list-local offset.
        const offset = getRawScrollOffset();

        const scrollEvent = {
            nativeEvent: {
                contentOffset: {
                    x: horizontal ? offset : 0,
                    y: horizontal ? 0 : offset,
                },
                contentSize: {
                    height: contentSize.height,
                    width: contentSize.width,
                },
                layoutMeasurement: {
                    height: layoutMeasurement.height,
                    width: layoutMeasurement.width,
                },
            },
        };

        onScroll(scrollEvent);
    }, [externalTarget, getRawScrollOffset, horizontal, onScroll]);

    const scrollEventCoalescer = useRafCoalescer(emitScroll);
    const scrollEndFallbackRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const emitScrollEnd = useCallback(() => {
        const timeout = scrollEndFallbackRef.current;
        if (timeout !== undefined) {
            clearTimeout(timeout);
            scrollEndFallbackRef.current = undefined;
        }
        scrollEventCoalescer.flush();
        onInternalScrollEnd?.();
    }, [onInternalScrollEnd, scrollEventCoalescer]);

    const handleScroll = useCallback(
        (_event: Event) => {
            if (!onScroll) {
                return;
            }

            const state = ctx.state;
            const shouldFlushImmediately =
                !!state?.scrollingTo ||
                (!!state?.initialScrollSession && !state.didFinishInitialScroll) ||
                (!!state?.initialScroll && !state.didFinishInitialScroll) ||
                (!!state && isInMVCPActiveMode(state));
            if (shouldFlushImmediately) {
                scrollEventCoalescer.flush();
            } else {
                scrollEventCoalescer.schedule();
            }

            if (onInternalScrollEnd) {
                const timeout = scrollEndFallbackRef.current;
                if (timeout !== undefined) {
                    clearTimeout(timeout);
                }
                scrollEndFallbackRef.current = setTimeout(emitScrollEnd, SCROLL_END_FALLBACK_MS);
            }
        },
        [ctx.state, emitScrollEnd, onInternalScrollEnd, onScroll, scrollEventCoalescer],
    );

    useLayoutEffect(() => {
        const target = getScrollTarget();
        if (!target) return;
        target.addEventListener("scroll", handleScroll, { passive: true });
        if ("onscrollend" in target) {
            target.addEventListener("scrollend", emitScrollEnd);
        }
        return () => {
            target.removeEventListener("scroll", handleScroll);
            if ("onscrollend" in target) {
                target.removeEventListener("scrollend", emitScrollEnd);
            }
            const timeout = scrollEndFallbackRef.current;
            if (timeout !== undefined) {
                clearTimeout(timeout);
                scrollEndFallbackRef.current = undefined;
            }
            scrollEventCoalescer.cancel();
        };
    }, [emitScrollEnd, getScrollTarget, handleScroll, scrollEventCoalescer]);

    useEffect(() => {
        const target = getScrollTarget();
        if (!target) return;
        const onWheel = (nativeEvent: Event) => {
            const event = nativeEvent as WheelEvent;
            const delta = horizontal ? event.deltaX || (event.shiftKey ? event.deltaY : 0) : event.deltaY;
            if (
                delta < 0 &&
                !event.ctrlKey &&
                !event.defaultPrevented &&
                (ctx.state.maintainingScrollAtEnd || ctx.state.pendingMaintainScrollAtEnd)
            ) {
                const offset = getCurrentScrollOffset();
                // A wheel gesture away from the end supersedes queued following.
                // Stop the browser animation too, without consuming the gesture.
                if (interruptMaintainScrollAtEnd(ctx) && isScrollInRange()) {
                    scrollToLocalOffset(offset, false);
                }
            }
        };
        target.addEventListener("wheel", onWheel, { passive: true });
        return () => target.removeEventListener("wheel", onWheel);
    }, [ctx, getCurrentScrollOffset, getScrollTarget, horizontal, isScrollInRange, scrollToLocalOffset]);

    // Set initial scroll offset
    useEffect(() => {
        const doScroll = () => {
            if (contentOffset) {
                scrollToLocalOffset(horizontal ? contentOffset.x || 0 : contentOffset.y || 0, false);
            }
        };
        doScroll();
        const frame = requestAnimationFrame(doScroll);
        return () => cancelAnimationFrame(frame);
    }, [contentOffset?.x, contentOffset?.y, horizontal, scrollToLocalOffset]);

    // The adapter owns layout in both external modes; the list itself is unbounded.
    useLayoutEffect(() => {
        const element = scrollRef.current;
        if (!onLayout || !element) return;
        return observeScrollLayout(element, externalTarget, () => {
            if (isExternalScroll && !ctx.state.lastLayout && !ctx.state.initialScroll) {
                // Seed the first range before layout allocates rows. The list may begin
                // below a header, or entirely outside the owner's viewport.
                ctx.state.scroll = ctx.state.scrollPending = getRawScrollOffset();
            }
            onLayout({ nativeEvent: { layout: getLayoutRectangle(element, externalTarget, horizontal) } });
            if (isExternalScroll) emitScroll();
        });
    }, [ctx, emitScroll, externalTarget, getRawScrollOffset, horizontal, isExternalScroll, onLayout]);

    const hiddenScrollIndicatorClassName =
        !isExternalScroll &&
        (horizontal
            ? !showsHorizontalScrollIndicator && LEGEND_LIST_SCROLLBAR_X_HIDDEN_CLASS
            : !showsVerticalScrollIndicator && LEGEND_LIST_SCROLLBAR_Y_HIDDEN_CLASS);

    useLayoutEffect(() => {
        if (hiddenScrollIndicatorClassName) {
            ensureScrollbarHiddenStyle();
        }
    }, [hiddenScrollIndicatorClassName]);

    const scrollViewStyle: CSSProperties = {
        ...(isExternalScroll
            ? {}
            : {
                  overflow: "auto",
                  overflowX: horizontal ? "auto" : showsHorizontalScrollIndicator ? "auto" : "hidden",
                  overflowY: horizontal ? (showsVerticalScrollIndicator ? "auto" : "hidden") : "auto",
                  WebkitOverflowScrolling: "touch", // iOS momentum scrolling
              }),
        ...StyleSheet.flatten(style),
        ...(maintainVisibleContentPosition
            ? {
                  // Chrome's native scroll anchoring can apply after LegendList's MVCP adjustment,
                  // causing the same header/item-size delta to be compensated twice.
                  overflowAnchor: "none",
              }
            : {}),
    };

    const contentInsetEndAdjustment = getContentInsetEndAdjustmentEnd(ctx);
    const anchoredEndInset = ctx.state?.props?.anchoredEndSpace && anchoredEndSpaceSize ? anchoredEndSpaceSize : 0;
    const renderedContentInsetEndAdjustment = Math.max(0, contentInsetEndAdjustment - anchoredEndInset);
    const contentInsetEndAdjustmentSpacerStyle: CSSProperties | undefined = renderedContentInsetEndAdjustment
        ? horizontal
            ? { flexShrink: 0, width: renderedContentInsetEndAdjustment }
            : { height: renderedContentInsetEndAdjustment }
        : undefined;
    const contentStyle: CSSProperties = {
        display: horizontal ? "flex" : "block",
        flexDirection: horizontal ? "row" : undefined,
        minHeight: horizontal ? undefined : "100%",
        minWidth: horizontal ? "100%" : undefined,
        ...StyleSheet.flatten(contentContainerStyle),
        ...(maintainVisibleContentPosition
            ? {
                  overflowAnchor: "none",
              }
            : {}),
    };
    const className = contentContainerClassName
        ? `${LEGEND_LIST_CONTENT_CONTAINER_CLASS} ${contentContainerClassName}`
        : LEGEND_LIST_CONTENT_CONTAINER_CLASS;

    const {
        contentContainerClassName: _contentContainerClassName,
        contentInset: _contentInset,
        scrollEventThrottle: _scrollEventThrottle,
        ScrollComponent: _ScrollComponent,
        snapToOffsets,
        className: scrollViewClassNameProp,
        ...webProps
    } = props as ListComponentScrollViewProps & ExtraPropsFromRN & HTMLAttributes<HTMLDivElement>;
    const snapOffsets = !isExternalScroll ? getFiniteSnapOffsets(snapToOffsets) : [];
    if (snapOffsets.length > 0) {
        scrollViewStyle.scrollSnapType = horizontal ? "x mandatory" : "y mandatory";
        contentStyle.position = contentStyle.position ?? "relative";
    }
    const scrollViewClassName = hiddenScrollIndicatorClassName
        ? scrollViewClassNameProp
            ? `${scrollViewClassNameProp} ${hiddenScrollIndicatorClassName}`
            : hiddenScrollIndicatorClassName
        : scrollViewClassNameProp;

    if (IS_DEV) {
        if (
            /(?:^|\s)(?:[a-z0-9_-]+:)*gap(?:-[xy])?-(?:\[[^\]]+\]|[^\s]+)/.test(
                `${contentContainerClassName ?? ""} ${scrollViewClassNameProp ?? ""}`,
            )
        ) {
            warnDevOnce(
                "className-gap",
                "className/contentContainerClassName gap classes are not supported in LegendList because it needs to use exact values internally. Use contentContainerStyle={{ gap: ... }} or columnWrapperStyle instead.",
            );
        }
    }

    return (
        <div
            className={scrollViewClassName}
            ref={scrollRef}
            {...(webProps as HTMLAttributes<HTMLDivElement>)}
            style={scrollViewStyle}
        >
            {refreshControl}
            <div className={className} ref={contentRef} style={contentStyle}>
                {snapOffsets.map((offset) => (
                    <div
                        aria-hidden={true}
                        data-legend-list-snap-anchor={offset}
                        key={`snap-${offset}`}
                        style={getSnapAnchorStyle(offset, horizontal)}
                    />
                ))}
                {children}
                {contentInsetEndAdjustmentSpacerStyle ? (
                    <div aria-hidden={true} style={contentInsetEndAdjustmentSpacerStyle} />
                ) : null}
            </div>
        </div>
    );
});
