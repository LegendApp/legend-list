import type {
    ComponentType,
    CSSProperties,
    JSXElementConstructor,
    ReactElement,
    ReactNode,
    Ref,
    RefAttributes,
} from "react";

import type * as BaseTypes from "@/types.base";

export { typedForwardRef, typedMemo } from "@/types.base";

/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type Insets = BaseTypes.Insets;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LayoutRectangle = BaseTypes.LayoutRectangle;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type NativeScrollEvent = BaseTypes.NativeScrollEvent;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type NativeSyntheticEvent<T> = BaseTypes.NativeSyntheticEvent<T>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ViewStyle = BaseTypes.ViewStyle;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type StyleProp<T> = BaseTypes.StyleProp<T>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ScrollEventTargetLike = BaseTypes.ScrollEventTargetLike;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ScrollableNodeLike = BaseTypes.ScrollableNodeLike;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LegendListScrollerRef = BaseTypes.LegendListScrollerRef;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type BaseScrollViewProps<TScrollView> = BaseTypes.BaseScrollViewProps<TScrollView>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LegendListPropsBase<
    ItemT,
    TScrollViewProps = Record<string, any>,
    TItemType extends string | undefined = string | undefined,
> = BaseTypes.LegendListPropsBase<ItemT, TScrollViewProps, TItemType>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type MaintainVisibleContentPositionConfig<ItemT = any> = BaseTypes.MaintainVisibleContentPositionConfig<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type MaintainVisibleContentPositionNormalized<ItemT = any> =
    BaseTypes.MaintainVisibleContentPositionNormalized<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type StickyHeaderConfig = BaseTypes.StickyHeaderConfig;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type AlwaysRenderConfig = BaseTypes.AlwaysRenderConfig;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type MaintainScrollAtEndOnOptions = BaseTypes.MaintainScrollAtEndOnOptions;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type MaintainScrollAtEndOptions = BaseTypes.MaintainScrollAtEndOptions;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ColumnWrapperStyle = BaseTypes.ColumnWrapperStyle;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LegendListMetrics = BaseTypes.LegendListMetrics;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ThresholdSnapshot = BaseTypes.ThresholdSnapshot;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ScrollTarget = BaseTypes.ScrollTarget;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type InternalState = BaseTypes.InternalState;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ViewableRange<T> = BaseTypes.ViewableRange<T>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LegendListRenderItemProps<
    ItemT,
    TItemType extends string | number | undefined = string | number | undefined,
> = BaseTypes.LegendListRenderItemProps<ItemT, TItemType>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LegendListState = BaseTypes.LegendListState;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LegendListRef = BaseTypes.LegendListRef;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ViewToken<ItemT = any> = BaseTypes.ViewToken<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ViewAmountToken<ItemT = any> = BaseTypes.ViewAmountToken<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ViewabilityConfigCallbackPair<ItemT = any> = BaseTypes.ViewabilityConfigCallbackPair<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ViewabilityConfigCallbackPairs<ItemT> = BaseTypes.ViewabilityConfigCallbackPairs<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type OnViewableItemsChanged<ItemT> = BaseTypes.OnViewableItemsChanged<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ViewabilityConfig = BaseTypes.ViewabilityConfig;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ViewabilityCallback<ItemT = any> = BaseTypes.ViewabilityCallback<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ViewabilityAmountCallback<ItemT = any> = BaseTypes.ViewabilityAmountCallback<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LegendListRecyclingState<T> = BaseTypes.LegendListRecyclingState<T>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type TypedForwardRef = BaseTypes.TypedForwardRef;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type TypedMemo = BaseTypes.TypedMemo;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ScrollIndexWithOffset = BaseTypes.ScrollIndexWithOffset;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ScrollIndexWithOffsetPosition = BaseTypes.ScrollIndexWithOffsetPosition;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ScrollIndexWithOffsetAndContentOffset = BaseTypes.ScrollIndexWithOffsetAndContentOffset;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type InitialScrollAnchor = BaseTypes.InitialScrollAnchor;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type GetRenderedItemResult<ItemT> = BaseTypes.GetRenderedItemResult<ItemT>;
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type GetRenderedItem = BaseTypes.GetRenderedItem;

export interface LooseAccessibilityActionEvent {
    nativeEvent?: { actionName?: string };
}
export type AccessibilityActionEvent = LooseAccessibilityActionEvent;

export type LooseAccessibilityRole = string;
export type AccessibilityRole = LooseAccessibilityRole;

