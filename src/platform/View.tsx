import * as React from "react";
import type { CSSProperties } from "react";

export type DimensionValue = string | number;

export interface ViewStyle extends CSSProperties {
    // Add common React Native ViewStyle properties that translate to CSS
    paddingVertical?: number;
    paddingHorizontal?: number;
    marginVertical?: number;
    marginHorizontal?: number;
}

export type StyleProp<T> = T | T[] | undefined;

export interface ViewProps {
    children?: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
    onLayout?: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
    pointerEvents?: "auto" | "none" | "box-none" | "box-only";
    testID?: string;
    accessibilityLabel?: string;
    ref?: React.Ref<HTMLDivElement>;
}

const convertStyleArray = (style: ViewStyle | ViewStyle[] | undefined): CSSProperties => {
    if (!style) return {};
    
    const processStyle = (s: ViewStyle): CSSProperties => {
        const { paddingVertical, paddingHorizontal, marginVertical, marginHorizontal, ...rest } = s;
        const result: CSSProperties = { ...rest };
        
        // Convert React Native shorthand properties to CSS
        if (paddingVertical !== undefined) {
            result.paddingTop = paddingVertical;
            result.paddingBottom = paddingVertical;
        }
        if (paddingHorizontal !== undefined) {
            result.paddingLeft = paddingHorizontal;
            result.paddingRight = paddingHorizontal;
        }
        if (marginVertical !== undefined) {
            result.marginTop = marginVertical;
            result.marginBottom = marginVertical;
        }
        if (marginHorizontal !== undefined) {
            result.marginLeft = marginHorizontal;
            result.marginRight = marginHorizontal;
        }
        
        return result;
    };
    
    if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean).map(processStyle));
    }
    return processStyle(style);
};

const convertPointerEvents = (pointerEvents?: ViewProps["pointerEvents"]): string | undefined => {
    switch (pointerEvents) {
        case "none":
            return "none";
        case "box-none":
            return "none";
        case "box-only":
            return "auto";
        case "auto":
        default:
            return "auto";
    }
};

export const View = React.forwardRef<HTMLDivElement, ViewProps>(({ 
    children, 
    style, 
    onLayout,
    pointerEvents,
    testID,
    accessibilityLabel,
    ...props 
}, ref) => {
    const divRef = React.useRef<HTMLDivElement>(null);
    const combinedRef = React.useCallback((node: HTMLDivElement) => {
        if (divRef.current) {
            divRef.current = node;
        }
        if (ref) {
            if (typeof ref === "function") {
                ref(node);
            } else {
                ref.current = node;
            }
        }
    }, [ref]);

    React.useLayoutEffect(() => {
        if (onLayout && divRef.current) {
            const element = divRef.current;
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

            // Set up ResizeObserver for future layout changes
            const resizeObserver = new ResizeObserver(([entry]) => {
                const { contentRect } = entry;
                onLayout({
                    nativeEvent: {
                        layout: {
                            x: contentRect.x,
                            y: contentRect.y,
                            width: contentRect.width,
                            height: contentRect.height,
                        },
                    },
                });
            });

            resizeObserver.observe(element);
            return () => resizeObserver.disconnect();
        }
    }, [onLayout]);

    const combinedStyle: CSSProperties = {
        display: 'flex', // Default to flexbox like React Native
        flexDirection: 'column', // Default flex direction
        ...convertStyleArray(style),
        pointerEvents: convertPointerEvents(pointerEvents),
    };

    return (
        <div
            ref={combinedRef}
            style={combinedStyle}
            data-testid={testID}
            aria-label={accessibilityLabel}
            {...props}
        >
            {children}
        </div>
    );
});

View.displayName = "View";