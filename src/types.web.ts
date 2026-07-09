import type { CSSProperties, HTMLAttributes, ReactElement, Ref, RefAttributes } from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import type { LooseLayoutChangeEvent, LooseScrollViewProps } from "@/platform/scrollview-types";
import type {
    AnchoredEndSpaceConfig,
    LegendListRef as LegendListRefBase,
    LegendListState as LegendListStateBase,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from "@/types.base";
import type { LegendListPropsBase } from "@/types.internal";

export type {
    AdaptiveRender,
    AdaptiveRenderChangeReason,
    AdaptiveRenderConfig,
    AlwaysRenderConfig,
    AnchoredEndSpaceConfig,
    ColumnWrapperStyle,
    DataSourceMutationBatch,
    DataSourceOperation,
    Insets,
    LayoutRectangle,
    LegendListArrayDataModeProps,
    LegendListAverageItemSize,
    LegendListDataMode,
    LegendListDataSource,
    LegendListDataSourceModeProps,
    LegendListDataSourceRenderItemProps,
    LegendListMetrics,
    LegendListRecyclingState,
    LegendListRenderItemProps,
    MaintainScrollAtEndOnOptions,
    MaintainScrollAtEndOptions,
    MaintainVisibleContentPositionConfig,
    NativeScrollEvent,
    NativeSyntheticEvent,
    OnViewableItemsChanged,
    OnViewableItemsChangedInfo,
    ScrollIndexWithOffset,
    ScrollIndexWithOffsetAndContentOffset,
    ScrollIndexWithOffsetPosition,
    StickyHeaderConfig,
    StyleProp,
    ViewAmountToken,
    ViewabilityAmountCallback,
    ViewabilityCallback,
    ViewabilityConfig,
    ViewabilityConfigCallbackPair,
    ViewabilityConfigCallbackPairs,
    ViewStyle,
    ViewToken,
} from "@/types.base";

type ScrollViewPropsWeb = Omit<
    LooseScrollViewProps,
    | "style"
    | "contentContainerStyle"
    | "onScroll"
    | "onLayout"
    | "onMomentumScrollBegin"
    | "onMomentumScrollEnd"
    | "onScrollBeginDrag"
    | "pagingEnabled"
    | "snapToInterval"
> &
    Omit<HTMLAttributes<HTMLDivElement>, "onScroll" | "onLayout" | "style"> & {
        style?: CSSProperties;
        contentContainerClassName?: string;
        contentContainerStyle?: CSSProperties;
        onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
        onLayout?: (event: LooseLayoutChangeEvent) => void;
    };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type LegendListPropsOverrides<ItemT, TItemType extends string | undefined> = DistributiveOmit<
    LegendListPropsBase<ItemT, ScrollViewPropsWeb, TItemType>,
    | "anchoredEndSpace"
    | "refScrollView"
    | "renderScrollComponent"
    | "ListHeaderComponentStyle"
    | "ListFooterComponentStyle"
    | "onRefresh"
    | "progressViewOffset"
    | "refreshing"
> & {
    anchoredEndSpace?: AnchoredEndSpaceConfig;
    refScrollView?: Ref<HTMLElement | ScrollViewMethods>;
    ListHeaderComponentStyle?: CSSProperties | undefined;
    ListFooterComponentStyle?: CSSProperties | undefined;
};

export type LegendListProps<
    ItemT = any,
    TItemType extends string | undefined = string | undefined,
> = LegendListPropsOverrides<ItemT, TItemType>;

export type LegendListRef = Omit<
    LegendListRefBase,
    "getAnimatableRef" | "getNativeScrollRef" | "getScrollableNode" | "getScrollResponder"
> & {
    getAnimatableRef(): HTMLElement | ScrollViewMethods;
    getNativeScrollRef(): HTMLElement | ScrollViewMethods;
    getScrollableNode(): HTMLElement;
    getScrollResponder(): HTMLElement | null;
};

export type LegendListState = Omit<LegendListStateBase, "elementAtIndex"> & {
    elementAtIndex: (index: number) => HTMLElement | null | undefined;
};

export type LegendListComponent = <ItemT = any>(
    props: LegendListProps<ItemT> & RefAttributes<LegendListRef>,
) => ReactElement | null;
