import { LegendList as LegendListImpl } from "@/components/LegendList";
import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useArr$ } from "@/state/state";
import type { LegendListComponent } from "@/types.react-native";
import { getComponent } from "@/utils/getComponent";

export const LegendList = LegendListImpl as LegendListComponent;

// Internal bridge exports used by integration entrypoints to avoid duplicating local modules.
/** @internal */
export const internal = {
    getComponent,
    IsNewArchitecture,
    POSITION_OUT_OF_VIEW,
    useArr$,
    useCombinedRef,
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
export * from "@/types.react-native";
