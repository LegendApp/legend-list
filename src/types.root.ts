import type { ComponentType, JSXElementConstructor, ReactElement, RefAttributes } from "react";

import type {
    Insets,
    LayoutRectangle,
    LegendListPropsBase,
    LegendListRef,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleProp,
    ViewStyle,
} from "@/types.base";

export * from "@/types.base";

export type AccessibilityActionEvent = any;
export type AccessibilityRole = any;
export type AccessibilityState = any;
export type AccessibilityValue = any;
export type ColorValue = any;
export type GestureResponderEvent = any;
export type PointerEvent = any;
export type RefreshControlProps = any;
export type Role = any;

export interface PointProp {
    x: number;
    y: number;
}

export interface LayoutChangeEvent {
    nativeEvent: {
        layout: LayoutRectangle;
    };
}

// Derived from RN ScrollViewProps: types unchanged between 0.76 and 0.83 are preserved; others are `any`.
/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/web` for strict typing. */
export interface ScrollViewPropsLoose {
    StickyHeaderComponent?: ComponentType<any>;
    accessibilityActions?: any;
    accessibilityElementsHidden?: boolean;
    accessibilityHint?: string;
    accessibilityIgnoresInvertColors?: boolean;
    accessibilityLabel?: string;
    accessibilityLabelledBy?: string | {};
    accessibilityLanguage?: string;
    accessibilityLargeContentTitle?: string;
    accessibilityLiveRegion?: "none" | "polite" | "assertive";
    accessibilityRespondsToUserInteraction?: any;
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
    children?: any;
    collapsable?: boolean;
    collapsableChildren?: boolean;
    contentContainerStyle?: StyleProp<ViewStyle>;
    contentInset?: Insets;
    contentInsetAdjustmentBehavior?: "always" | "never" | "automatic" | "scrollableAxes";
    contentOffset?: PointProp;
    decelerationRate?: number | "fast" | "normal";
    directionalLockEnabled?: boolean;
    disableIntervalMomentum?: boolean;
    disableScrollViewPanResponder?: boolean;
    endFillColor?: ColorValue;
    fadingEdgeLength?: any;
    focusable?: boolean;
    hasTVPreferredFocus?: boolean;
    hitSlop?: number | Insets;
    horizontal?: boolean;
    id?: string;
    importantForAccessibility?: "auto" | "yes" | "no" | "no-hide-descendants";
    indicatorStyle?: "default" | "black" | "white";
    innerViewRef?: any;
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
    onBlur?: any;
    onContentSizeChange?: any;
    onFocus?: any;
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
    refreshControl?: ReactElement<RefreshControlProps, string | JSXElementConstructor<any>>;
    removeClippedSubviews?: boolean;
    renderToHardwareTextureAndroid?: boolean;
    role?: Role;
    screenReaderFocusable?: any;
    scrollEnabled?: boolean;
    scrollEventThrottle?: number;
    scrollIndicatorInsets?: Insets;
    scrollPerfTag?: string;
    scrollToOverflowEnabled?: boolean;
    scrollViewRef?: any;
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
    style?: StyleProp<ViewStyle>;
    tabIndex?: 0 | -1;
    testID?: string;
    tvParallaxMagnification?: number;
    tvParallaxShiftDistanceX?: number;
    tvParallaxShiftDistanceY?: number;
    tvParallaxTiltAngle?: number;
    zoomScale?: number;
}

/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/web` for strict typing. */
export type LegendListProps<ItemT = any> = LegendListPropsBase<ItemT, ScrollViewPropsLoose>;

/** @deprecated Use `@legendapp/list/react-native` or `@legendapp/list/web` for strict typing. */
export type LegendListComponent<ItemT = any> = (props: LegendListProps<ItemT> & RefAttributes<LegendListRef>) =>
    ReactElement | null;
