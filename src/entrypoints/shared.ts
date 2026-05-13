import { LegendList as LegendListImpl } from "@/components/LegendList";
import { LegendListGroup as LegendListGroupImpl } from "@/components/LegendListGroup";
import { getStickyPushLimit } from "@/components/stickyPositionUtils";
import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { peek$, useArr$, useStateContext } from "@/state/state";
import { typedForwardRef, typedMemo } from "@/types.internal";
import { getComponent } from "@/utils/getComponent";

export const LegendListRuntime = LegendListImpl;
export const LegendListGroupRuntime = LegendListGroupImpl;

// Internal bridge exports used by integration entrypoints to avoid duplicating local modules.
/** @internal */
export const internal = {
    getComponent,
    getStickyPushLimit,
    IsNewArchitecture,
    POSITION_OUT_OF_VIEW,
    peek$,
    typedForwardRef,
    typedMemo,
    useArr$,
    useCombinedRef,
    useStateContext,
} as const;

export {
    useIsLastItem,
    useListScrollSize,
    useRecyclingEffect,
    useRecyclingState,
    useSyncLayout,
    useViewability,
    useViewabilityAmount,
} from "@/state/ContextContainer";
