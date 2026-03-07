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
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollEventRafRef = useRef<number | undefined>(undefined);
    const isWindowScroll = useWindowScroll;
    const getScrollTarget = useCallback(
        () => resolveScrollEventTarget(scrollRef.current, isWindowScroll),
        [isWindowScroll],
    );

    const getMaxScrollOffset = useCallback(() => {
        const scrollElement = scrollRef.current;
        const contentSize = getScrollContentSize(scrollElement, contentRef.current, isWindowScroll);
        const layoutMeasurement = getLayoutMeasurement(scrollElement, isWindowScroll, horizontal);
        return getMaxOffset(contentSize, layoutMeasurement, horizontal);
    }, [horizontal, isWindowScroll]);

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

            target.scrollTo(options);
        },
        [getMaxScrollOffset, getScrollTarget, horizontal, isWindowScroll],
    );

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

        onScroll(scrollEvent);
    }, [getCurrentScrollOffset, horizontal, isWindowScroll, onScroll]);

    const handleScroll = useCallback(
        (_event: Event) => {
            if (!onScroll || scrollEventRafRef.current !== undefined) {
                return;
            }

            scrollEventRafRef.current = requestAnimationFrame(() => {
                scrollEventRafRef.current = undefined;
                emitScroll();
            });
        },
        [emitScroll, onScroll],
    );

    useLayoutEffect(() => {
        const target = getScrollTarget();
        if (!target) return;
        target.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            target.removeEventListener("scroll", handleScroll);
            if (scrollEventRafRef.current !== undefined) {
                cancelAnimationFrame(scrollEventRafRef.current);
                scrollEventRafRef.current = undefined;
            }
        };
    }, [getScrollTarget, handleScroll]);

    // Set initial scroll offset
    useEffect(() => {
        const doScroll = () => {
            if (contentOffset) {
                scrollToLocalOffset(horizontal ? contentOffset.x || 0 : contentOffset.y || 0, false);
            }
        };
        doScroll();
        requestAnimationFrame(doScroll);
    }, [contentOffset?.x, contentOffset?.y, horizontal, scrollToLocalOffset]);

    // Handle layout callback and observe size changes at the ScrollView level
    useLayoutEffect(() => {
        if (!onLayout || !scrollRef.current) return;
        const element = scrollRef.current;

        const fireLayout = () => {
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

        const onWindowResize = () => {
            fireLayout();
        };
        if (isWindowScroll && typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("resize", onWindowResize);
        }

        return () => {
            resizeObserver.disconnect();
            if (isWindowScroll && typeof window !== "undefined" && typeof window.removeEventListener === "function") {
                window.removeEventListener("resize", onWindowResize);
            }
        };
    }, [isWindowScroll, onLayout]);

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
