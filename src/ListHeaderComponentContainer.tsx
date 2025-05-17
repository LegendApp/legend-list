// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { type StateContext, set$ } from "./state";
import { useValue$ } from "./useValue$";

interface ListHeaderComponentContainerProps {
    children: React.ReactNode;
    style: StyleProp<ViewStyle>;
    ctx: StateContext;
    horizontal: boolean;
    waitForInitialLayout: boolean | undefined;
}

export function ListHeaderComponentContainer({
    children,
    style,
    ctx,
    horizontal,
    waitForInitialLayout,
}: ListHeaderComponentContainerProps) {
    const scrollAdjust = useValue$("scrollAdjust", (v) => v, true);
    const animOpacity = waitForInitialLayout ? useValue$("containersDidLayout", (value) => (value ? 1 : 0)) : undefined;
    const additionalSize: ViewStyle = {
        transform: [{ translateY: Animated.multiply(scrollAdjust, -1) }],
        opacity: animOpacity,
    };

    return (
        <Animated.View
            style={[style, additionalSize]}
            onLayout={(event) => {
                const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                set$(ctx, "headerSize", size);
            }}
        >
            {children}
        </Animated.View>
    );
}
