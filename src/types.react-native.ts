import type { ReactElement } from "react";
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
    LegendListPropsBase,
    LegendListRef as LegendListRefBase,
    LegendListState as LegendListStateBase,
} from "@/types.base";

export * from "@/types.base";

type LegendListPropsOverrides<ItemT, TItemType extends string | undefined> = Omit<
    LegendListPropsBase<ItemT, ScrollViewProps, TItemType>,
    "onScroll" | "refScrollView" | "renderScrollComponent" | "ListHeaderComponentStyle" | "ListFooterComponentStyle"
> & {
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    refScrollView?: React.Ref<ScrollView>;
    renderScrollComponent?: (props: ScrollViewProps) => ReactElement<ScrollViewProps>;
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
};

export type LegendListProps<ItemT = any, TItemType extends string | undefined = string | undefined> =
    LegendListPropsOverrides<ItemT, TItemType>;

export type LegendListRef = Omit<LegendListRefBase, "getNativeScrollRef" | "getScrollResponder" | "reportContentInset"> & {
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
