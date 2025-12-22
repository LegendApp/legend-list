import * as React from "react";
import { Animated, type LayoutChangeEvent, Platform, type StyleProp, View, type ViewStyle } from "react-native";

import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { useValue$ } from "@/hooks/useValue$";
import { useArr$ } from "@/state/state";
import { type StickyHeaderConfig, typedMemo } from "@/types";
import { getComponent } from "@/utils/getComponent";

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewState = typedMemo(function PositionViewState({
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
    return (
        <View
            ref={refView}
            style={[
                style,
                horizontal ? { transform: [{ translateX: position }] } : { transform: [{ translateY: position }] },
            ]}
            {...rest}
        />
    );
});

// The Animated version is better on old arch but worse on new arch.
// And we don't want to use on new arch because it would make position updates
// not synchronous with the rest of the state updates.
// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewAnimated = typedMemo(function PositionViewAnimated({
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

    let position:
        | { transform: Array<{ translateX: Animated.Value }> }
        | { transform: Array<{ translateY: Animated.Value }> }
        | { left: Animated.Value }
        | { top: Animated.Value };

    if (Platform.OS === "ios" || Platform.OS === "android") {
        position = horizontal ? { transform: [{ translateX: position$ }] } : { transform: [{ translateY: position$ }] };
    } else {
        // react-native-macos seems to not work well with transform here
        position = horizontal ? { left: position$ } : { top: position$ };
    }

    return <Animated.View ref={refView} style={[style, position]} {...rest} />;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
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

    // Calculate transform based on sticky state
    const transform = React.useMemo(() => {
        if (animatedScrollY && stickyOffset !== undefined) {
            const stickyConfigOffset = stickyHeaderConfig?.offset ?? 0;
            const stickyPosition = animatedScrollY.interpolate({
                extrapolateLeft: "clamp",
                extrapolateRight: "extend",
                inputRange: [
                    position + headerSize - stickyConfigOffset - stickyOffset,
                    position + 5000 + headerSize - stickyConfigOffset - stickyOffset,
                ],
                outputRange: [position, position + 5000],
            });

            return horizontal ? [{ translateX: stickyPosition }] : [{ translateY: stickyPosition }];
        }
    }, [animatedScrollY, headerSize, horizontal, stickyOffset, position, stickyHeaderConfig?.offset]);

    const viewStyle = React.useMemo(() => [style, { zIndex: index + 1000 }, { transform }], [style, transform]);

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
