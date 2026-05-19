import { LegendList as LegendListImpl } from "@/components/LegendList";
import { LegendListDatasets as LegendListDatasetsImpl } from "@/components/LegendListDatasets";
import { getStickyPushLimit } from "@/components/stickyPositionUtils";
import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useLatestRef } from "@/hooks/useLatestRef";
import { useStableRenderComponent } from "@/hooks/useStableRenderComponent";
import { peek$, useArr$, useStateContext } from "@/state/state";
import { typedForwardRef, typedMemo } from "@/types.internal";
import { getComponent } from "@/utils/getComponent";

export const LegendListRuntime = LegendListImpl;
export const LegendListDatasetsRuntime = LegendListDatasetsImpl;

export type {
    DatasetInactiveBehavior,
    LegendListDataset,
    LegendListDatasetsProps,
} from "@/components/LegendListDatasets";

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
    useLatestRef,
    useStableRenderComponent,
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
