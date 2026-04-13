import type { MaintainVisibleContentPositionConfig } from "@/types.base";
import type { MaintainVisibleContentPositionNormalized } from "@/types.internal";

export function normalizeMaintainVisibleContentPosition(
    value: MaintainVisibleContentPositionConfig | boolean | undefined,
): MaintainVisibleContentPositionNormalized {
    if (value === true) {
        return { data: true, size: true };
    }

    if (value && typeof value === "object") {
        return {
            data: value.data ?? false,
            shouldRestorePosition: value.shouldRestorePosition,
            size: value.size ?? true,
        };
    }

    if (value === false) {
        return { data: false, size: false };
    }

    return { data: false, size: true };
}
