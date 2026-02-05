import { LegendList as LegendListImpl } from "@/components/LegendList";
import type { LegendListComponent } from "@/types.root";

/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/web` for strict typing. */
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
export * from "./types.root";
