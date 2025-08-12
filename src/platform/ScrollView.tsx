import type { CSSProperties } from "react";
import * as React from "react";

import type { ViewProps, ViewStyle } from "./View";

// Additional ScrollView methods that LegendList expects
export interface ScrollViewMethods {
    scrollToEnd(options?: { animated?: boolean }): void;
    flashScrollIndicators(): void;
    getScrollResponder(): any;
    getScrollableNode(): any;
    scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
    scrollToOffset(params: { offset: number; animated?: boolean }): void;
}

export interface ScrollViewProps extends Omit<ViewProps, "onScroll"> {
    horizontal?: boolean;
    contentContainerStyle?: ViewStyle | ViewStyle[];
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
    refreshControl?: React.ReactElement;
}

const convertStyleArray = (style: ViewStyle | ViewStyle[] | undefined): CSSProperties => {
    if (!style) return {};
    if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean)) as unknown as CSSProperties;
    }
    return style as unknown as CSSProperties;
};

export const ScrollView = React.forwardRef<HTMLDivElement & ScrollViewMethods, ScrollViewProps>(
    (
        {
            children,
            style,
            contentContainerStyle,
            horizontal = false,
            contentOffset,
            maintainVisibleContentPosition,
            onScroll,
            onMomentumScrollEnd,
            scrollEventThrottle = 16,
            showsHorizontalScrollIndicator = true,
            showsVerticalScrollIndicator = true,
            refreshControl,
            onLayout,
            ...props
        },
        ref,
    ) => {
        const scrollRef = React.useRef<HTMLDivElement>(null);
        const contentRef = React.useRef<HTMLDivElement>(null);
        const lastScrollTime = React.useRef<number>(0);
        const momentumTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

        React.useImperativeHandle(ref, () => {
            const api: ScrollViewMethods & any = {
                flashScrollIndicators: () => {
                    const el = scrollRef.current;
                    if (!el) return;
                    el.style.scrollbarColor = "#007AFF auto";
                    setTimeout(() => {
                        // Use the same element reference captured at call time
                        el.style.scrollbarColor = "";
                    }, 300);
                },
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

        // rAF-coalesced scroll handler to reduce main-thread pressure on web
        const rafId = React.useRef<number | null>(null);
        const pendingEvent = React.useRef<Event | null>(null);

        const handleScroll = React.useCallback(
            (event: Event) => {
                if (!onScroll) return;
                pendingEvent.current = event;

                // if (rafId.current == null) {
                //     rafId.current = requestAnimationFrame(() => {
                // rafId.current = null;

                const e = pendingEvent.current as Event | null;
                pendingEvent.current = null;
                if (!e) return;

                const target = e.target as HTMLDivElement;
                const now = Date.now();

                // Throttle scroll events
                if (now - lastScrollTime.current < scrollEventThrottle) return;
                lastScrollTime.current = now;

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
                //     });
                // }
            },
            [onScroll, onMomentumScrollEnd, scrollEventThrottle],
        );

        React.useLayoutEffect(() => {
            const element = scrollRef.current;
            if (!element) return;

            element.addEventListener("scroll", handleScroll, { passive: true });
            return () => {
                element.removeEventListener("scroll", handleScroll);
                if (rafId.current != null) cancelAnimationFrame(rafId.current);
                rafId.current = null;
                pendingEvent.current = null;
            };
        }, [handleScroll]);

        // Set initial scroll offset
        React.useLayoutEffect(() => {
            if (contentOffset && scrollRef.current) {
                scrollRef.current.scrollLeft = contentOffset.x || 0;
                scrollRef.current.scrollTop = contentOffset.y || 0;
            }
        }, [contentOffset]);

        // Handle layout callback and observe size changes at the ScrollView level
        React.useLayoutEffect(() => {
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
            ...convertStyleArray(style),
        };

        const contentStyle: CSSProperties = {
            display: horizontal ? "flex" : "block",
            flexDirection: horizontal ? "row" : undefined,
            minHeight: horizontal ? undefined : "100%",
            minWidth: horizontal ? "100%" : undefined,
            ...convertStyleArray(contentContainerStyle),
        };

        // Filter out React Native specific props that shouldn't be passed to DOM
        const {
            pointerEvents: _pointerEvents,
            testID: _testID,
            accessibilityLabel: _accessibilityLabel,
            ...domProps
        } = props as any;

        return (
            <div ref={scrollRef} style={scrollViewStyle} {...domProps}>
                {refreshControl}
                <div ref={contentRef} style={contentStyle}>
                    {children}
                </div>
            </div>
        );
    },
);

ScrollView.displayName = "ScrollView";
