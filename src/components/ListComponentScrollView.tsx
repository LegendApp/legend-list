// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import {
    type CSSProperties,
    forwardRef,
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

export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>;

export interface ScrollViewMethods {
    scrollBy(x: number, y: number): void;
    getBoundingClientRect(): DOMRect | null | undefined;
    scrollToEnd(options?: { animated?: boolean }): void;
    getScrollResponder(): any;
    getScrollableNode(): HTMLDivElement;
    scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
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
    scrollEventThrottle?: number;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    refreshControl?: ReactElement;
    children: ReactNode;
    style: CSSProperties;
    onLayout: (event: LayoutChangeEvent) => void;
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
        onMomentumScrollEnd,
        showsHorizontalScrollIndicator = true,
        showsVerticalScrollIndicator = true,
        refreshControl,
        onLayout,
        ...props
    }: ListComponentScrollViewProps,
    ref: React.Ref<HTMLDivElement>,
) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => {
        const api: ScrollViewMethods = {
            getBoundingClientRect: () => scrollRef.current?.getBoundingClientRect(),
            getScrollableNode: () => scrollRef.current!,
            getScrollResponder: () => scrollRef.current,
            scrollBy: (x: number, y: number) => {
                const el = scrollRef.current;
                if (!el) return;
                el.scrollBy(x, y);
            },
            scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => {
                const el = scrollRef.current;
                if (!el) return;
                const { x = 0, y = 0, animated = true } = options;
                el.scrollTo({ behavior: animated ? "smooth" : "auto", left: x, top: y });
            },
            scrollToEnd: (options: { animated?: boolean } = {}) => {
                const el = scrollRef.current;
                if (!el) return;
                const { animated = true } = options;
                if (horizontal) {
                    el.scrollTo({ behavior: animated ? "smooth" : "auto", left: el.scrollWidth });
                } else {
                    el.scrollTo({ behavior: animated ? "smooth" : "auto", top: el.scrollHeight });
                }
            },
            scrollToOffset: (params: { offset: number; animated?: boolean }) => {
                const el = scrollRef.current;
                if (!el) return;
                const { offset, animated = true } = params;
                if (horizontal) {
                    el.scrollTo({ behavior: animated ? "smooth" : "auto", left: offset });
                } else {
                    el.scrollTo({ behavior: animated ? "smooth" : "auto", top: offset });
                }
            },
        };
        return api as unknown as HTMLDivElement & ScrollViewMethods;
    }, [horizontal]);

    const handleScroll = useCallback(
        (event: Event) => {
            if (!onScroll || !event?.target) {
                return;
            }

            const target = event.target as HTMLDivElement;

            const scrollEvent = {
                nativeEvent: {
                    contentOffset: {
                        x: target.scrollLeft,
                        y: target.scrollTop,
                    },
                    contentSize: {
                        height: target.scrollHeight,
                        width: target.scrollWidth,
                    },
                    layoutMeasurement: {
                        height: target.clientHeight,
                        width: target.clientWidth,
                    },
                },
            };

            onScroll(scrollEvent);
        },
        [onScroll, onMomentumScrollEnd],
    );

    useLayoutEffect(() => {
        const element = scrollRef.current;
        if (!element) return;

        element.addEventListener("scroll", handleScroll);
        return () => {
            element.removeEventListener("scroll", handleScroll);
        };
    }, [handleScroll]);

    // Set initial scroll offset
    useEffect(() => {
        const doScroll = () => {
            if (contentOffset && scrollRef.current) {
                scrollRef.current.scrollLeft = contentOffset.x || 0;
                scrollRef.current.scrollTop = contentOffset.y || 0;
            }
        };
        doScroll();
        requestAnimationFrame(doScroll);
    }, [contentOffset?.x, contentOffset?.y]);

    // Handle layout callback and observe size changes at the ScrollView level
    useLayoutEffect(() => {
        if (!onLayout || !scrollRef.current) return;
        const element = scrollRef.current;

        const fireLayout = () => {
            const rect = element.getBoundingClientRect();
            onLayout({
                nativeEvent: {
                    layout: {
                        height: rect.height,
                        width: rect.width,
                        x: rect.left,
                        y: rect.top,
                    },
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

        return () => resizeObserver.disconnect();
    }, [onLayout]);

    const scrollViewStyle: CSSProperties = {
        overflow: "auto",
        overflowX: horizontal ? "auto" : showsHorizontalScrollIndicator ? "auto" : "hidden",
        overflowY: horizontal ? (showsVerticalScrollIndicator ? "auto" : "hidden") : "auto",
        position: "relative", // Ensure proper positioning context
        WebkitOverflowScrolling: "touch", // iOS momentum scrolling
        ...StyleSheet.flatten(style),
    };

    const contentStyle: CSSProperties = {
        display: horizontal ? "flex" : "block",
        flexDirection: horizontal ? "row" : undefined,
        minHeight: horizontal ? undefined : "100%",
        minWidth: horizontal ? "100%" : undefined,
        ...StyleSheet.flatten(contentContainerStyle),
    };

    return (
        <div ref={scrollRef} style={scrollViewStyle} {...props}>
            {refreshControl}
            <div ref={contentRef} style={contentStyle}>
                {children}
            </div>
        </div>
    );
});
