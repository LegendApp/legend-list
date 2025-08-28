import { type CSSProperties, forwardRef, type Ref } from "react";
import type { ViewStyle } from "react-native";

interface AnimatedViewProps {
    style: CSSProperties;
}

export const AnimatedView = function AnimatedView(props: AnimatedViewProps) {
    return <div {...props} />;
};

interface ViewPropsDOM {
    style: CSSProperties;
    children: React.ReactNode;
    onLayout?: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
}

interface ViewProps extends Omit<ViewPropsDOM, "style"> {
    style: CSSProperties | ViewStyle;
}

export const View = forwardRef(function View(props: ViewProps, ref: Ref<HTMLDivElement>) {
    return <div ref={ref} {...(props as ViewPropsDOM)} />;
});
