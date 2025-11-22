import type { ViewStyle } from "react-native";

export function isFunction(obj: unknown): obj is (...args: any[]) => any {
    return typeof obj === "function";
}
export function isArray(obj: unknown): obj is Array<any> {
    return Array.isArray(obj);
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

export function comparatorDefault(a: number, b: number) {
    return a - b;
}

export function byIndex(a: { index: number }) {
    return a.index;
}

function getPadding(s: ViewStyle, type: "Top" | "Bottom") {
    return (s[`padding${type}`] ?? s.paddingVertical ?? s.padding ?? 0) as number;
}
export function extractPadding(style: ViewStyle, contentContainerStyle: ViewStyle, type: "Top" | "Bottom") {
    return getPadding(style, type) + getPadding(contentContainerStyle, type);
}
