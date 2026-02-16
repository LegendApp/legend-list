import type { CSSProperties, HTMLAttributes, ReactElement, Ref, RefAttributes } from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import type {
    LayoutRectangle,
    LegendListPropsBase,
    LegendListRef as LegendListRefBase,
    LegendListState as LegendListStateBase,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from "@/types.base";
import type { LooseScrollViewProps } from "@/types.root";

export * from "@/types.base";

type ScrollViewPropsWeb = Omit<LooseScrollViewProps, "style" | "contentContainerStyle" | "onScroll" | "onLayout"> &
    HTMLAttributes<HTMLElement> & {
        style?: CSSProperties;
        contentContainerStyle?: CSSProperties;
        onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
        onLayout?: (event: { nativeEvent: { layout: LayoutRectangle } }) => void;
    };

type LegendListPropsOverrides<ItemT, TItemType extends string | undefined> = Omit<
    LegendListPropsBase<ItemT, ScrollViewPropsWeb, TItemType>,
    "refScrollView" | "renderScrollComponent" | "ListHeaderComponentStyle" | "ListFooterComponentStyle"
> & {
    refScrollView?: Ref<HTMLElement | ScrollViewMethods>;
    renderScrollComponent?: (props: ScrollViewPropsWeb) => ReactElement<ScrollViewPropsWeb> | null;
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
