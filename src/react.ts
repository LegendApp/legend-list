import { LegendListDatasetsRuntime, LegendListRuntime, internal as sharedInternal } from "@/entrypoints/shared";
import type { LegendListComponent } from "@/types.web";

export const LegendList = LegendListRuntime as LegendListComponent;
export const LegendListDatasets = LegendListDatasetsRuntime;

export type {
    DatasetInactiveBehavior,
    LegendListDataset,
    LegendListDatasetRenderItemProps,
    LegendListDatasetsProps,
} from "@/entrypoints/shared";

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
export * from "@/types.web";
