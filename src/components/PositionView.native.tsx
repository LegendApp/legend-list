import * as React from "react";
import { Animated, type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from "react-native";

import { POSITION_OUT_OF_VIEW } from "@/constants";
import { useArr$ } from "@/state/state";
import { type StickyHeaderConfig, typedMemo } from "@/types";
import { getComponent } from "@/utils/getComponent";

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewState = typedMemo(function PositionViewState({
    id,
    horizontal,
    index: _index,
    itemKey: _itemKey,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    index: number;
    itemKey?: string;
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

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    itemKey: _itemKey,
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
    itemKey?: string;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    animatedScrollY?: Animated.Value;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    stickyHeaderConfig?: StickyHeaderConfig;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW, headerSize = 0, stylePaddingTop = 0] = useArr$([
        `containerPosition${id}`,
        "headerSize",
        "stylePaddingTop",
    ]);

    // Calculate transform based on sticky state
    const transform = React.useMemo(() => {
        if (animatedScrollY) {
            const stickyConfigOffset = stickyHeaderConfig?.offset ?? 0;
            const stickyStart = position + headerSize + stylePaddingTop - stickyConfigOffset;
            const stickyPosition = animatedScrollY.interpolate({
                extrapolateLeft: "clamp",
                extrapolateRight: "extend",
                inputRange: [stickyStart, stickyStart + 5000],
                outputRange: [position, position + 5000],
            });

            return horizontal ? [{ translateX: stickyPosition }] : [{ translateY: stickyPosition }];
        }
    }, [animatedScrollY, headerSize, horizontal, position, stylePaddingTop, stickyHeaderConfig?.offset]);

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

export const PositionView = PositionViewState;
export { PositionViewSticky };
