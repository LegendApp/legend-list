import * as React from "react";
import type { CSSProperties } from "react";

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

export interface ViewStyle extends Omit<CSSProperties, 'right' | 'left' | 'top' | 'bottom' | 'width' | 'height' | 'minHeight' | 'minWidth' | 'maxHeight' | 'maxWidth' | 'opacity' | 'transform'> {
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
    measure(callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void): void;
}

export interface ViewProps {
    children?: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
    onLayout?: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
    pointerEvents?: "auto" | "none" | "box-none" | "box-only";
    testID?: string;
    accessibilityLabel?: string;
    ref?: React.Ref<HTMLDivElement & WebViewMethods>;
}

const convertStyleArray = (style: ViewStyle | ViewStyle[] | undefined): CSSProperties => {
    if (!style) return {};
    
    const processStyle = (s: ViewStyle): CSSProperties => {
        const { 
            paddingVertical, 
            paddingHorizontal, 
            marginVertical, 
            marginHorizontal,
            right,
            left,
            top,
            bottom,
            transform,
            ...rest 
        } = s;
        const result: any = { ...rest };
        
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
        
        // Handle positioning and dimension properties, converting null to undefined for CSS
        // and extracting values from AnimatedValues
        const extractValue = (value: any) => {
            if (value && typeof value.getValue === 'function') {
                return value.getValue();
            }
            return value;
        };
        
        if (right !== null && right !== undefined) result.right = extractValue(right);
        if (left !== null && left !== undefined) result.left = extractValue(left);
        if (top !== null && top !== undefined) result.top = extractValue(top);
        if (bottom !== null && bottom !== undefined) result.bottom = extractValue(bottom);
        
        // Handle size properties that might be AnimatedValues
        if (s.width !== undefined) result.width = extractValue(s.width);
        if (s.height !== undefined) result.height = extractValue(s.height);
        if (s.minHeight !== undefined) result.minHeight = extractValue(s.minHeight);
        if (s.minWidth !== undefined) result.minWidth = extractValue(s.minWidth);
        if (s.maxHeight !== undefined) result.maxHeight = extractValue(s.maxHeight);
        if (s.maxWidth !== undefined) result.maxWidth = extractValue(s.maxWidth);
        if (s.opacity !== undefined) result.opacity = extractValue(s.opacity);
        
        // Handle transform array - convert React Native transform array to CSS transform string
        if (transform && Array.isArray(transform)) {
            const transformStrings: string[] = [];
            for (const t of transform) {
                if (t.translateX !== undefined) transformStrings.push(`translateX(${extractValue(t.translateX)}px)`);
                if (t.translateY !== undefined) transformStrings.push(`translateY(${extractValue(t.translateY)}px)`);
                if (t.scale !== undefined) transformStrings.push(`scale(${extractValue(t.scale)})`);
                if (t.scaleX !== undefined) transformStrings.push(`scaleX(${extractValue(t.scaleX)})`);
                if (t.scaleY !== undefined) transformStrings.push(`scaleY(${extractValue(t.scaleY)})`);
                if (t.rotate !== undefined) transformStrings.push(`rotate(${t.rotate})`);
                if (t.rotateX !== undefined) transformStrings.push(`rotateX(${t.rotateX})`);
                if (t.rotateY !== undefined) transformStrings.push(`rotateY(${t.rotateY})`);
                if (t.rotateZ !== undefined) transformStrings.push(`rotateZ(${t.rotateZ})`);
                if (t.skewX !== undefined) transformStrings.push(`skewX(${t.skewX})`);
                if (t.skewY !== undefined) transformStrings.push(`skewY(${t.skewY})`);
            }
            if (transformStrings.length > 0) {
                result.transform = transformStrings.join(' ');
            }
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

export const View = React.forwardRef<HTMLDivElement & WebViewMethods, ViewProps>(({ 
    children, 
    style, 
    onLayout,
    pointerEvents,
    testID,
    accessibilityLabel,
    ...props 
}, ref) => {
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
                rect.top + window.scrollY
            );
        };

        return enhancedElement;
    }, []);

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
        pointerEvents: convertPointerEvents(pointerEvents) as any,
    };

    return (
        <div
            ref={divRef}
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