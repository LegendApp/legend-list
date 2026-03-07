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

    // Boolean true preserves the legacy "enable every trigger" behavior. Object form is opt-in
    // per trigger so partial configs do not silently turn on the others.
    return {
        animated: value.animated ?? false,
        onDataChange: value.onDataChange ?? false,
        onItemLayout: value.onItemLayout ?? false,
        onLayout: value.onLayout ?? false,
    };
}
