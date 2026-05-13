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

import type { LegendListRef as LegendListRefBase, LegendListState as LegendListStateBase } from "@/types.base";
import type { LegendListGroupPropsBase, LegendListPropsBase } from "@/types.internal";

export type {
    AlwaysRenderConfig,
    ColumnWrapperStyle,
    InitialScrollAnchor,
    Insets,
    LayoutRectangle,
    LegendListAverageItemSize,
    LegendListGroupInactiveBehavior,
    LegendListGroupInactiveUpdateMode,
    LegendListGroupList,
    LegendListGroupScrollPositionMode,
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

type LegendListPropsOverrides<ItemT, TItemType extends string | undefined> = Omit<
    LegendListPropsBase<ItemT, ScrollViewProps, TItemType>,
    | "anchoredEndSpace"
    | "contentInsetEndAdjustment"
    | "onScroll"
    | "refScrollView"
    | "renderScrollComponent"
    | "ListHeaderComponentStyle"
    | "ListFooterComponentStyle"
> & {
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    refScrollView?: React.Ref<ScrollView>;
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
};

export type LegendListProps<
    ItemT = any,
    TItemType extends string | undefined = string | undefined,
> = LegendListPropsOverrides<ItemT, TItemType>;

type LegendListGroupPropsOverrides<ItemT, TItemType extends string | undefined> = Omit<
    LegendListGroupPropsBase<ItemT, ScrollViewProps, TItemType>,
    | "anchoredEndSpace"
    | "contentInsetEndAdjustment"
    | "onScroll"
    | "refScrollView"
    | "renderScrollComponent"
    | "ListHeaderComponentStyle"
    | "ListFooterComponentStyle"
> & {
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    refScrollView?: React.Ref<ScrollView>;
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
};

export type LegendListGroupProps<
    ItemT = any,
    TItemType extends string | undefined = string | undefined,
> = LegendListGroupPropsOverrides<ItemT, TItemType>;

export type LegendListRef = Omit<
    LegendListRefBase,
    "getNativeScrollRef" | "getScrollResponder" | "reportContentInset"
> & {
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

export type LegendListGroupComponent = <ItemT = any>(
    props: LegendListGroupProps<ItemT> & React.RefAttributes<LegendListRef>,
) => React.ReactElement | null;
