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
    const [position = POSITION_OUT_OF_VIEW, _itemKey, layoutReady = true] = useArr$([
        `containerPosition${id}`,
        `containerItemKey${id}`,
        `containerLayoutReady${id}`,
    ]);

    // Fabric cannot re-enter the current commit when layout measurement corrects an estimated
    // position. Keep an unknown-size assignment laid out but invisible until that correction lands.
    return (
        <View
            ref={refView}
            style={[style, horizontal ? { left: position } : { top: position }, !layoutReady && { opacity: 0 }]}
            {...rest}
            pointerEvents={layoutReady ? undefined : "none"}
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

    const position = horizontal ? { left: position$ } : { top: position$ };

    return <Animated.View ref={refView} style={[style, position]} {...rest} />;
});

// Effectively unbounded travel for the last sticky header, which nothing pushes out.
const MAX_STICKY_DISTANCE = 1e7;

function clampAtZero(value: Animated.AnimatedSubtraction<number>) {
    return value.interpolate({
        extrapolateLeft: "clamp",
        extrapolateRight: "extend",
        inputRange: [0, 1],
        outputRange: [0, 1],
    });
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    animatedScrollY,
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
    stickyHeaderConfig?: StickyHeaderConfig;
    children: React.ReactNode;
}) {
    const ctx = useStateContext();
    const [
        position = POSITION_OUT_OF_VIEW,
        alignItemsAtEndPadding = 0,
        headerSize = 0,
        stylePaddingTop = 0,
        itemKey,
        itemIndex,
        _totalSize = 0,
    ] = useArr$([
        `containerPosition${id}`,
        "alignItemsAtEndPadding",
        "headerSize",
        "stylePaddingTop",
        `containerItemKey${id}`,
        `containerItemIndex${id}`,
        "totalSize",
    ]);
    const pushLimit = React.useMemo(
        () => getStickyPushLimit(ctx.state, itemIndex, itemKey),
        [ctx.state, itemIndex, itemKey, _totalSize],
    );

    const stickyConfigOffset = stickyHeaderConfig?.offset ?? 0;
    const stickyStart = position + headerSize + stylePaddingTop + alignItemsAtEndPadding - stickyConfigOffset;
    // How far the header may travel once pinned before the next sticky header has pushed it out.
    const maxStickyDistance = pushLimit !== undefined ? pushLimit - position : MAX_STICKY_DISTANCE;

    // Sticky headers follow scroll visually; keep this on transform. The native-driven graph is built
    // once and position changes are fed in with setValue. Swapping in a new interpolation instead is
    // not applied by the native driver until the next scroll event, so a header moved by a data change
    // stayed where it was until the user scrolled.
    const stickyTranslate = React.useMemo(() => {
        if (!animatedScrollY) {
            return undefined;
        }
        const position$ = new Animated.Value(position);
        const stickyStart$ = new Animated.Value(stickyStart);
        const maxStickyDistance$ = new Animated.Value(maxStickyDistance);
        const scrolledPastStart = clampAtZero(Animated.subtract(animatedScrollY, stickyStart$));
        // min(a, b) = b - max(b - a, 0)
        const stickyDistance = Animated.subtract(
            maxStickyDistance$,
            clampAtZero(Animated.subtract(maxStickyDistance$, scrolledPastStart)),
        );
        return {
            maxStickyDistance$,
            position$,
            stickyStart$,
            translate: Animated.add(position$, stickyDistance),
        };
    }, [animatedScrollY]);

    React.useLayoutEffect(() => {
        if (stickyTranslate) {
            stickyTranslate.position$.setValue(position);
            stickyTranslate.stickyStart$.setValue(stickyStart);
            stickyTranslate.maxStickyDistance$.setValue(maxStickyDistance);
        }
    }, [maxStickyDistance, position, stickyStart, stickyTranslate]);

    const transform = React.useMemo(() => {
        if (stickyTranslate) {
            return horizontal
                ? [{ translateX: stickyTranslate.translate }]
                : [{ translateY: stickyTranslate.translate }];
        }
    }, [horizontal, stickyTranslate]);

    const viewStyle = React.useMemo(
        () => [style, { zIndex: itemIndex + 1000 }, { transform }],
        [style, itemIndex, transform],
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
