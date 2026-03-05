import { LegendListRuntime, internal as sharedInternal } from "@/entrypoints/shared";
import type { LegendListComponent } from "@/types.react-native";
export const LegendList = LegendListRuntime as LegendListComponent;

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
