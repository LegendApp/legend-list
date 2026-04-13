import type {
    MaintainScrollAtEndOnOptions,
    MaintainScrollAtEndOptions,
} from "@/types.base";
import type { MaintainScrollAtEndNormalized } from "@/types.internal";

function normalizeMaintainScrollAtEndOn(
    on: MaintainScrollAtEndOnOptions | undefined,
    hasExplicitOn: boolean,
): MaintainScrollAtEndNormalized {
    return {
        animated: false,
        onDataChange: hasExplicitOn ? (on?.dataChange ?? false) : true,
        onItemLayout: hasExplicitOn ? (on?.itemLayout ?? false) : true,
        onLayout: hasExplicitOn ? (on?.layout ?? false) : true,
    };
}

export function normalizeMaintainScrollAtEnd(
    value: boolean | MaintainScrollAtEndOptions | undefined,
): MaintainScrollAtEndNormalized | undefined {
    if (!value) {
        return undefined;
    }

    if (value === true) {
        return {
            ...normalizeMaintainScrollAtEndOn(undefined, false),
            animated: false,
        };
    }

    const normalizedTriggers = normalizeMaintainScrollAtEndOn(value.on, "on" in value);

    return {
        ...normalizedTriggers,
        animated: value.animated ?? false,
    };
}
