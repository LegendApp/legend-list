import * as React from "react";

import {
    LegendList,
    type LegendListProps,
    type LegendListRef,
    type LegendListRenderItemProps,
} from "@legendapp/list/react-native";

type UnsupportedInfiniteProps =
    | "alignItemsAtEnd"
    | "anchoredEndSpace"
    | "children"
    | "columnWrapperStyle"
    | "infiniteMode"
    | "initialScrollAtEnd"
    | "ListFooterComponent"
    | "ListFooterComponentStyle"
    | "ListHeaderComponent"
    | "ListHeaderComponentStyle"
    | "maintainScrollAtEnd"
    | "maintainScrollAtEndThreshold"
    | "numColumns"
    | "onEndReached"
    | "onEndReachedThreshold"
    | "onStartReached"
    | "onStartReachedThreshold"
    | "stickyHeaderConfig"
    | "stickyHeaderIndices";

export interface InfiniteLegendListRenderItemProps<ItemT>
    extends Omit<LegendListRenderItemProps<ItemT>, "infiniteIndex"> {
    /**
     * The item's index in the virtual (repeated) scroll space. Combine with the scroll offset
     * to drive carousel progress animations; `index` stays the index in the real data array.
     */
    infiniteIndex: number;
}

type PropsOf<TComponent> = TComponent extends React.ComponentType<infer TProps> ? TProps : never;

export type InfiniteLegendListProps<ItemT, TList extends React.ComponentType<any> = typeof LegendList> = Omit<
    LegendListProps<ItemT>,
    UnsupportedInfiniteProps | "data" | "renderItem"
> & {
    data: ReadonlyArray<ItemT>;

    renderItem: (props: InfiniteLegendListRenderItemProps<ItemT>) => React.ReactNode;

    /**
     * How many times the data is repeated to create the virtual scroll space.
     * Odd values keep a well-defined center copy. Defaults to at least 9 copies,
     * scaled up automatically for very short datasets.
     */
    copies?: number;

    /**
     * The underlying list component to render. Defaults to LegendList.
     * Pass AnimatedLegendList from `@legendapp/list/reanimated` to get a UI-thread
     * scroll offset shared value for progress animations, or the RN Animated variant
     * from `@legendapp/list/animated`.
     */
    ListComponent?: TList;
} & Omit<PropsOf<TList>, keyof LegendListProps<ItemT> | "ListComponent" | "copies">;

/**
 * A circular, endlessly-scrollable list — LegendList preconfigured as an infinite carousel.
 *
 * A thin typed wrapper over LegendList's `infiniteMode`: the data loops in both directions,
 * scroll recentering is invisible, `renderItem` receives real data indices plus a required
 * `infiniteIndex`, and ref scroll methods wrap around via the shortest path.
 */
// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const InfiniteLegendList = React.forwardRef(function InfiniteLegendList(
    props: { copies?: number; ListComponent?: React.ComponentType<any> } & Record<string, unknown>,
    ref: React.Ref<LegendListRef>,
) {
    const { copies, ListComponent = LegendList as React.ComponentType<any>, ...rest } = props;
    const infiniteMode = React.useMemo(() => (copies !== undefined ? { copies } : true), [copies]);

    return <ListComponent {...rest} infiniteMode={infiniteMode} ref={ref} />;
}) as unknown as <ItemT, TList extends React.ComponentType<any> = typeof LegendList>(
    props: InfiniteLegendListProps<ItemT, TList> & { ref?: React.Ref<LegendListRef> },
) => React.ReactElement | null;
