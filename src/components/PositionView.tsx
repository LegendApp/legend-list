import * as React from "react";
import { Animated, type LayoutChangeEvent, Platform, type StyleProp, View, type ViewStyle } from "react-native";

import { IsAndroidTV, IsNewArchitecture, POSITION_OUT_OF_VIEW } from "@/constants";
import { useValue$ } from "@/hooks/useValue$";
import { useArr$ } from "@/state/state";
import { type StickyHeaderConfig, typedMemo } from "@/types";
import { getComponent } from "@/utils/getComponent";

// On Android TV use top/left positioning so the focus engine can find items.
// On macOS, transforms also don't work well. On all other platforms, prefer transforms.
const useLayoutPosition = IsAndroidTV || (Platform.OS !== "ios" && Platform.OS !== "android");

function getPositionStyle<T>(value: T, horizontal: boolean) {
    if (useLayoutPosition) {
        return horizontal ? { left: value } : { top: value };
    }
    return horizontal ? { transform: [{ translateX: value }] } : { transform: [{ translateY: value }] };
}

const PositionViewState = typedMemo(function PositionView({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);
    return <View ref={refView} style={[style, getPositionStyle(position, horizontal)]} {...rest} />;
});

// The Animated version is better on old arch but worse on new arch.
// And we don't want to use on new arch because it would make position updates
// not synchronous with the rest of the state updates.
const PositionViewAnimated = typedMemo(function PositionView({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const position$ = useValue$(`containerPosition${id}`, {
        getValue: (v) => v ?? POSITION_OUT_OF_VIEW,
    });

    return <Animated.View ref={refView} style={[style, getPositionStyle(position$, horizontal)]} {...rest} />;
});

// The Animated version is better on old arch but worse on new arch.
// And we don't want to use on new arch because it would make position updates
// not synchronous with the rest of the state updates.
const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    animatedScrollY,
    stickyOffset,
    index,
    stickyHeaderConfig,
    children,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    animatedScrollY?: Animated.Value;
    stickyOffset?: number;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    children: React.ReactNode;
    stickyHeaderConfig?: StickyHeaderConfig;
}) {
    const [position = POSITION_OUT_OF_VIEW, headerSize] = useArr$([`containerPosition${id}`, "headerSize"]);

    // Calculate sticky position based on scroll
    const stickyPosition = React.useMemo(() => {
        if (animatedScrollY && stickyOffset !== undefined) {
            const offset = stickyHeaderConfig?.offset ?? 0;
            return animatedScrollY.interpolate({
                extrapolateLeft: "clamp",
                extrapolateRight: "extend",
                inputRange: [position + headerSize - offset, position + 5000 + headerSize - offset],
                outputRange: [position, position + 5000],
            });
        }
    }, [animatedScrollY, headerSize, horizontal, stickyOffset, position, stickyHeaderConfig?.offset]);

    const positionStyle = React.useMemo(
        () => (stickyPosition ? getPositionStyle(stickyPosition, horizontal) : undefined),
        [stickyPosition, horizontal],
    );

    const viewStyle = React.useMemo(() => [style, { zIndex: index + 1000 }, positionStyle], [style, positionStyle]);

    const renderStickyHeaderBackdrop = React.useMemo(() => {
        if (!stickyHeaderConfig?.backdropComponent) {
            return null;
        }

        return (
            <View
                style={{
                    inset: 0,
                    pointerEvents: "none",
                    position: "absolute",
                }}
            >
                {getComponent(stickyHeaderConfig?.backdropComponent)}
            </View>
        );
    }, [stickyHeaderConfig?.backdropComponent]);

    return (
        <Animated.View ref={refView} style={viewStyle} {...rest}>
            {renderStickyHeaderBackdrop}
            {children}
        </Animated.View>
    );
});

export const PositionView = IsNewArchitecture ? PositionViewState : PositionViewAnimated;

export { PositionViewSticky };