export interface LooseAccessibilityState {
    busy?: boolean;
    checked?: boolean | "mixed";
    disabled?: boolean;
    expanded?: boolean;
    selected?: boolean;
}
export type AccessibilityState = LooseAccessibilityState;

export interface LooseAccessibilityValue {
    max?: number;
    min?: number;
    now?: number;
    text?: string;
}
export type AccessibilityValue = LooseAccessibilityValue;

export type LooseColorValue = string | number;
export type ColorValue = LooseColorValue;

export interface LooseGestureResponderEvent {
    nativeEvent?: unknown;
}
export type GestureResponderEvent = LooseGestureResponderEvent;

export interface LoosePointerEvent {
    nativeEvent?: unknown;
}
export type PointerEvent = LoosePointerEvent;

export interface LooseRefreshControlProps {
    onRefresh?: () => void;
    progressViewOffset?: number;
    refreshing?: boolean;
}
export type RefreshControlProps = LooseRefreshControlProps;

export type LooseRole = string;
export type Role = LooseRole;

export interface PointProp {
    x: number;
    y: number;
}

export interface LayoutChangeEvent {
    nativeEvent: {
        layout: LayoutRectangle;
    };
}

// Derived from RN ScrollViewProps: types unchanged between 0.76 and 0.83 are preserved; others are intentionally loose.
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export interface LooseScrollViewProps {
    StickyHeaderComponent?: ComponentType<unknown>;
    accessibilityActions?: Array<{ label?: string; name: string }>;
    accessibilityElementsHidden?: boolean;
    accessibilityHint?: string;
    accessibilityIgnoresInvertColors?: boolean;
    accessibilityLabel?: string;
    accessibilityLabelledBy?: string | string[];
    accessibilityLanguage?: string;
    accessibilityLargeContentTitle?: string;
    accessibilityLiveRegion?: "none" | "polite" | "assertive";
    accessibilityRespondsToUserInteraction?: boolean;
    accessibilityRole?: AccessibilityRole;
    accessibilityShowsLargeContentViewer?: boolean;
    accessibilityState?: AccessibilityState;
    accessibilityValue?: AccessibilityValue;
    accessibilityViewIsModal?: boolean;
    accessible?: boolean;
    alwaysBounceHorizontal?: boolean;
    alwaysBounceVertical?: boolean;
    "aria-busy"?: boolean;
    "aria-checked"?: boolean | "mixed";
    "aria-disabled"?: boolean;
    "aria-expanded"?: boolean;
    "aria-hidden"?: boolean;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    "aria-live"?: "polite" | "assertive" | "off";
    "aria-modal"?: boolean;
    "aria-selected"?: boolean;
    "aria-valuemax"?: number;
    "aria-valuemin"?: number;
    "aria-valuenow"?: number;
    "aria-valuetext"?: string;
    automaticallyAdjustContentInsets?: boolean;
    automaticallyAdjustKeyboardInsets?: boolean;
    automaticallyAdjustsScrollIndicatorInsets?: boolean;
    bounces?: boolean;
    bouncesZoom?: boolean;
    canCancelContentTouches?: boolean;
    centerContent?: boolean;
    children?: ReactNode;
    collapsable?: boolean;
    collapsableChildren?: boolean;
    contentContainerStyle?: StyleProp<ViewStyle> | CSSProperties;
    contentInset?: Insets;
    contentInsetAdjustmentBehavior?: "always" | "never" | "automatic" | "scrollableAxes";
    contentOffset?: PointProp;
    decelerationRate?: number | "fast" | "normal";
    directionalLockEnabled?: boolean;
    disableIntervalMomentum?: boolean;
    disableScrollViewPanResponder?: boolean;
    endFillColor?: ColorValue;
    fadingEdgeLength?: number | { end?: number; start?: number };
    focusable?: boolean;
    hasTVPreferredFocus?: boolean;
    hitSlop?: number | Insets;
    horizontal?: boolean;
    id?: string;
    importantForAccessibility?: "auto" | "yes" | "no" | "no-hide-descendants";
    indicatorStyle?: "default" | "black" | "white";
    innerViewRef?: Ref<unknown>;
    invertStickyHeaders?: boolean;
    isTVSelectable?: boolean;
    keyboardDismissMode?: "none" | "interactive" | "on-drag";
    keyboardShouldPersistTaps?: boolean | "always" | "never" | "handled";
    maintainVisibleContentPosition?: { autoscrollToTopThreshold?: number; minIndexForVisible: number };
    maximumZoomScale?: number;
    minimumZoomScale?: number;
    nativeID?: string;
    needsOffscreenAlphaCompositing?: boolean;
    nestedScrollEnabled?: boolean;
    onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
    onAccessibilityEscape?: () => void;
    onAccessibilityTap?: () => void;
    onBlur?: (event: unknown) => void;
    onContentSizeChange?: (width: number, height: number) => void;
    onFocus?: (event: unknown) => void;
    onLayout?: (event: LayoutChangeEvent) => void;
    onMagicTap?: () => void;
    onMomentumScrollBegin?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onMoveShouldSetResponder?: (event: GestureResponderEvent) => boolean;
    onMoveShouldSetResponderCapture?: (event: GestureResponderEvent) => boolean;
    onPointerCancel?: (event: PointerEvent) => void;
    onPointerCancelCapture?: (event: PointerEvent) => void;
    onPointerDown?: (event: PointerEvent) => void;
    onPointerDownCapture?: (event: PointerEvent) => void;
    onPointerEnter?: (event: PointerEvent) => void;
    onPointerEnterCapture?: (event: PointerEvent) => void;
    onPointerLeave?: (event: PointerEvent) => void;
    onPointerLeaveCapture?: (event: PointerEvent) => void;
    onPointerMove?: (event: PointerEvent) => void;
    onPointerMoveCapture?: (event: PointerEvent) => void;
    onPointerUp?: (event: PointerEvent) => void;
    onPointerUpCapture?: (event: PointerEvent) => void;
    onResponderEnd?: (event: GestureResponderEvent) => void;
    onResponderGrant?: (event: GestureResponderEvent) => void;
    onResponderMove?: (event: GestureResponderEvent) => void;
    onResponderReject?: (event: GestureResponderEvent) => void;
    onResponderRelease?: (event: GestureResponderEvent) => void;
    onResponderStart?: (event: GestureResponderEvent) => void;
    onResponderTerminate?: (event: GestureResponderEvent) => void;
    onResponderTerminationRequest?: (event: GestureResponderEvent) => boolean;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScrollAnimationEnd?: () => void;
    onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScrollToTop?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onStartShouldSetResponder?: (event: GestureResponderEvent) => boolean;
    onStartShouldSetResponderCapture?: (event: GestureResponderEvent) => boolean;
    onTouchCancel?: (event: GestureResponderEvent) => void;
    onTouchEnd?: (event: GestureResponderEvent) => void;
    onTouchEndCapture?: (event: GestureResponderEvent) => void;
    onTouchMove?: (event: GestureResponderEvent) => void;
    onTouchStart?: (event: GestureResponderEvent) => void;
    overScrollMode?: "always" | "never" | "auto";
    pagingEnabled?: boolean;
    persistentScrollbar?: boolean;
    pinchGestureEnabled?: boolean;
    pointerEvents?: "none" | "box-none" | "box-only" | "auto";
    refreshControl?: ReactElement<RefreshControlProps, string | JSXElementConstructor<unknown>>;
    removeClippedSubviews?: boolean;
    renderToHardwareTextureAndroid?: boolean;
    role?: Role;
    screenReaderFocusable?: boolean;
    scrollEnabled?: boolean;
    scrollEventThrottle?: number;
    scrollIndicatorInsets?: Insets;
    scrollPerfTag?: string;
    scrollToOverflowEnabled?: boolean;
    scrollViewRef?: Ref<unknown>;
    scrollsToTop?: boolean;
    shouldRasterizeIOS?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    snapToAlignment?: "start" | "center" | "end";
    snapToEnd?: boolean;
    snapToInterval?: number;
    snapToOffsets?: number[];
    snapToStart?: boolean;
    stickyHeaderHiddenOnScroll?: boolean;
    stickyHeaderIndices?: number[];
    style?: StyleProp<ViewStyle> | CSSProperties;
    tabIndex?: 0 | -1;
    testID?: string;
    tvParallaxMagnification?: number;
    tvParallaxShiftDistanceX?: number;
    tvParallaxShiftDistanceY?: number;
    tvParallaxTiltAngle?: number;
    zoomScale?: number;
}

/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type ScrollViewPropsLoose = LooseScrollViewProps;

type LegendListPropsLoose<ItemT = any> = Omit<
    LegendListPropsBase<ItemT, LooseScrollViewProps>,
    "ListHeaderComponentStyle" | "ListFooterComponentStyle"
> & {
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | CSSProperties | undefined;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | CSSProperties | undefined;
};

/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LegendListProps<ItemT = any> = LegendListPropsLoose<ItemT>;

/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/react` for strict typing */
export type LegendListComponent = <ItemT = any>(
    props: LegendListProps<ItemT> & RefAttributes<LegendListRef>,
) => ReactElement | null;
