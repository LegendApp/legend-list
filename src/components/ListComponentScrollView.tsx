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

import type { LayoutRectangle, NativeSyntheticEvent } from "@/platform/platform-types";
import { StyleSheet } from "@/platform/StyleSheet";
import { useStateContext } from "@/state/state";
import { useRafCoalescer } from "@/utils/useRafCoalescer";
import {
    clampOffset,
    getContentSize,
    getElementDocumentPosition,
    getLayoutMeasurement,
    getLayoutRectangle,
    getMaxOffset,
    getScrollContentSize,
    getWindowScrollPosition,
    resolveScrollableNode,
    resolveScrollEventTarget,
    resolveWindowScrollTarget,
    type ScrollEventTarget,
} from "./webScrollUtils";

export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>;

export interface ScrollViewMethods {
    getBoundingClientRect(): DOMRect | null | undefined;
    getContentNode(): HTMLElement | null;
    getCurrentScrollOffset(): number;
    getScrollableNode(): HTMLElement;
    getScrollEventTarget(): ScrollEventTarget | null;
    getScrollResponder(): HTMLElement | null;
    isWindowScroll?(): boolean;
    scrollBy(x: number, y: number): void;
    scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
    scrollToEnd(options?: { animated?: boolean }): void;
    scrollToOffset(params: { offset: number; animated?: boolean }): void;
}

export interface ListComponentScrollViewProps {
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
    onMomentumScrollEnd?: (event: {
        nativeEvent: {
            contentOffset: { x: number; y: number };
        };
    }) => void;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    refreshControl?: ReactElement;
    children: ReactNode;
    style: CSSProperties;
    useWindowScroll?: boolean;
    onLayout: (event: LayoutChangeEvent) => void;
}

interface ExtraPropsFromRN {
    contentInset?: { bottom?: number; left?: number; right?: number; top?: number };
    scrollEventThrottle?: number;
    ScrollComponent?: React.ComponentType<unknown>;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const ListComponentScrollView = forwardRef(function ListComponentScrollView(
    {
        children,
        style,
        contentContainerStyle,
        horizontal = false,
        contentOffset,
        maintainVisibleContentPosition,
        onScroll,
        onMomentumScrollEnd: _onMomentumScrollEnd,
        showsHorizontalScrollIndicator = true,
        showsVerticalScrollIndicator = true,
        refreshControl,
        useWindowScroll = false,
        onLayout,
        ...props
    }: ListComponentScrollViewProps,
    ref: React.Ref<HTMLDivElement>,
) {
    const ctx = useStateContext();
    const debugInitialEnd = useCallback((event: string, payload: Record<string, unknown>) => {
        if (!ctx.state || (!ctx.state.initialScroll && !ctx.state.scrollingTo?.isInitialScroll && ctx.state.deferredPositions?.kind !== "initial_scroll")) {
            return;
        }

        const debugState = ((globalThis as any).__legendInitialEndDebug ??= { seq: 0 }) as { seq: number };
        console.log(`${Date.now()} [debug-log bidirectional-initial-end initial-end-v2] ${event}`, {
            seq: ++debugState.seq,
            ...payload,
        });
    }, [ctx]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const syncEndAlignedInitialScrollOffsetRef = useRef<(source: string) => boolean>(() => false);
    const isWindowScroll = useWindowScroll;
    const isEndAlignedInitialScrollActive = useCallback(() => {
        const state = ctx.state;
        const initialTarget = state?.initialScrollLastTarget ?? state?.initialScroll;
        return !!(
            state &&
            initialTarget &&
            initialTarget.viewPosition === 1 &&
            initialTarget.index !== undefined &&
            (state.scrollingTo?.isInitialScroll || state.initialScroll || state.deferredPositions?.kind === "initial_scroll")
        );
    }, [ctx.state]);
    const getScrollTarget = useCallback(
        () => resolveScrollEventTarget(scrollRef.current, isWindowScroll),
        [isWindowScroll],
    );

    const getMaxScrollOffset = useCallback(() => {
        const scrollElement = scrollRef.current;
        const contentElement = contentRef.current;
        const contentSize = getScrollContentSize(scrollElement, contentElement, isWindowScroll);
        const publishedTotalSize = ctx.values.get("totalSize");
        const clampedContentSize =
            isEndAlignedInitialScrollActive() && Number.isFinite(publishedTotalSize)
                ? horizontal
                    ? {
                          ...contentSize,
                          width: Math.min(
                              contentSize.width,
                              publishedTotalSize +
                                  Math.max(0, (scrollElement?.scrollWidth ?? publishedTotalSize) - (contentElement?.scrollWidth ?? 0)),
                          ),
                      }
                    : {
                          ...contentSize,
                          height: Math.min(
                              contentSize.height,
                              publishedTotalSize +
                                  Math.max(
                                      0,
                                      (scrollElement?.scrollHeight ?? publishedTotalSize) - (contentElement?.scrollHeight ?? 0),
                                  ),
                          ),
                      }
                : contentSize;
        const layoutMeasurement = getLayoutMeasurement(scrollElement, isWindowScroll, horizontal);
        return getMaxOffset(clampedContentSize, layoutMeasurement, horizontal);
    }, [ctx.values, horizontal, isEndAlignedInitialScrollActive, isWindowScroll]);

    const getCurrentScrollOffset = useCallback(() => {
        const scrollElement = scrollRef.current;

        if (isWindowScroll) {
            const maxOffset = getMaxScrollOffset();
            const scroll = getWindowScrollPosition();
            const listPos = getElementDocumentPosition(scrollElement, scroll);
            const rawOffset = horizontal ? scroll.x - listPos.left : scroll.y - listPos.top;
            return clampOffset(rawOffset, maxOffset);
        }

        if (!scrollElement) {
            return 0;
        }

        return horizontal ? scrollElement.scrollLeft : scrollElement.scrollTop;
    }, [getMaxScrollOffset, horizontal, isWindowScroll]);

    const syncEndAlignedInitialContentExtent = useCallback(() => {
        if (!isEndAlignedInitialScrollActive()) {
            return false;
        }

        const contentElement = contentRef.current;
        const publishedTotalSize = ctx.values.get("totalSize");
        if (!contentElement || !Number.isFinite(publishedTotalSize)) {
            return false;
        }

        if (horizontal) {
            if ((contentElement.scrollWidth ?? 0) + 1 >= publishedTotalSize) {
                return false;
            }
            contentElement.style.minWidth = `${publishedTotalSize}px`;
            return true;
        }

        if ((contentElement.scrollHeight ?? 0) + 1 >= publishedTotalSize) {
            return false;
        }
        contentElement.style.minHeight = `${publishedTotalSize}px`;
        return true;
    }, [ctx.values, horizontal, isEndAlignedInitialScrollActive]);

    const scrollToLocalOffset = useCallback(
        (offset: number, animated: boolean) => {
            const scrollElement = scrollRef.current;
            const target = getScrollTarget();
            if (!target || typeof target.scrollTo !== "function") {
                return;
            }

            syncEndAlignedInitialContentExtent();
            const maxOffset = getMaxScrollOffset();
            const clampedOffset = clampOffset(offset, maxOffset);
            const behavior = animated ? "smooth" : "auto";
            const options: ScrollToOptions = { behavior };

            if (isWindowScroll) {
                const scroll = getWindowScrollPosition();
                const listPos = getElementDocumentPosition(scrollElement, scroll);
                const { left, top } = resolveWindowScrollTarget({
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

            debugInitialEnd("dom-scroll-to", {
                animated,
                clampedOffset,
                currentOffset: getCurrentScrollOffset(),
                maxOffset,
            });
            target.scrollTo(options);
            if (!animated && ctx.state?.scrollingTo?.isInitialScroll) {
                const appliedOffset = getCurrentScrollOffset();
                ctx.state.scroll = appliedOffset;
                ctx.state.scrollPending = appliedOffset;
                debugInitialEnd("dom-scroll-to-applied", {
                    appliedOffset,
                    maxOffset,
                });
                queueMicrotask(() => {
                    syncEndAlignedInitialScrollOffsetRef.current("post-scroll-microtask");
                });
            }
        },
        [
            ctx.state,
            debugInitialEnd,
            getCurrentScrollOffset,
            getMaxScrollOffset,
            getScrollTarget,
            horizontal,
            isWindowScroll,
            syncEndAlignedInitialContentExtent,
        ],
    );

    const syncEndAlignedInitialScrollOffset = useCallback(
        (source: string) => {
            if (!isEndAlignedInitialScrollActive()) {
                return false;
            }

            syncEndAlignedInitialContentExtent();
            const maxOffset = getMaxScrollOffset();
            const currentOffset = getCurrentScrollOffset();
            if (maxOffset <= 0 || Math.abs(currentOffset - maxOffset) <= 1) {
                return maxOffset > 0;
            }

            debugInitialEnd("sync-end-aligned-initial-scroll", {
                contentClientHeight: contentRef.current?.clientHeight,
                contentScrollHeight: contentRef.current?.scrollHeight,
                currentOffset,
                deferredDrift: ctx.state?.deferredPositions?.drift,
                maxOffset,
                publishedTotalSize: ctx.values.get("totalSize"),
                scrollClientHeight: scrollRef.current?.clientHeight,
                scrollScrollHeight: scrollRef.current?.scrollHeight,
                source,
                totalSizeExact: ctx.state?.totalSizeExact,
            });
            scrollToLocalOffset(maxOffset, false);
            return true;
        },
        [
            ctx.state,
            ctx.values,
            debugInitialEnd,
            getCurrentScrollOffset,
            getMaxScrollOffset,
            isEndAlignedInitialScrollActive,
            scrollToLocalOffset,
            syncEndAlignedInitialContentExtent,
        ],
    );
    syncEndAlignedInitialScrollOffsetRef.current = syncEndAlignedInitialScrollOffset;

    useLayoutEffect(() => {
        syncEndAlignedInitialScrollOffset("layout-effect");
    });

    useLayoutEffect(() => {
        if (isEndAlignedInitialScrollActive()) {
            return;
        }

        const contentElement = contentRef.current;
        if (!contentElement) {
            return;
        }

        contentElement.style.minHeight = horizontal ? "" : "100%";
        contentElement.style.minWidth = horizontal ? "100%" : "";
    }, [horizontal, isEndAlignedInitialScrollActive]);

    useImperativeHandle(ref, () => {
        const api: ScrollViewMethods = {
            getBoundingClientRect: () => scrollRef.current?.getBoundingClientRect(),
            getContentNode: () => contentRef.current,
            getCurrentScrollOffset,
            getScrollableNode: () => resolveScrollableNode(scrollRef.current, isWindowScroll)!,
            getScrollEventTarget: () => getScrollTarget(),
            getScrollResponder: () => resolveScrollableNode(scrollRef.current, isWindowScroll),
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
    }, [getCurrentScrollOffset, getMaxScrollOffset, getScrollTarget, horizontal, isWindowScroll, scrollToLocalOffset]);

    // DOM scroll events can fire multiple times inside one paint. Coalesce them into a single
    // RN-shaped event per frame so downstream scroll bookkeeping sees stable measurements.
    const emitScroll = useCallback(() => {
        if (!onScroll || !scrollRef.current) {
            return;
        }

        const contentSize = getContentSize(contentRef.current);
        const layoutMeasurement = getLayoutMeasurement(scrollRef.current, isWindowScroll, horizontal);
        const offset = getCurrentScrollOffset();

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

        debugInitialEnd("dom-scroll", {
            contentHeight: contentSize.height,
            contentWidth: contentSize.width,
            layoutHeight: layoutMeasurement.height,
            layoutWidth: layoutMeasurement.width,
            offset,
        });

        onScroll(scrollEvent);
        syncEndAlignedInitialScrollOffset("scroll-event");
    }, [getCurrentScrollOffset, horizontal, isWindowScroll, onScroll, syncEndAlignedInitialScrollOffset]);

    const scrollEventCoalescer = useRafCoalescer(emitScroll);

    const handleScroll = useCallback(
        (_event: Event) => {
            if (!onScroll) {
                return;
            }

            const scrollingTo = ctx.state?.scrollingTo;
            if (scrollingTo && !scrollingTo.animated) {
                scrollEventCoalescer.flush();
            } else {
                scrollEventCoalescer.schedule();
            }
        },
        [onScroll, scrollEventCoalescer],
    );

    useLayoutEffect(() => {
        const target = getScrollTarget();
        if (!target) return;
        target.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            target.removeEventListener("scroll", handleScroll);
            scrollEventCoalescer.cancel();
        };
    }, [getScrollTarget, handleScroll, scrollEventCoalescer]);

    // Set initial scroll offset
    useEffect(() => {
        const doScroll = (source: "effect" | "raf") => {
            const shouldSkipFollowupInitialScrollReplay =
                source === "raf" &&
                !!(
                    ctx.state?.initialScroll ||
                    ctx.state?.initialScrollLastTarget ||
                    ctx.state?.deferredPositions?.kind === "initial_scroll"
                );
            const shouldSkipContentOffsetReplay = !!(
                ctx.state?.scrollingTo?.isInitialScroll ||
                shouldSkipFollowupInitialScrollReplay
            );

            if (shouldSkipContentOffsetReplay) {
                debugInitialEnd("content-offset-skipped", {
                    currentOffset: getCurrentScrollOffset(),
                    maxOffset: getMaxScrollOffset(),
                    hasDeferredInitialScroll: ctx.state?.deferredPositions?.kind === "initial_scroll",
                    hasInitialScroll: !!ctx.state?.initialScroll,
                    hasInitialScrollLastTarget: !!ctx.state?.initialScrollLastTarget,
                    source,
                });
                return;
            }

            if (syncEndAlignedInitialScrollOffset(`contentOffset:${source}`)) {
                return;
            }

            if (contentOffset) {
                debugInitialEnd("content-offset-effect", {
                    contentOffset,
                    currentOffset: getCurrentScrollOffset(),
                    maxOffset: getMaxScrollOffset(),
                    source,
                });
                scrollToLocalOffset(horizontal ? contentOffset.x || 0 : contentOffset.y || 0, false);
            }
        };
        doScroll("effect");
        requestAnimationFrame(() => doScroll("raf"));
    }, [
        contentOffset?.x,
        contentOffset?.y,
        ctx.state,
        getCurrentScrollOffset,
        getMaxScrollOffset,
        horizontal,
        scrollToLocalOffset,
        syncEndAlignedInitialScrollOffset,
    ]);

    // Handle layout callback and observe size changes at the ScrollView level
    useLayoutEffect(() => {
        if (!onLayout || !scrollRef.current) return;
        const element = scrollRef.current;
        const contentElement = contentRef.current;

        const fireLayout = () => {
            syncEndAlignedInitialScrollOffset("scrollview-layout");
            debugInitialEnd("scrollview-layout", {
                currentOffset: getCurrentScrollOffset(),
                layout: getLayoutRectangle(element, isWindowScroll, horizontal),
                maxOffset: getMaxScrollOffset(),
                scrollContentSize: getScrollContentSize(element, contentRef.current, isWindowScroll),
            });
            onLayout({
                nativeEvent: {
                    layout: getLayoutRectangle(element, isWindowScroll, horizontal),
                },
            });
        };

        // Initial
        fireLayout();

        // Observe ScrollView size changes
        const resizeObserver = new ResizeObserver(() => {
            fireLayout();
        });
        resizeObserver.observe(element);

        const contentResizeObserver = new ResizeObserver(() => {
            syncEndAlignedInitialScrollOffset("content-resize");
        });
        if (contentElement) {
            contentResizeObserver.observe(contentElement);
        }

        const onWindowResize = () => {
            fireLayout();
        };
        if (isWindowScroll && typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("resize", onWindowResize);
        }

        return () => {
            resizeObserver.disconnect();
            contentResizeObserver.disconnect();
            if (isWindowScroll && typeof window !== "undefined" && typeof window.removeEventListener === "function") {
                window.removeEventListener("resize", onWindowResize);
            }
        };
    }, [getCurrentScrollOffset, getMaxScrollOffset, horizontal, isWindowScroll, onLayout, syncEndAlignedInitialScrollOffset]);

    const scrollViewStyle: CSSProperties = {
        ...(isWindowScroll
            ? {}
            : {
                  overflow: "auto",
                  overflowX: horizontal ? "auto" : showsHorizontalScrollIndicator ? "auto" : "hidden",
                  overflowY: horizontal ? (showsVerticalScrollIndicator ? "auto" : "hidden") : "auto",
                  WebkitOverflowScrolling: "touch", // iOS momentum scrolling
              }),
        ...StyleSheet.flatten(style),
    };

    const contentStyle: CSSProperties = {
        display: horizontal ? "flex" : "block",
        flexDirection: horizontal ? "row" : undefined,
        minHeight: horizontal ? undefined : "100%",
        minWidth: horizontal ? "100%" : undefined,
        ...StyleSheet.flatten(contentContainerStyle),
    };

    const {
        contentInset: _contentInset,
        scrollEventThrottle: _scrollEventThrottle,
        ScrollComponent: _ScrollComponent,
        useWindowScroll: _useWindowScroll,
        ...webProps
    } = props as ListComponentScrollViewProps & ExtraPropsFromRN;

    return (
        <div ref={scrollRef} {...(webProps as HTMLAttributes<HTMLDivElement>)} style={scrollViewStyle}>
            {refreshControl}
            <div ref={contentRef} style={contentStyle}>
                {children}
            </div>
        </div>
    );
});
