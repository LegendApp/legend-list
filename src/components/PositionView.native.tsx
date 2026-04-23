import * as React from "react";
import { Animated, type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from "react-native";

import { getStickyPushLimit } from "@/components/stickyPositionUtils";
import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { useValue$ } from "@/hooks/useValue$";
import { useArr$, useStateContext } from "@/state/state";
import type { StickyHeaderConfig } from "@/types.base";
import { typedMemo } from "@/types.internal";
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
    const [position = POSITION_OUT_OF_VIEW, _itemKey] = useArr$([`containerPosition${id}`, `containerItemKey${id}`]);

    return <View ref={refView} style={[style, horizontal ? { left: position } : { top: position }]} {...rest} />;
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

    const position = horizontal ? { left: position$ } : { top: position$ };

    return <Animated.View ref={refView} style={[style, position]} {...rest} />;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    animatedScrollY,
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
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    stickyHeaderConfig?: StickyHeaderConfig;
    children: React.ReactNode;
}) {
    const ctx = useStateContext();
    const [position = POSITION_OUT_OF_VIEW, headerSize = 0, stylePaddingTop = 0, itemKey, _totalSize = 0] = useArr$([
        `containerPosition${id}`,
        "headerSize",
        "stylePaddingTop",
        `containerItemKey${id}`,
        "totalSize",
    ]);
    const pushLimit = React.useMemo(
        () => getStickyPushLimit(ctx.state, index, itemKey),
        [ctx.state, index, itemKey, _totalSize],
    );

    // Calculate the resolved sticky position for this item.
    const stickyPosition = React.useMemo(() => {
        if (animatedScrollY) {
            const stickyConfigOffset = stickyHeaderConfig?.offset ?? 0;
            const stickyStart = position + headerSize + stylePaddingTop - stickyConfigOffset;
            let nextStickyPosition: number | ReturnType<Animated.Value["interpolate"]>;

            if (pushLimit !== undefined) {
                if (pushLimit <= position) {
                    nextStickyPosition = pushLimit;
                } else {
                    nextStickyPosition = animatedScrollY.interpolate({
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        inputRange: [stickyStart, stickyStart + (pushLimit - position)],
                        outputRange: [position, pushLimit],
                    });
                }
            } else {
                nextStickyPosition = animatedScrollY.interpolate({
                    extrapolateLeft: "clamp",
                    extrapolateRight: "extend",
                    inputRange: [stickyStart, stickyStart + 5000],
                    outputRange: [position, position + 5000],
                });
            }

            return nextStickyPosition;
        }
    }, [animatedScrollY, headerSize, position, pushLimit, stylePaddingTop, stickyHeaderConfig?.offset]);

    const viewStyle = React.useMemo(
        () => [style, { zIndex: index + 1000 }, horizontal ? { left: stickyPosition } : { top: stickyPosition }],
        [horizontal, index, stickyPosition, style],
    );

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
