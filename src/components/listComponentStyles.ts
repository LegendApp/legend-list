import type { ViewStyle } from "@/platform/scrollview-types";

export function getAutoOtherAxisStyle({
    horizontal,
    needsOtherAxisSize,
    otherAxisSize,
}: {
    horizontal: boolean;
    needsOtherAxisSize: boolean | undefined;
    otherAxisSize: number | undefined;
}): ViewStyle | undefined {
    if (!needsOtherAxisSize || !otherAxisSize || otherAxisSize <= 0) {
        return undefined;
    }

    return horizontal ? { height: otherAxisSize } : { width: otherAxisSize };
}
