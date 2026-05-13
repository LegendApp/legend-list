import { LegendList as LegendListImpl } from "@/components/LegendList";
import { LegendListGroup as LegendListGroupImpl } from "@/components/LegendListGroup";
import type { LegendListComponent, LegendListGroupComponent } from "@/types.root";
import { IS_DEV } from "@/utils/devEnvironment";

/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export const LegendList = LegendListImpl as LegendListComponent;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export const LegendListGroup = LegendListGroupImpl as LegendListGroupComponent;

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

if (IS_DEV) {
    console.warn(
        "[legend-list] Legend List 3.0 deprecates the root import (@legendapp/list) because it now supports both react and react-native. The root import is fully functional, but please switch to platform-specific imports for strict platform types:\n" +
            "  - React Native: @legendapp/list/react-native\n" +
            "  - React: @legendapp/list/react\n" +
            "See README for details.",
    );
}
