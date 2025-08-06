import * as React from "react";
import { View, type ViewProps } from "./View";
import { ScrollView, type ScrollViewProps } from "./ScrollView";

// Web implementation of Animated.Value using CSS custom properties and state
export class AnimatedValue {
    private _value: number;
    private _listeners: Set<(value: number) => void> = new Set();
    private _cssProperty: string;
    
    // Add properties that React Native's AnimatedValue has for compatibility
    hasListeners = () => this._listeners.size > 0;
    
    removeListener(listenerId: string) {
        if (this._listenerMap && this._listenerMap.has(listenerId)) {
            const callback = this._listenerMap.get(listenerId)!;
            this._listeners.delete(callback);
            this._listenerMap.delete(listenerId);
        }
    }

    constructor(initialValue: number) {
        this._value = initialValue;
        this._cssProperty = `--animated-${Math.random().toString(36).substr(2, 9)}`;
    }

    setValue(value: number) {
        if (this._value === value) return;
        this._value = value;
        this._notifyListeners();
        this._updateCSSProperty();
    }

    getValue(): number {
        return this._value;
    }

    addListener(callback: (value: { value: number }) => void): string {
        const wrappedCallback = (value: number) => callback({ value });
        this._listeners.add(wrappedCallback);
        const listenerId = Math.random().toString(36);
        
        // Store the mapping for removal
        if (!this._listenerMap) {
            this._listenerMap = new Map();
        }
        this._listenerMap.set(listenerId, wrappedCallback);
        
        return listenerId;
    }

    private _listenerMap?: Map<string, (value: number) => void>;

    removeAllListeners() {
        this._listeners.clear();
    }

    interpolate(config: {
        inputRange: number[];
        outputRange: number[];
        extrapolate?: "extend" | "clamp" | "identity";
    }): AnimatedValue {
        const interpolatedValue = new AnimatedValue(this._interpolateValue(this._value, config));
        
        // Set up listener to update interpolated value when source changes
        this.addListener((value) => {
            interpolatedValue.setValue(this._interpolateValue(value, config));
        });

        return interpolatedValue;
    }

    private _interpolateValue(
        value: number,
        { inputRange, outputRange, extrapolate = "extend" }: {
            inputRange: number[];
            outputRange: number[];
            extrapolate?: "extend" | "clamp" | "identity";
        }
    ): number {
        if (inputRange.length !== outputRange.length) {
            throw new Error("inputRange and outputRange must have the same length");
        }

        // Find the correct segment
        let leftIndex = 0;
        for (let i = 1; i < inputRange.length; i++) {
            if (value <= inputRange[i]) {
                break;
            }
            leftIndex = i;
        }

        const leftInput = inputRange[leftIndex];
        const rightInput = inputRange[leftIndex + 1];
        const leftOutput = outputRange[leftIndex];
        const rightOutput = outputRange[leftIndex + 1];

        if (leftInput === undefined || rightInput === undefined || 
            leftOutput === undefined || rightOutput === undefined) {
            return outputRange[leftIndex] || 0;
        }

        // Handle extrapolation
        if (value < leftInput || value > rightInput) {
            switch (extrapolate) {
                case "clamp":
                    return value < leftInput ? leftOutput : rightOutput;
                case "identity":
                    return value;
                case "extend":
                default:
                    break;
            }
        }

        // Linear interpolation
        const progress = (value - leftInput) / (rightInput - leftInput);
        return leftOutput + progress * (rightOutput - leftOutput);
    }

    private _notifyListeners() {
        this._listeners.forEach(listener => listener(this._value));
    }

    private _updateCSSProperty() {
        // Update CSS custom property on document root
        document.documentElement.style.setProperty(this._cssProperty, this._value.toString());
    }

    getCSSProperty(): string {
        return this._cssProperty;
    }
}

interface AnimatedViewProps extends ViewProps {
    style?: ViewProps["style"] | { [key: string]: AnimatedValue | any };
}

const AnimatedViewComponent = React.forwardRef<HTMLDivElement, AnimatedViewProps>(({ 
    style,
    ...props 
}, ref) => {
    const [, setTick] = React.useState(0);
    const animatedValuesRef = React.useRef<AnimatedValue[]>([]);

    // Extract animated values from style and set up listeners
    React.useEffect(() => {
        const animatedValues: AnimatedValue[] = [];
        const cleanup: (() => void)[] = [];

        const extractAnimatedValues = (obj: any) => {
            if (!obj) return obj;
            
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value instanceof AnimatedValue) {
                    animatedValues.push(value);
                    // Set up listener to trigger re-render
                    const removeListener = value.addListener(() => {
                        setTick(tick => tick + 1);
                    });
                    cleanup.push(removeListener);
                    result[key] = value.getValue();
                } else if (Array.isArray(value)) {
                    result[key] = value.map(extractAnimatedValues);
                } else if (typeof value === "object" && value !== null) {
                    result[key] = extractAnimatedValues(value);
                } else {
                    result[key] = value;
                }
            }
            return result;
        };

        const processedStyle = Array.isArray(style) 
            ? style.map(extractAnimatedValues)
            : extractAnimatedValues(style);

        animatedValuesRef.current = animatedValues;

        return () => {
            cleanup.forEach(fn => fn());
        };
    }, [style]);

    // Process style to convert AnimatedValues to their current values
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
    }, [style, animatedValuesRef.current.map(v => v.getValue()).join(',')]);

    return <View ref={ref} style={processedStyle} {...props} />;
});

const AnimatedScrollViewComponent = React.forwardRef<HTMLDivElement, ScrollViewProps>((props, ref) => {
    return <ScrollView ref={ref} {...props} />;
});

// Animated.event implementation for web
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
                    // Navigate the event path to get the value
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

        // Call the original listener if provided
        if (config?.listener) {
            config.listener(event);
        }
    };
};

// Create animated component wrapper (simplified version)
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