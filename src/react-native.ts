import { LegendListGroupRuntime, LegendListRuntime, internal as sharedInternal } from "@/entrypoints/shared";
import type { LegendListComponent, LegendListGroupComponent } from "@/types.react-native";
export const LegendList = LegendListRuntime as LegendListComponent;
export const LegendListGroup = LegendListGroupRuntime as LegendListGroupComponent;

/** @internal */
export const internal = sharedInternal;

export {
    useIsLastItem,
    useListScrollSize,
    useRecyclingEffect,
    useRecyclingState,
    useSyncLayout,
    useViewability,
    useViewabilityAmount,
} from "@/entrypoints/shared";
export * from "@/types.react-native";
