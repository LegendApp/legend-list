// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type CSSProperties, forwardRef, type Ref } from "react";
import type { View as RNView, ViewStyle } from "react-native";

interface AnimatedViewPropsDOM {
    style: CSSProperties;
}
interface AnimatedViewProps extends Omit<AnimatedViewPropsDOM, "style"> {
    style: CSSProperties | ViewStyle;
}

export const AnimatedView = forwardRef(function AnimatedView(
    props: AnimatedViewProps,
    ref: Ref<HTMLDivElement | RNView>,
) {
    return <div ref={ref as Ref<HTMLDivElement>} {...(props as AnimatedViewPropsDOM)} />;
});

interface ViewPropsDOM {
    style: CSSProperties;
    children: React.ReactNode;
    onLayout?: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
}

interface ViewProps extends Omit<ViewPropsDOM, "style"> {
    style?: CSSProperties | ViewStyle;
    pointerEvents?: "auto" | "none" | "box-none" | "box-only";
}

export const View = forwardRef(function View(props: ViewProps, ref: Ref<HTMLDivElement>) {
    return <div ref={ref} {...(props as ViewPropsDOM)} />;
});

export const Text = View;
