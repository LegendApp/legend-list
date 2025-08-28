import type React from "react";
import {
    type CSSProperties,
    forwardRef,
    type ReactElement,
    type ReactNode,
    useCallback,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
} from "react";

import type { LayoutRectangle } from "@/platform/Layout";

export interface NativeSyntheticEvent<T> {
    nativeEvent: T;
}

export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>;

export interface ScrollViewMethods {
    scrollToEnd(options?: { animated?: boolean }): void;
    getScrollResponder(): any;
    getScrollableNode(): any;
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
    const momentumTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(ref, () => {
        const api: ScrollViewMethods = {
            getScrollableNode: () => scrollRef.current,
            getScrollResponder: () => scrollRef.current,
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

            // Handle momentum scroll end
            if (onMomentumScrollEnd) {
                if (momentumTimeout.current != null) clearTimeout(momentumTimeout.current);
                momentumTimeout.current = setTimeout(() => {
                    onMomentumScrollEnd({
                        nativeEvent: {
                            contentOffset: scrollEvent.nativeEvent.contentOffset,
                        },
                    });
                }, 100); // Delay to detect end of scroll momentum
            }
        },
        [onScroll, onMomentumScrollEnd],
    );

    useLayoutEffect(() => {
        const element = scrollRef.current;
        if (!element) return;

        element.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            element.removeEventListener("scroll", handleScroll);
        };
    }, [handleScroll]);

    // Set initial scroll offset
    useLayoutEffect(() => {
        if (contentOffset && scrollRef.current) {
            scrollRef.current.scrollLeft = contentOffset.x || 0;
            scrollRef.current.scrollTop = contentOffset.y || 0;
        }
    }, [contentOffset]);

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
        ...style,
    };

    const contentStyle: CSSProperties = {
        display: horizontal ? "flex" : "block",
        flexDirection: horizontal ? "row" : undefined,
        minHeight: horizontal ? undefined : "100%",
        minWidth: horizontal ? "100%" : undefined,
        ...contentContainerStyle,
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
