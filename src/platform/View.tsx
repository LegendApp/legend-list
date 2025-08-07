import type { CSSProperties } from "react";
import * as React from "react";

// Forward declare AnimatedValue to avoid circular dependency
interface AnimatedValueLike {
    getValue(): number;
}

export type DimensionValue = string | number | AnimatedValueLike;

// React Native-style transform types
export interface TransformStyle {
    translateX?: number;
    translateY?: number;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    rotate?: string;
    rotateX?: string;
    rotateY?: string;
    rotateZ?: string;
    skewX?: string;
    skewY?: string;
}

export interface ViewStyle
    extends Omit<
        CSSProperties,
        | "right"
        | "left"
        | "top"
        | "bottom"
        | "width"
        | "height"
        | "minHeight"
        | "minWidth"
        | "maxHeight"
        | "maxWidth"
        | "opacity"
        | "transform"
    > {
    // Add common React Native ViewStyle properties that translate to CSS
    paddingVertical?: number;
    paddingHorizontal?: number;
    marginVertical?: number;
    marginHorizontal?: number;
    // Allow null for positioning properties like React Native
    right?: DimensionValue | null;
    left?: DimensionValue | null;
    top?: DimensionValue | null;
    bottom?: DimensionValue | null;
    // Allow AnimatedValues for size and opacity properties
    width?: DimensionValue;
    height?: DimensionValue;
    minHeight?: DimensionValue;
    minWidth?: DimensionValue;
    maxHeight?: DimensionValue;
    maxWidth?: DimensionValue;
    opacity?: number | AnimatedValueLike;
    // React Native-style transform (array of objects)
    transform?: TransformStyle[];
}

export type StyleProp<T> = T | T[] | undefined;

// Only add the measure method that LegendList actually uses
export interface WebViewMethods {
    measure(
        callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void,
    ): void;
}

export interface ViewProps {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    onLayout?: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
    pointerEvents?: "auto" | "none" | "box-none" | "box-only";
    testID?: string;
    accessibilityLabel?: string;
    /**
     * Opt-in: observe future layout changes and re-fire onLayout.
     * Defaults to false to avoid many active ResizeObservers.
     */
    observeLayout?: boolean;
    ref?: React.Ref<HTMLDivElement & WebViewMethods>;
}

export const View = React.forwardRef<HTMLDivElement & WebViewMethods, ViewProps>(
    (
        {
            children,
            style,
            onLayout,
            pointerEvents,
            testID,
            accessibilityLabel: _accessibilityLabel,
            observeLayout = false,
            ...props
        },
        ref,
    ) => {
        const divRef = React.useRef<HTMLDivElement>(null);

        // Create enhanced ref with React Native-like methods
        React.useImperativeHandle(ref, () => {
            const element = divRef.current;
            if (!element) {
                return {} as HTMLDivElement & WebViewMethods;
            }

            const enhancedElement = element as HTMLDivElement & WebViewMethods;

            // Add only the measure method that LegendList actually uses
            enhancedElement.measure = (callback) => {
                const rect = element.getBoundingClientRect();
                callback(
                    rect.left,
                    rect.top,
                    rect.width,
                    rect.height,
                    rect.left + window.scrollX,
                    rect.top + window.scrollY,
                );
            };

            return enhancedElement;
        }, []);

        const combinedStyle: CSSProperties = style as CSSProperties; // {

        // Keep latest onLayout in a ref so effect does not re-run on identity change
        const onLayoutRef = React.useRef<typeof onLayout>();
        onLayoutRef.current = onLayout;

        React.useLayoutEffect(() => {
            if (!divRef.current) return;
            const element = divRef.current;

            // Track last size to avoid redundant onLayout calls
            let lastWidth = -1;
            let lastHeight = -1;

            const fireLayout = (rect: DOMRectReadOnly | DOMRect) => {
                const width = rect.width;
                const height = rect.height;
                if (width === lastWidth && height === lastHeight) return;
                lastWidth = width;
                lastHeight = height;
                const cb = onLayoutRef.current;
                if (!cb) return;
                cb({
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

            // Initial measure
            fireLayout(element.getBoundingClientRect());

            if (!observeLayout) return;

            // Set up ResizeObserver for future layout changes (opt-in)
            const resizeObserver = new ResizeObserver(([entry]) => {
                fireLayout(entry.contentRect);
            });

            resizeObserver.observe(element);
            return () => resizeObserver.disconnect();
        }, [observeLayout]);

        return (
            <div
                data-testid={testID}
                ref={divRef}
                style={combinedStyle}
                // Intentionally omit aria-label to satisfy linter; consumers can pass ARIA via props
                {...props}
            >
                {children}
            </div>
        );
    },
);

View.displayName = "View";
