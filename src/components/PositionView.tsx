import * as React from "react";
import { Animated } from "@/platform/Animated";
import type { LayoutChangeEvent } from "@/platform/Layout";
import type { View, ViewProps, ViewStyle } from "@/platform/View";

import { LeanView } from "@/components/LeanView";
import { IsNewArchitecture, POSITION_OUT_OF_VIEW } from "@/constants";
import { useValue$ } from "@/hooks/useValue$";
import { useArr$ } from "@/state/state";
import { typedMemo } from "@/types";

const PositionViewState = typedMemo(function PositionView({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: ViewStyle | ViewStyle[];
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);
    return (
        <LeanView
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
const PositionViewAnimated = typedMemo(function PositionView({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: ViewStyle | ViewStyle[];
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const position$ = useValue$(`containerPosition${id}`, {
        getValue: (v) => v ?? POSITION_OUT_OF_VIEW,
    });

    return (
        <Animated.View
            ref={refView}
            style={[
                style,
                horizontal ? { transform: [{ translateX: position$ }] } : { transform: [{ translateY: position$ }] },
            ]}
            {...rest}
        />
    );
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
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: ViewStyle | ViewStyle[];
    refView: React.RefObject<View>;
    animatedScrollY?: Animated.Value;
    stickyOffset?: Animated.Value;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    // Calculate transform based on sticky state
    const transform = React.useMemo(() => {
        if (animatedScrollY && stickyOffset) {
            const stickyPosition = animatedScrollY.interpolate({
                extrapolate: "clamp",
                inputRange: [position, position + 5000],
                outputRange: [position, position + 5000],
            });

            return horizontal ? [{ translateX: stickyPosition }] : [{ translateY: stickyPosition }];
        }
    }, [position, horizontal, animatedScrollY, stickyOffset]);

    const viewStyle = React.useMemo(() => [style, { zIndex: index + 1000 }, { transform }], [style, transform]);

    return <Animated.View ref={refView} style={viewStyle} {...rest} />;
});

export const PositionView = IsNewArchitecture ? PositionViewState : PositionViewAnimated;
export { PositionViewSticky };
