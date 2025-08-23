// React Native Web shim - exports web versions of React Native types and components
// This file provides web equivalents for React Native imports

import type { CSSProperties } from "react";

// Platform
export { Platform } from "./Platform";

// Components  
export { ScrollView } from "./ScrollView";
export { View } from "./View";
export { Text } from "./Text";
export { Animated } from "./Animated";

// Types - map React Native types to web equivalents
export type ViewStyle = CSSProperties;
export type TextStyle = CSSProperties;
export type StyleProp<T> = T | T[] | undefined | null | false;

export interface LayoutRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Insets {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
}

// ScrollView types
export interface ScrollViewProps {
    children?: React.ReactNode;
    horizontal?: boolean;
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
    showsVerticalScrollIndicator?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    scrollEventThrottle?: number;
    onScroll?: (event: any) => void;
    onLayout?: (event: any) => void;
    onContentSizeChange?: (width: number, height: number) => void;
    [key: string]: any;
}

// Dummy exports for compatibility
export const StyleSheet = {
    create: <T extends Record<string, any>>(styles: T): T => styles,
    flatten: (style: any) => style,
};

export const ScrollViewComponent = ScrollView;

export interface ScrollResponderMixin {
    // Add minimal interface for compatibility
    [key: string]: any;
}

// Dummy unstable_batchedUpdates for web
export const unstable_batchedUpdates = (callback: () => void) => {
    callback();
};