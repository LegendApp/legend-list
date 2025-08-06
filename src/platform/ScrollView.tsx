import * as React from "react";
import type { CSSProperties } from "react";
import type { ViewProps, ViewStyle } from "./View";

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
        return Object.assign({}, ...style.filter(Boolean));
    }
    return style;
};

export const ScrollView = React.forwardRef<HTMLDivElement, ScrollViewProps>(({
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
}, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const lastScrollTime = React.useRef<number>(0);
    const momentumTimeout = React.useRef<NodeJS.Timeout>();

    React.useImperativeHandle(ref, () => scrollRef.current!, []);

    const handleScroll = React.useCallback((event: Event) => {
        if (!onScroll) return;

        const target = event.target as HTMLDivElement;
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
                    width: target.scrollWidth,
                    height: target.scrollHeight,
                },
                layoutMeasurement: {
                    width: target.clientWidth,
                    height: target.clientHeight,
                },
            },
        };

        onScroll(scrollEvent);

        // Handle momentum scroll end
        if (onMomentumScrollEnd) {
            if (momentumTimeout.current) {
                clearTimeout(momentumTimeout.current);
            }
            momentumTimeout.current = setTimeout(() => {
                onMomentumScrollEnd({
                    nativeEvent: {
                        contentOffset: scrollEvent.nativeEvent.contentOffset,
                    },
                });
            }, 100); // Delay to detect end of scroll momentum
        }
    }, [onScroll, onMomentumScrollEnd, scrollEventThrottle]);

    React.useLayoutEffect(() => {
        const element = scrollRef.current;
        if (!element) return;

        element.addEventListener('scroll', handleScroll, { passive: true });
        return () => element.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // Set initial scroll offset
    React.useLayoutEffect(() => {
        if (contentOffset && scrollRef.current) {
            scrollRef.current.scrollLeft = contentOffset.x || 0;
            scrollRef.current.scrollTop = contentOffset.y || 0;
        }
    }, [contentOffset]);

    // Handle layout callback
    React.useLayoutEffect(() => {
        if (onLayout && scrollRef.current) {
            const element = scrollRef.current;
            const rect = element.getBoundingClientRect();
            onLayout({
                nativeEvent: {
                    layout: {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height,
                    },
                },
            });
        }
    }, [onLayout]);

    const scrollViewStyle: CSSProperties = {
        overflow: 'auto',
        overflowX: horizontal ? 'auto' : showsHorizontalScrollIndicator ? 'auto' : 'hidden',
        overflowY: horizontal ? (showsVerticalScrollIndicator ? 'auto' : 'hidden') : 'auto',
        WebkitOverflowScrolling: 'touch', // iOS momentum scrolling
        position: 'relative', // Ensure proper positioning context
        ...convertStyleArray(style),
    };

    const contentStyle: CSSProperties = {
        display: horizontal ? 'flex' : 'block',
        flexDirection: horizontal ? 'row' : undefined,
        minWidth: horizontal ? '100%' : undefined,
        minHeight: horizontal ? undefined : '100%',
        ...convertStyleArray(contentContainerStyle),
    };

    // Methods that might be called on the ref
    React.useLayoutEffect(() => {
        if (scrollRef.current) {
            const element = scrollRef.current;
            
            // Add ScrollView-like methods
            (element as any).flashScrollIndicators = () => {
                // Flash scroll indicators (visual feedback)
                element.style.scrollbarColor = '#007AFF auto';
                setTimeout(() => {
                    element.style.scrollbarColor = '';
                }, 300);
            };

            (element as any).getScrollableNode = () => element;
            (element as any).getScrollResponder = () => element;
        }
    }, []);

    return (
        <div ref={scrollRef} style={scrollViewStyle} {...props}>
            {refreshControl}
            <div ref={contentRef} style={contentStyle}>
                {children}
            </div>
        </div>
    );
});

ScrollView.displayName = "ScrollView";