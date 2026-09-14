import type { ComponentType } from "react";

import { mock } from "bun:test";

const createSharedValue = <T>(initial: T) => {
    let current = initial;
    return {
        addListener: () => {},
        get: () => current,
        modify: (modifier?: (value: T) => T) => {
            if (modifier) current = modifier(current);
        },
        removeListener: () => {},
        set: (next: T | ((value: T) => T)) => {
            current = typeof next === "function" ? (next as (value: T) => T)(current) : next;
        },
        get value() {
            return current;
        },
        set value(next: T) {
            current = next;
        },
    };
};

const defaults = {
    createAnimatedComponent: <T extends ComponentType<any>>(component: T): T => component,
    isWorkletFunction: () => false,
    runOnJS: (callback: (...args: any[]) => any) => callback,
    ScrollView: () => null,
    useAnimatedProps: (updater: () => unknown) => updater,
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: (handler: any) => handler,
    useAnimatedStyle: (updater: () => unknown) => updater(),
    useComposedEventHandler: (handlers: any[]) => handlers[0],
    useScrollViewOffset: () => {},
    useSharedValue: createSharedValue,
    View: () => null,
};

export function registerReanimatedModuleMock(overrides: Record<string, unknown> = {}) {
    // Keep all exports used by our integrations present from the first import.
    // Bun cannot reliably add named exports after a partial mock has been loaded.
    const shared = { ...defaults, ...overrides };
    const module = { __esModule: true, ...shared, default: shared };
    mock.module("react-native-reanimated", () => module);
    mock.module("react-native-reanimated/lib/module/index.js", () => module);
}
