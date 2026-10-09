// Minimal React Native stub for Bun test environment
import * as React from "react";

type AnyFunction = (...args: any[]) => any;

export type ViewStyle = any;
export type ViewProps = any;
export type ScrollViewProps = any;
export type Insets = any;
export type DimensionValue = any;
export type LayoutRectangle = { x: number; y: number; width: number; height: number };
export type LayoutChangeEvent = any;
export type NativeScrollEvent = any;
export type NativeSyntheticEvent<T> = { nativeEvent: T };

export const Platform = {
    OS: "ios",
    select<T>(spec: { ios?: T; android?: T; web?: T; default?: T }): T {
        return (spec as any).ios ?? spec.default!;
    },
};

export const I18nManager = {
    doLeftAndRightSwapInRTL: true,
    forceRTL: (_value: boolean) => {},
    isRTL: false,
    swapLeftAndRightInRTL: (_value: boolean) => {},
};

export const Dimensions = {
    get(_what: "window" | "screen") {
        return { fontScale: 2, height: 667, scale: 2, width: 375 };
    },
};

export const PixelRatio = {
    get() {
        return 3;
    },
};

export const StyleSheet = {
    create<T extends Record<string, any>>(styles: T): T {
        return styles;
    },
    flatten(style: any): any {
        if (Array.isArray(style)) {
            const merged = {};
            for (const segment of style) {
                if (segment && typeof segment === "object") {
                    Object.assign(merged, segment);
                }
            }
            return merged;
        }
        return style || {};
    },
};

export const unstable_batchedUpdates: (fn: AnyFunction) => void = (fn) => {
    fn();
};

type InterpolationConfig = {
    extrapolateLeft?: "clamp" | "extend";
    extrapolateRight?: "clamp" | "extend";
    inputRange: [number, number];
    outputRange: [number, number];
};

// Evaluates like the real graph so tests can assert what a sticky transform resolves to.
class AnimatedNode {
    constructor(private readonly evaluate: () => number) {}
    __getValue(): number {
        return this.evaluate();
    }
    interpolate({ extrapolateLeft, extrapolateRight, inputRange, outputRange }: InterpolationConfig) {
        return new AnimatedNode(() => {
            const [inMin, inMax] = inputRange;
            const [outMin, outMax] = outputRange;
            let input = this.__getValue();
            if (input < inMin && extrapolateLeft === "clamp") input = inMin;
            if (input > inMax && extrapolateRight === "clamp") input = inMax;
            return outMin + ((input - inMin) / (inMax - inMin)) * (outMax - outMin);
        });
    }
}

class AnimatedValue<T = number> extends AnimatedNode {
    private _value: T;
    constructor(value: T) {
        super(() => this._value as unknown as number);
        this._value = value;
    }
    setValue(value: T) {
        this._value = value;
    }
    // minimal accessor for tests
    getValue(): T {
        return this._value;
    }
}

const createHostComponent = (name: string) =>
    React.forwardRef((props: any, _ref: any) =>
        React.createElement(name, props, props?.children),
    ) as unknown as AnyFunction;

const AnimatedScrollView = createHostComponent("AnimatedScrollView");
const AnimatedView = createHostComponent("AnimatedView");

export const Animated = {
    add(a: AnimatedNode, b: AnimatedNode) {
        return new AnimatedNode(() => a.__getValue() + b.__getValue());
    },
    // In tests we simply return the passed component without wrapping
    createAnimatedComponent<T extends AnyFunction>(Component: T): T {
        return Component;
    },
    event(_args: any, config?: { listener?: AnyFunction; useNativeDriver?: boolean }): AnyFunction {
        const listener = config?.listener;
        return (event: any) => listener?.(event);
    },
    ScrollView: AnimatedScrollView,
    subtract(a: AnimatedNode, b: AnimatedNode) {
        return new AnimatedNode(() => a.__getValue() - b.__getValue());
    },
    timing(_value: any, _config: any) {
        return { start: (cb?: AnyFunction) => cb?.() };
    },
    Value: AnimatedValue,
    View: AnimatedView,
};

// Provide a global requestAnimationFrame fallback for tests that expect it
if (typeof globalThis.requestAnimationFrame !== "function") {
    // @ts-ignore
    globalThis.requestAnimationFrame = (cb: AnyFunction) => setTimeout(cb, 0);
}

// Very light component stubs
export const View = createHostComponent("View");
export const Text = createHostComponent("Text");
export const RefreshControl = createHostComponent("RefreshControl");
export const ScrollView = createHostComponent("ScrollView");

export type View = any; // for type-only imports
export type ScrollView = any; // for type-only imports
