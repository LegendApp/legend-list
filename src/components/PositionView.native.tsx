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
    stickyNextPosition,
    stickySize,
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
    stickyNextPosition?: number;
    stickySize?: number;
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

    // Calculate transform based on sticky state with push behavior
    const transform = React.useMemo(() => {
        if (animatedScrollY) {
            // Don't apply sticky transform if position is not yet set (out of view)
            // This prevents items from briefly appearing at the top when first allocated
            if (position === POSITION_OUT_OF_VIEW) {
                return horizontal ? [{ translateX: POSITION_OUT_OF_VIEW }] : [{ translateY: POSITION_OUT_OF_VIEW }];
            }

            const configOffset = stickyHeaderConfig?.offset ?? 0;
            const currentStickySize = stickySize ?? 0;

            // The stick point is when the item should start sticking
            // Item sticks when scroll reaches: position + headerSize + stylePaddingTop - configOffset
            const stickPoint = position + headerSize + stylePaddingTop - configOffset;

            if (stickyNextPosition !== undefined && currentStickySize > 0) {
                // Push behavior: when next sticky arrives, push current one up
                // Push starts when next sticky's top would touch current sticky's bottom
                // This happens when: scroll = stickyNextPosition + headerSize + stylePaddingTop - configOffset - currentStickySize
                const pushStartScroll =
                    stickyNextPosition + headerSize + stylePaddingTop - configOffset - currentStickySize;
                const pushEndScroll = stickyNextPosition + headerSize + stylePaddingTop - configOffset;

                // During the "stuck" phase (stickPoint to pushStartScroll), translateY increases with scroll
                // to keep the item at a fixed visual position. The relationship is:
                // translateY = position + (scroll - stickPoint) = scroll - headerSize - stylePaddingTop + configOffset
                //
                // At pushStartScroll: translateY = pushStartScroll - headerSize - stylePaddingTop + configOffset
                //                                = stickyNextPosition - currentStickySize
                //
                // During push (pushStartScroll to pushEndScroll), translateY stays constant
                // while scroll increases, causing the item to visually move up.
                const translateYAtPushStart = stickyNextPosition - currentStickySize;

                const stickyPosition = animatedScrollY.interpolate({
                    extrapolate: "clamp",
                    inputRange: [
                        stickPoint, // Start sticking
                        pushStartScroll, // Start being pushed
                        pushEndScroll, // Fully pushed off
                    ],
                    outputRange: [
                        position, // At natural position (translateY = position)
                        translateYAtPushStart, // At push start (still at top, about to be pushed)
                        translateYAtPushStart, // At push end (same translateY, but visually pushed up by scroll)
                    ],
                });

                return horizontal ? [{ translateX: stickyPosition }] : [{ translateY: stickyPosition }];
            }

            // No next sticky or size not known yet - use simple sticky without push
            const stickyPosition = animatedScrollY.interpolate({
                extrapolateLeft: "clamp",
                extrapolateRight: "extend",
                inputRange: [stickPoint, stickPoint + 5000],
                outputRange: [position, position + 5000],
            });

            return horizontal ? [{ translateX: stickyPosition }] : [{ translateY: stickyPosition }];
        }
    }, [
        animatedScrollY,
        headerSize,
        horizontal,
        position,
        stylePaddingTop,
        stickyHeaderConfig?.offset,
        stickyNextPosition,
        stickySize,
    ]);

    const viewStyle = React.useMemo(() => [style, { zIndex: index + 1000 }, { transform }], [style, transform, index]);

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
