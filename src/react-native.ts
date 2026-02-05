import { LegendList as LegendListImpl } from "@/components/LegendList";
import type { LegendListComponent } from "@/types.react-native";

export const LegendList = LegendListImpl as LegendListComponent;

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
