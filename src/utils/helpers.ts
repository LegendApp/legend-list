import { PixelRatio } from "@/platform/PixelRatio";
import type { ViewStyle } from "@/platform/scrollview-types";
import { peek$, type StateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";

export function isFunction(obj: unknown): obj is (...args: any[]) => any {
    return typeof obj === "function";
}
export function isArray(obj: unknown): obj is Array<any> {
    return Array.isArray(obj);
}

const warned = new Set<string>();
export function warnDevOnce(id: string, text: string) {
    if (IS_DEV && !warned.has(id)) {
        warned.add(id);
        console.warn(`[legend-list] ${text}`);
    }
}

export function clearWarnDevOnceForTests() {
    warned.clear();
}

export function roundSize(size: number) {
    // Round down to a whole physical pixel to avoid accumulating
    // rounding errors. Without it, a prepend shifts the items and the MVCP anchor by a fractional
    // pixel size, the renderer can snap them to different pixels, and the list jitters
    const scale = PixelRatio.get();
    return Math.floor(size * scale) / scale;
}

export function isNullOrUndefined(value: unknown) {
    return value === null || value === undefined;
}

export function comparatorDefault(a: number, b: number) {
    return a - b;
}

type PaddingSide = "Top" | "Bottom" | "Left" | "Right";

function getPadding(s: ViewStyle, type: PaddingSide) {
    const axisPadding = type === "Left" || type === "Right" ? s.paddingHorizontal : s.paddingVertical;
    return (s[`padding${type}`] ?? axisPadding ?? s.padding ?? 0) as number;
}
export function extractPadding(style: ViewStyle, contentContainerStyle: ViewStyle, type: PaddingSide) {
    return getPadding(style, type) + getPadding(contentContainerStyle, type);
}

export function findContainerId(ctx: StateContext, key: string) {
    const directMatch = ctx.state?.containerItemKeys?.get(key);
    if (directMatch !== undefined) {
        return directMatch;
    }

    const numContainers = peek$(ctx, "numContainers");
    for (let i = 0; i < numContainers; i++) {
        const itemKey = peek$(ctx, `containerItemKey${i}`);
        if (itemKey === key) {
            return i;
        }
    }
    return -1;
}
