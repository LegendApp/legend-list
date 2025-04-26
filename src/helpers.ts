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
