import * as React from "react";
import { View, type ViewProps } from "./View";
import { ScrollView, type ScrollViewProps } from "./ScrollView";

// Simplified web implementation of Animated.Value
export class AnimatedValue {
    private _value: number;

    constructor(initialValue: number) {
        this._value = initialValue;
    }

    setValue(value: number) {
        this._value = value;
    }

    getValue(): number {
        return this._value;
    }
}

interface AnimatedViewProps extends ViewProps {
    style?: ViewProps["style"] | { [key: string]: AnimatedValue | any };
}

const AnimatedViewComponent = React.forwardRef<HTMLDivElement, AnimatedViewProps>(({ 
    style,
    ...props 
}, ref) => {
    // Simple conversion of AnimatedValues to their current values
    const processedStyle = React.useMemo(() => {
        const extractValues = (obj: any): any => {
            if (!obj) return obj;
            
            if (Array.isArray(obj)) {
                return obj.map(extractValues);
            }

            if (typeof obj === "object") {
                const result: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (value instanceof AnimatedValue) {
                        result[key] = value.getValue();
                    } else if (typeof value === "object" && value !== null) {
                        result[key] = extractValues(value);
                    } else {
                        result[key] = value;
                    }
                }
                return result;
            }

            return obj;
        };

        return extractValues(style);
    }, [style]);

    return <View ref={ref} style={processedStyle} {...props} />;
});

const AnimatedScrollViewComponent = React.forwardRef<HTMLDivElement, ScrollViewProps>((props, ref) => {
    return <ScrollView ref={ref} {...props} />;
});

// Simplified Animated.event for web - just calls the listener, ignores useNativeDriver
const createAnimatedEvent = (
    argMapping: Array<{ nativeEvent: { [key: string]: AnimatedValue } }>,
    config?: { listener?: (event: any) => void; useNativeDriver?: boolean }
) => {
    return (event: any) => {
        // Update animated values from event
        argMapping.forEach((mapping) => {
            const { nativeEvent } = mapping;
            Object.entries(nativeEvent).forEach(([path, animatedValue]) => {
                if (animatedValue instanceof AnimatedValue) {
                    const pathArray = path.split('.');
                    let value = event.nativeEvent;
                    for (const key of pathArray) {
                        value = value?.[key];
                    }
                    if (typeof value === 'number') {
                        animatedValue.setValue(value);
                    }
                }
            });
        });

        // Call the original listener
        if (config?.listener) {
            config.listener(event);
        }
    };
};

// Simple component wrapper
const createAnimatedComponent = <T extends React.ComponentType<any>>(Component: T): T => {
    return React.forwardRef<any, any>((props, ref) => {
        return React.createElement(Component, { ...props, ref });
    }) as T;
};

export const Animated = {
    Value: AnimatedValue,
    View: AnimatedViewComponent,
    ScrollView: AnimatedScrollViewComponent,
    event: createAnimatedEvent,
    createAnimatedComponent,
};

// Export the constructor for compatibility
export { AnimatedValue as AnimatedValueConstructor };