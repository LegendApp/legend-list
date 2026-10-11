import type * as React from "react";
import type {
    Insets,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollResponderMixin,
    ScrollView,
    ScrollViewComponent,
    ScrollViewProps,
    StyleProp,
    View,
    ViewStyle,
} from "react-native";

import type {
    AnchoredEndSpaceConfig,
    LegendListDataSourcePropsBase,
    LegendListPropsBase,
    LegendListRef as LegendListRefBase,
    LegendListState as LegendListStateBase,
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

type LegendListPropsOverrides<Props> = Omit<
    Props,
    | "anchoredEndSpace"
    | "contentInsetEndAdjustment"
    | "onScroll"
    | "refScrollView"
    | "renderScrollComponent"
    | "ListHeaderComponentStyle"
    | "ListFooterComponentStyle"
> & {
    anchoredEndSpace?: AnchoredEndSpaceConfig;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    refScrollView?: React.Ref<ScrollView>;
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
};

export type LegendListProps<
    ItemT = any,
    TItemType extends string | undefined = string | undefined,
> = LegendListPropsOverrides<LegendListPropsBase<ItemT, ScrollViewProps, TItemType>>;

export type LegendListDataSourceProps<
    ItemT = any,
    TItemType extends string | undefined = string | undefined,
> = LegendListPropsOverrides<LegendListDataSourcePropsBase<ItemT, ScrollViewProps, TItemType>>;

export type LegendListRef = Omit<
    LegendListRefBase,
    "getAnimatableRef" | "getNativeScrollRef" | "getScrollResponder" | "reportContentInset"
> & {
    getAnimatableRef(): React.ElementRef<typeof ScrollViewComponent>;
    getNativeScrollRef(): React.ElementRef<typeof ScrollViewComponent>;
    getScrollResponder(): ScrollResponderMixin;
    reportContentInset(inset?: Partial<Insets> | null): void;
};

export type LegendListState = Omit<LegendListStateBase, "elementAtIndex"> & {
    elementAtIndex: (index: number) => View | null | undefined;
};

export type LegendListComponent = <ItemT = any>(
    props: LegendListProps<ItemT> & React.RefAttributes<LegendListRef>,
) => React.ReactElement | null;

export type LegendListDataSourceComponent = <ItemT = any>(
    props: LegendListDataSourceProps<ItemT> & React.RefAttributes<LegendListRef>,
) => React.ReactElement | null;
