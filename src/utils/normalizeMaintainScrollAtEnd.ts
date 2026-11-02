import type { MaintainScrollAtEndOptions } from "@/types.base";
import type { MaintainScrollAtEndNormalized } from "@/types.internal";

export function normalizeMaintainScrollAtEnd(
    value: boolean | MaintainScrollAtEndOptions | undefined,
): MaintainScrollAtEndNormalized | undefined {
    if (!value) {
        return undefined;
    }

    const options = value === true ? undefined : value;
    const on = options?.on;
    const hasExplicitOn = !!options && "on" in options;

    return {
        animated: options?.animated ?? false,
        onDataChange: hasExplicitOn ? on?.dataChange || (on?.dataAppend ? "append" : false) : true,
        onFooterLayout: hasExplicitOn ? (on?.footerLayout ?? false) : true,
        onItemLayout: hasExplicitOn ? (on?.itemLayout ?? false) : true,
        onLayout: hasExplicitOn ? (on?.layout ?? false) : true,
    };
}
