import type { CSSProperties, HTMLAttributes, ReactElement, Ref, RefAttributes } from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import type { LooseLayoutChangeEvent, LooseScrollViewProps } from "@/platform/scrollview-types";
import type {
    LegendListRef as LegendListRefBase,
    LegendListState as LegendListStateBase,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from "@/types.base";
import type { LegendListPropsBase } from "@/types.internal";

export type {
    AlwaysRenderConfig,
    ColumnWrapperStyle,
    InitialScrollAnchor,
    Insets,
    LayoutRectangle,
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
    ViewabilityAmountCallback,
    ViewabilityCallback,
    ViewabilityConfig,
    ViewabilityConfigCallbackPair,
    ViewabilityConfigCallbackPairs,
    ViewAmountToken,
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

type LegendListPropsOverrides<ItemT, TItemType extends string | undefined> = Omit<
    LegendListPropsBase<ItemT, ScrollViewPropsWeb, TItemType>,
    | "refScrollView"
    | "renderScrollComponent"
    | "ListHeaderComponentStyle"
    | "ListFooterComponentStyle"
    | "onRefresh"
    | "progressViewOffset"
    | "refreshing"
> & {
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
    "getNativeScrollRef" | "getScrollableNode" | "getScrollResponder"
> & {
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
