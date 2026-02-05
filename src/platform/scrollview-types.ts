import type {
    LayoutRectangle,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleProp,
    ViewStyle,
} from "@/types.base";

// Base, RN-free types for shared/internal modules. These are intentionally loose
// to avoid pulling react-native into the web type tree.
export type ScrollView = any;
export type ScrollViewProps = Record<string, any>;
export type View = any;
export type DimensionValue = number | string;

export type LayoutChangeEvent = { nativeEvent: { layout: LayoutRectangle } };

export type { LayoutRectangle, NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle };
