import type { ReactElement } from "react";

import type {
    Insets,
    LayoutRectangle,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleProp,
    ViewStyle,
} from "@/types.base";

// Base, RN-free types for shared/internal modules. These are intentionally loose
// to avoid pulling react-native into the web type tree.
export type LooseLayoutChangeEvent = { nativeEvent: { layout: LayoutRectangle } };

export type LooseMeasureCallback = (
    x: number,
    y: number,
    width: number,
    height: number,
    pageX: number,
    pageY: number,
) => void;

export interface LooseView {
    measure?: (callback: LooseMeasureCallback) => void;
}

export interface LooseScrollResponder {
    scrollResponderScrollTo?: (x: number, y: number, animated?: boolean) => void;
}

export interface LooseScrollView extends LooseView {
    flashScrollIndicators(): void;
    getScrollableNode(): HTMLElement;
    getScrollResponder(): LooseScrollResponder | HTMLElement | null;
    scrollTo(options: { x?: number; y?: number; animated?: boolean; initialScrollAtWindowEnd?: boolean }): void;
    scrollToEnd(options?: { animated?: boolean }): void;
}

export interface LooseScrollViewProps {
    contentContainerStyle?: StyleProp<ViewStyle>;
    contentInset?: Insets;
    contentOffset?: { x: number; y: number };
    horizontal?: boolean;
    maintainVisibleContentPosition?: { autoscrollToTopThreshold?: number; minIndexForVisible: number };
    onLayout?: (event: LooseLayoutChangeEvent) => void;
    onMomentumScrollBegin?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    refreshControl?: ReactElement | null;
    removeClippedSubviews?: boolean;
    scrollEventThrottle?: number;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    stickyHeaderIndices?: number[];
    style?: StyleProp<ViewStyle>;
}

export type ScrollView = LooseScrollView;
export type ScrollViewProps = LooseScrollViewProps;
export type View = LooseView;
export type DimensionValue = number | string;
export type LayoutChangeEvent = LooseLayoutChangeEvent;

export type { LayoutRectangle, NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle };
