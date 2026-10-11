import type { CSSProperties, HTMLAttributes, ReactElement, Ref, RefAttributes } from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import type { LooseLayoutChangeEvent, LooseScrollViewProps } from "@/platform/scrollview-types";
import type {
    AnchoredEndSpaceConfig,
    LegendListDataSourcePropsBase,
    LegendListPropsBase,
    LegendListRef as LegendListRefBase,
    LegendListState as LegendListStateBase,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from "@/types.base";

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

type LegendListPropsOverrides<Props> = Omit<
    Props,
    | "anchoredEndSpace"
    | "refScrollView"
    | "renderScrollComponent"
    | "ListHeaderComponentStyle"
    | "ListFooterComponentStyle"
    | "onRefresh"
    | "progressViewOffset"
    | "refreshing"
> & {
    /**
     * Web only: use an ancestor element's scrollbar instead of creating a scrollable list.
     * Pass a state-backed callback ref value so changes to the element are observed.
     * null waits for the element to mount; undefined uses the list's own scrollbar.
     * Takes precedence over useWindowScroll. Not supported with renderScrollComponent.
     */
    scrollElement?: HTMLElement | null;
    anchoredEndSpace?: AnchoredEndSpaceConfig;
    refScrollView?: Ref<HTMLElement | ScrollViewMethods>;
    ListHeaderComponentStyle?: CSSProperties | undefined;
    ListFooterComponentStyle?: CSSProperties | undefined;
};

export type LegendListProps<
    ItemT = any,
    TItemType extends string | undefined = string | undefined,
> = LegendListPropsOverrides<LegendListPropsBase<ItemT, ScrollViewPropsWeb, TItemType>>;

export type LegendListDataSourceProps<
    ItemT = any,
    TItemType extends string | undefined = string | undefined,
> = LegendListPropsOverrides<LegendListDataSourcePropsBase<ItemT, ScrollViewPropsWeb, TItemType>>;

export type LegendListRef = Omit<
    LegendListRefBase,
    "getAnimatableRef" | "getNativeScrollRef" | "getScrollableNode" | "getScrollResponder"
> & {
    getAnimatableRef(): HTMLElement | ScrollViewMethods;
    getNativeScrollRef(): HTMLElement | ScrollViewMethods;
    getScrollableNode(): HTMLElement | null;
    getScrollResponder(): HTMLElement | null;
};

export type LegendListState = Omit<LegendListStateBase, "elementAtIndex"> & {
    elementAtIndex: (index: number) => HTMLElement | null | undefined;
};

export type LegendListComponent = <ItemT = any>(
    props: LegendListProps<ItemT> & RefAttributes<LegendListRef>,
) => ReactElement | null;

export type LegendListDataSourceComponent = <ItemT = any>(
    props: LegendListDataSourceProps<ItemT> & RefAttributes<LegendListRef>,
) => ReactElement | null;
