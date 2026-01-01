import type { MaintainVisibleContentPositionConfig, MaintainVisibleContentPositionNormalized } from "@/types";

export function normalizeMaintainVisibleContentPosition(
    value: MaintainVisibleContentPositionConfig | boolean | undefined,
): MaintainVisibleContentPositionNormalized {
    if (value === true) {
        return { data: true, size: true };
    }

    if (value && typeof value === "object") {
        return {
            data: value.data ?? false,
            size: value.size ?? true,
            shouldRestorePosition: value.shouldRestorePosition,
        };
    }

    if (value === false) {
        return { data: false, size: false };
    }

    return { data: false, size: true };
}
