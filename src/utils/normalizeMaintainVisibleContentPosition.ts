import type { MaintainVisibleContentPositionConfig, MaintainVisibleContentPositionNormalized } from "@/types";

export function normalizeMaintainVisibleContentPosition(
    value: MaintainVisibleContentPositionConfig | boolean | undefined,
): MaintainVisibleContentPositionNormalized {
    if (value === true) {
        return { dataChanged: true, scroll: true };
    }

    if (value && typeof value === "object") {
        return {
            dataChanged: value.dataChanged ?? false,
            scroll: value.scroll ?? true,
        };
    }

    if (value === false) {
        return { dataChanged: false, scroll: false };
    }

    return { dataChanged: false, scroll: true };
}
