import type { MaintainScrollAtEndNormalized, MaintainScrollAtEndOptions } from "@/types.base";

export function normalizeMaintainScrollAtEnd(
    value: boolean | MaintainScrollAtEndOptions | undefined,
): MaintainScrollAtEndNormalized | undefined {
    if (!value) {
        return undefined;
    }

    if (value === true) {
        return {
            animated: false,
            onDataChange: true,
            onItemLayout: true,
            onLayout: true,
        };
    }

    return {
        animated: value.animated ?? false,
        onDataChange: value.onDataChange ?? true,
        onItemLayout: value.onItemLayout ?? true,
        onLayout: value.onLayout ?? true,
    };
}
