import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { SharedValue } from "react-native-reanimated";

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

// biome-ignore lint/complexity/noBannedTypes: <explanation>
export function isFunction(obj: unknown): obj is Function {
    return typeof obj === "function";
}

const warned = new Set<string>();
export function warnDevOnce(id: string, text: string) {
    if (__DEV__ && !warned.has(id)) {
        warned.add(id);
        console.warn(`[legend-list] ${text}`);
    }
}

export function roundSize(size: number) {
    return Math.floor(size * 8) / 8; // Round to nearest quater pixel to avoid accumulating rounding errors
}

export function isNullOrUndefined(value: unknown) {
    return value === null || value === undefined;
}

export function comparatorByDistance(a: { distance: number }, b: { distance: number }) {
    return b.distance - a.distance;
}

export function comparatorDefault(a: number, b: number) {
    return a - b;
}

export function byIndex(a: { index: number }) {
    return a.index;
}

export function isReanimatedScroll(value: unknown): value is SharedValue<ScrollHandler> {
    if (typeof value === "object" && value !== null && "value" in value) {
        const val = (value as { value: unknown }).value;
        return typeof val === "function";
    }

    return false;
}
