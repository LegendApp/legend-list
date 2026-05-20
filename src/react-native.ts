import { LegendListDatasetsRuntime, LegendListRuntime, internal as sharedInternal } from "@/entrypoints/shared";
import type { LegendListComponent, LegendListDatasetsComponent } from "@/types.react-native";
export const LegendList = LegendListRuntime as LegendListComponent;
export const LegendListDatasets = LegendListDatasetsRuntime as LegendListDatasetsComponent;

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
