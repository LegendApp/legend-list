import type { MaintainVisibleContentPositionConfig, MaintainVisibleContentPositionNormalized } from "@/types";

export function normalizeMaintainVisibleContentPosition(
    value: MaintainVisibleContentPositionConfig | boolean | undefined,
): MaintainVisibleContentPositionNormalized {
    if (value === true) {
        return { dataChanges: true, scroll: true };
    }

    if (value && typeof value === "object") {
        return {
            dataChanges: value.dataChanges ?? false,
            scroll: value.scroll ?? true,
        };
    }

    if (value === false) {
        return { dataChanges: false, scroll: false };
    }

    return { dataChanges: false, scroll: true };
}
