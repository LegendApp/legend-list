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

const createMockComponent = (displayName: string, options?: { triggerLayout?: boolean }) => {
    const Component = React.forwardRef<any, any>((props, _ref) => {
        React.useEffect(() => {
            if (options?.triggerLayout && typeof props.onLayout === "function") {
                props.onLayout({
                    nativeEvent: {
                        layout: {
                            height: props.__mockHeight ?? 600,
                            width: props.__mockWidth ?? 375,
                            x: 0,
                            y: 0,
                        },
                    },
                });
            }
        }, []);
        return React.createElement(React.Fragment, null, props.children);
    });
    Component.displayName = displayName;
    return Component;
};

export const Platform = {
    OS: "ios",
    select<T>(spec: { ios?: T; android?: T; web?: T; default?: T }): T {
        return (spec as any)["ios"] ?? spec.default!;
    },
};

export const Dimensions = {
    get(_what: "window" | "screen") {
        return { fontScale: 2, height: 667, scale: 2, width: 375 };
    },
};

export const StyleSheet = {
    create<T extends Record<string, any>>(styles: T): T {
        return styles;
    },
    flatten(style: any): any {
        if (Array.isArray(style)) {
            return style.reduce((acc, s) => ({ ...acc, ...(s || {}) }), {});
        }
        return style || {};
    },
};

export const unstable_batchedUpdates: (fn: AnyFunction) => void = (fn) => {
    fn();
};

class AnimatedValue<T = number> {
    private _value: T;
    constructor(value: T) {
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

export const Animated = {
    event(_args: any, config?: { listener?: AnyFunction; useNativeDriver?: boolean }): AnyFunction {
        const listener = config?.listener;
        return (event: any) => listener?.(event);
    },
    timing(_value: any, _config: any) {
        return { start: (cb?: AnyFunction) => cb?.() };
    },
    Value: AnimatedValue,
    View: createMockComponent("Animated.View", { triggerLayout: true }),
    ScrollView: createMockComponent("Animated.ScrollView", { triggerLayout: true }),
};

// Provide a global requestAnimationFrame fallback for tests that expect it
if (typeof globalThis.requestAnimationFrame !== "function") {
    // @ts-ignore
    globalThis.requestAnimationFrame = (cb: AnyFunction) => setTimeout(cb, 0);
}

// FlatList mock that renders items
export const FlatList = React.forwardRef<any, any>((props, _ref) => {
    const { data, renderItem, keyExtractor } = props;
    
    if (!data || !renderItem) {
        return null;
    }
    
    return React.createElement(
        React.Fragment,
        null,
        data.map((item: any, index: number) => {
            const key = keyExtractor ? keyExtractor(item, index) : String(index);
            return React.createElement(
                React.Fragment,
                { key },
                renderItem({ item, index })
            );
        })
    );
});
FlatList.displayName = "FlatList";

// Very light component stubs
export const View = createMockComponent("View", { triggerLayout: true }) as unknown as AnyFunction;
export const Text = createMockComponent("Text") as unknown as AnyFunction;
export const RefreshControl = createMockComponent("RefreshControl") as unknown as AnyFunction;
export const ScrollView = createMockComponent("ScrollView", { triggerLayout: true }) as unknown as AnyFunction;

export type View = any; // for type-only imports
export type ScrollView = any; // for type-only imports
export type FlatList = any; // for type-only imports
