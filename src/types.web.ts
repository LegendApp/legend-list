import type { CSSProperties, HTMLAttributes, ReactElement } from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import type {
    LayoutRectangle,
    LegendListPropsBase,
    LegendListRef as LegendListRefBase,
    LegendListState as LegendListStateBase,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from "@/types.base";
import type { ScrollViewPropsLoose } from "@/types";

export * from "@/types.base";

type ScrollViewPropsWeb = Omit<
    ScrollViewPropsLoose,
    "style" | "contentContainerStyle" | "onScroll" | "onLayout"
> &
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
    refScrollView?: React.Ref<HTMLElement | ScrollViewMethods>;
    renderScrollComponent?: (props: HTMLAttributes<HTMLElement>) => ReactElement | null;
    ListHeaderComponentStyle?: CSSProperties | undefined;
    ListFooterComponentStyle?: CSSProperties | undefined;
};

export type LegendListProps<ItemT = any, TItemType extends string | undefined = string | undefined> =
    LegendListPropsOverrides<ItemT, TItemType>;

export type LegendListRef = Omit<
    LegendListRefBase,
    "getNativeScrollRef" | "getScrollableNode" | "getScrollResponder"
> & {
    getNativeScrollRef(): HTMLElement | ScrollViewMethods;
    getScrollableNode(): HTMLElement;
    getScrollResponder(): any;
};

export type LegendListState = Omit<LegendListStateBase, "elementAtIndex"> & {
    elementAtIndex: (index: number) => HTMLElement | null | undefined;
};

export type LegendListComponent<ItemT = any> = (props: LegendListProps<ItemT> & React.RefAttributes<LegendListRef>) =>
    React.ReactElement | null;
